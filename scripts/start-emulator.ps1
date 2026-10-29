<#
.SYNOPSIS
  Creates the AVD if it does not exist, launches the emulator and waits for a full boot.
.EXAMPLE
  .\scripts\start-emulator.ps1
  .\scripts\start-emulator.ps1 -Headless -ColdBoot
#>
param(
    [string]$AvdName,
    [switch]$Headless,      # no emulator window (CI); default is a visible window
    [switch]$ColdBoot,      # ignore the quick-boot snapshot
    [switch]$WipeData,      # factory-reset the AVD before booting
    [switch]$KeepAnimations,
    [int]$TimeoutSec = 420
)
. "$PSScriptRoot\_common.ps1"

$config   = Get-FrameworkConfig
if (-not $AvdName) { $AvdName = Get-ConfigValue $config 'AVD_NAME' 'SalesHiker_API37' }
$device   = Get-ConfigValue $config 'AVD_DEVICE' 'pixel_7'
$image    = Get-ConfigValue $config 'AVD_SYSTEM_IMAGE'
$avdDir   = Get-ConfigValue $config 'AVD_DIR'
$adb      = Get-ToolPath adb
$emulator = Get-ToolPath emulator

# ---- Already running?
foreach ($serial in @(Get-OnlineDevices | Where-Object { $_ -like 'emulator-*' })) {
    $name = ((Invoke-Native $adb @('-s', $serial, 'emu', 'avd', 'name')).Output | Select-Object -First 1)
    if ($name -and $name.Trim() -eq $AvdName) {
        if (Test-DeviceBooted $serial) { Write-Ok "$AvdName is already running and booted as $serial"; exit 0 }
        Write-Warn "$AvdName is running as $serial but still booting; waiting."
    }
}

# ---- Ensure the AVD exists
$avds = @((Invoke-Native $emulator @('-list-avds')).Output | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^INFO' })
if ($avds -notcontains $AvdName) {
    Write-Step "AVD '$AvdName' not found; creating it ($device, $image)"
    if (-not $image) { Stop-WithError "AVD_SYSTEM_IMAGE is not configured in config\.env" }
    $imageDir = Join-Path (Get-SdkRoot) (($image -replace ';', '\'))
    if (-not (Test-Path (Join-Path $imageDir 'system.img'))) {
        Stop-WithError ("System image '$image' is not installed. Install it (large download, requires accepting the SDK licence):`n" +
                        "  `$env:SKIP_JDK_VERSION_CHECK='1'; sdkmanager `"$image`"")
    }
    $avdmanager = Get-ToolPath avdmanager
    $createArgs = @('create', 'avd', '--name', $AvdName, '--package', $image, '--device', $device)
    if ($avdDir) { $createArgs += @('--path', $avdDir) }
    $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $out = 'no' | & $avdmanager @createArgs 2>&1 | ForEach-Object { "$_" }
    $ErrorActionPreference = $previous
    $avds = @((Invoke-Native $emulator @('-list-avds')).Output | ForEach-Object { $_.Trim() })
    if ($avds -notcontains $AvdName) { Stop-WithError "avdmanager could not create the AVD:`n$($out -join "`n")" }
    Write-Ok "Created AVD $AvdName"
}

# ---- Hardware profile. avdmanager defaults (2 vCPU, 2 GB, software GPU) starve Google Play images:
# system apps and the app under test hit ANRs. Applied on every start so config\.env stays authoritative.
$avdIni = Join-Path (Join-Path $env:USERPROFILE '.android\avd') "$AvdName.ini"
$avdPath = if (Test-Path $avdIni) { ((Get-Content $avdIni | Where-Object { $_ -like 'path=*' }) -replace '^path=', '') } else { $null }
if ($avdPath -and (Test-Path (Join-Path $avdPath 'config.ini'))) {
    $hardware = [ordered]@{
        'hw.cpu.ncore'   = Get-ConfigValue $config 'AVD_CORES' '4'
        'hw.ramSize'     = Get-ConfigValue $config 'AVD_RAM_MB' '4096'
        'hw.gpu.enabled' = 'yes'
        'hw.gpu.mode'    = Get-ConfigValue $config 'AVD_GPU_MODE' 'host'
        'hw.keyboard'    = 'yes'
    }
    $configIni = Join-Path $avdPath 'config.ini'
    $lines = [Collections.Generic.List[string]](Get-Content $configIni)
    foreach ($key in $hardware.Keys) {
        $index = $lines.FindIndex([Predicate[string]] { param($l) $l.StartsWith("$key=") })
        if ($index -ge 0) { $lines[$index] = "$key=$($hardware[$key])" } else { $lines.Add("$key=$($hardware[$key])") }
    }
    [IO.File]::WriteAllLines($configIni, $lines)
    Write-Step "AVD hardware: $($hardware['hw.cpu.ncore']) vCPU, $($hardware['hw.ramSize']) MB RAM, GPU $($hardware['hw.gpu.mode'])"
}

# ---- adb key: the emulator injects %USERPROFILE%\.android\adbkey.pub at boot. Without it
# Google Play images report the device as "unauthorized" and nothing can be automated.
$androidHome = if ($env:ANDROID_USER_HOME) { $env:ANDROID_USER_HOME } else { Join-Path $env:USERPROFILE '.android' }
$adbKey = Join-Path $androidHome 'adbkey'
if (-not (Test-Path $adbKey)) {
    $null = Invoke-Native $adb @('start-server')   # adb generates the key pair on first start
}
if ((Test-Path $adbKey) -and -not (Test-Path "$adbKey.pub")) {
    Write-Step "Generating missing $adbKey.pub"
    $pub = Invoke-Native $adb @('pubkey', $adbKey)
    if ($pub.ExitCode -ne 0) { Stop-WithError "Could not derive adbkey.pub: $($pub.Text)" }
    [IO.File]::WriteAllText("$adbKey.pub", ($pub.Output -join "`n") + "`n")
}

# ---- Launch
$before = @(Get-OnlineDevices)
$emuArgs = @('-avd', $AvdName, '-netdelay', 'none', '-netspeed', 'full', '-no-audio', '-no-boot-anim')
if ($Headless) { $emuArgs += '-no-window' }
if ($ColdBoot) { $emuArgs += '-no-snapshot-load' }
if ($WipeData) { $emuArgs += '-wipe-data' }
$logFile = Join-Path $ReportsDir 'emulator.log'
Write-Step "Launching emulator: emulator $($emuArgs -join ' ')"
$proc = Start-Process -FilePath $emulator -ArgumentList $emuArgs -PassThru -WindowStyle Minimized `
        -RedirectStandardOutput $logFile -RedirectStandardError "$logFile.err"

# ---- Wait for boot
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$serial = $null
while ((Get-Date) -lt $deadline) {
    if ($proc.HasExited) {
        Stop-WithError "Emulator exited with code $($proc.ExitCode). See $logFile and $logFile.err"
    }
    if (-not $serial) {
        $new = @(Get-OnlineDevices | Where-Object { $_ -like 'emulator-*' -and $before -notcontains $_ })
        if ($new.Count -gt 0) { $serial = $new[0]; Write-Step "Device $serial attached; waiting for Android to finish booting" }
    }
    if ($serial -and (Test-DeviceBooted $serial)) { break }
    Start-Sleep -Seconds 3
}
if (-not $serial -or -not (Test-DeviceBooted $serial)) {
    Stop-WithError "Emulator did not finish booting within $TimeoutSec s. See $logFile"
}

# Unlock the screen and turn off animations so UI tests are not timing-dependent.
$null = Invoke-Native $adb @('-s', $serial, 'shell', 'input', 'keyevent', '82')
if (-not $KeepAnimations) {
    foreach ($setting in 'window_animation_scale', 'transition_animation_scale', 'animator_duration_scale') {
        $null = Invoke-Native $adb @('-s', $serial, 'shell', 'settings', 'put', 'global', $setting, '0')
    }
}
# Disable system apps that crash or hog the CPU on emulators and are irrelevant to the app under
# test (default: the Google app, which raised "Google keeps stopping" over SalesHiker).
# Reversible: adb shell pm enable <package>
$noisy = @((Get-ConfigValue $config 'AVD_DISABLE_PACKAGES' 'com.google.android.googlequicksearchbox') -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($package in $noisy) {
    $res = Invoke-Native $adb @('-s', $serial, 'shell', 'pm', 'disable-user', '--user', '0', $package)
    if ($res.Text -match 'new state: disabled') { Write-Step "Disabled $package on the emulator" }
}
$release = (Invoke-Native $adb @('-s', $serial, 'shell', 'getprop', 'ro.build.version.release')).Text.Trim()
Write-Ok "$AvdName booted as $serial (Android $release)"
