<#
.SYNOPSIS
  Checks every prerequisite of the framework and prints how to fix what is missing.
  Exit code 1 when a required item fails; warnings do not fail.
.EXAMPLE
  .\scripts\doctor.ps1
#>
. "$PSScriptRoot\_common.ps1"

$checks = New-Object System.Collections.Generic.List[object]
function Add-Check([string]$Item, [ValidateSet('OK', 'WARN', 'FAIL')][string]$Status, [string]$Detail) {
    $checks.Add([pscustomobject]@{ Item = $Item; Status = $Status; Detail = $Detail })
}

$config = Get-FrameworkConfig

# ---- Host
$os = Get-CimInstance Win32_OperatingSystem
Add-Check 'Windows' 'OK' "$($os.Caption) $($os.Version) $($os.OSArchitecture)"
$drive = (Get-Item $env:USERPROFILE).PSDrive
$freeGb = [math]::Round($drive.Free / 1GB, 1)
Add-Check "Free space $($drive.Name):" $(if ($freeGb -ge 10) { 'OK' } else { 'WARN' }) "$freeGb GB (emulator data and Maestro need ~10 GB)"
$ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
Add-Check 'Host RAM' $(if ($ramGb -ge 12) { 'OK' } else { 'WARN' }) "$ramGb GB (AVD_RAM_MB=$(Get-ConfigValue $config 'AVD_RAM_MB' '4096'))"

# ---- Java
$javaExe = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { "$env:JAVA_HOME\bin\java.exe" } else { (Get-Command java -ErrorAction SilentlyContinue).Source }
if ($javaExe) {
    $versionLine = ((Invoke-Native $javaExe @('-version')).Output | Select-Object -First 1)
    $major = if ($versionLine -match '"(1\.)?(\d+)') { [int]$Matches[2] } else { 0 }
    Add-Check 'Java' $(if ($major -ge 17) { 'OK' } else { 'FAIL' }) "$versionLine ($javaExe)"
} else {
    Add-Check 'Java' 'FAIL' 'JDK 17+ not found. Install Temurin/Oracle JDK 17+ and set JAVA_HOME.'
}
Add-Check 'JAVA_HOME' $(if ($env:JAVA_HOME -and (Test-Path $env:JAVA_HOME)) { 'OK' } else { 'WARN' }) $(if ($env:JAVA_HOME) { $env:JAVA_HOME } else { 'not set' })

# ---- Android SDK
$sdk = $null
foreach ($candidate in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'))) {
    if ($candidate -and (Test-Path (Join-Path $candidate 'platform-tools'))) { $sdk = $candidate; break }
}
if ($sdk) {
    Add-Check 'ANDROID_HOME' $(if ($env:ANDROID_HOME) { 'OK' } else { 'WARN' }) $sdk
    foreach ($tool in 'adb', 'emulator', 'avdmanager', 'sdkmanager', 'aapt') {
        $path = Get-ToolPath $tool -Optional
        $required = $tool -in 'adb', 'emulator'
        Add-Check $tool $(if ($path) { 'OK' } elseif ($required) { 'FAIL' } else { 'WARN' }) $(if ($path) { $path } else { "missing - see docs\SETUP.md" })
    }
    $adb = Get-ToolPath adb -Optional
    if ($adb) { Add-Check 'adb version' 'OK' (((Invoke-Native $adb @('version')).Output | Select-Object -Index 1)) }
    $emulator = Get-ToolPath emulator -Optional
    if ($emulator) {
        $accel = (Invoke-Native $emulator @('-accel-check')).Text
        $usable = $accel -match 'is installed and usable'
        Add-Check 'Hardware acceleration' $(if ($usable) { 'OK' } else { 'FAIL' }) $(if ($usable) { ($accel -split "`n" | Where-Object { $_ -match 'usable' } | Select-Object -First 1).Trim() } else { 'Enable virtualization in BIOS and the Windows Hypervisor Platform feature (admin, reboot).' })
        $image = Get-ConfigValue $config 'AVD_SYSTEM_IMAGE'
        $imageOk = $image -and (Test-Path (Join-Path $sdk (Join-Path ($image -replace ';', '\') 'system.img')))
        Add-Check 'System image' $(if ($imageOk) { 'OK' } else { 'FAIL' }) $(if ($imageOk) { $image } else { "$image not installed: sdkmanager `"$image`"" })
        $avdName = Get-ConfigValue $config 'AVD_NAME'
        $avds = @((Invoke-Native $emulator @('-list-avds')).Output | ForEach-Object { $_.Trim() })
        Add-Check 'AVD' $(if ($avds -contains $avdName) { 'OK' } else { 'WARN' }) $(if ($avds -contains $avdName) { $avdName } else { "$avdName not created yet; start-emulator.ps1 creates it" })
    }
} else {
    Add-Check 'Android SDK' 'FAIL' 'Not found. Install command-line tools (docs\SETUP.md) and set ANDROID_HOME.'
}

# ---- Maestro and Claude Code
$maestro = Get-ToolPath maestro -Optional
if ($maestro) {
    $mv = ((Invoke-Native $maestro @('--version')).Output | Where-Object { $_ -match '^\d+\.\d+\.\d+' } | Select-Object -Last 1)
    Add-Check 'Maestro CLI' 'OK' "$mv ($maestro)"
} else {
    Add-Check 'Maestro CLI' 'FAIL' 'Not installed - see docs\SETUP.md'
}
$claude = Get-Command claude -ErrorAction SilentlyContinue
Add-Check 'Claude Code CLI' $(if ($claude) { 'OK' } else { 'WARN' }) $(if ($claude) { ((Invoke-Native $claude.Source @('--version')).Output | Select-Object -First 1) } else { 'not on PATH (only needed for AI-assisted authoring)' })
$mcpFile = Join-Path $ProjectRoot '.mcp.json'
$mcpOk = (Test-Path $mcpFile) -and ((Get-Content $mcpFile -Raw) -match '"maestro"')
Add-Check 'Maestro MCP config' $(if ($mcpOk) { 'OK' } else { 'WARN' }) $(if ($mcpOk) { '.mcp.json registers the "maestro" server' } else { 'not configured - see docs\SETUP.md, step "Maestro MCP"' })

# ---- Project configuration
Add-Check 'config\.env' $(if (Test-Path (Join-Path $ConfigDir '.env')) { 'OK' } else { 'WARN' }) $(if (Test-Path (Join-Path $ConfigDir '.env')) { 'present' } else { 'missing: copy config\.env.example to config\.env' })
$appId = Get-ConfigValue $config 'APP_ID'
Add-Check 'APP_ID' $(if ($appId) { 'OK' } else { 'FAIL' }) $(if ($appId) { $appId } else { 'not set' })
$apk = Get-ConfigValue $config 'APK_PATH'
Add-Check 'APK_PATH' $(if ($apk -and (Test-Path $apk)) { 'OK' } else { 'WARN' }) $(if ($apk) { $apk } else { 'not set (install-apk.ps1 -ApkPath ...)' })
$hasCreds = (Get-ConfigValue $config 'TEST_USERNAME') -and (Get-ConfigValue $config 'TEST_PASSWORD')
Add-Check 'Test credentials' $(if ($hasCreds) { 'OK' } else { 'WARN' }) $(if ($hasCreds) { 'configured (value hidden)' } else { "not set: 'requires-login' flows will be skipped" })

# ---- Device and app
if ($sdk -and (Get-ToolPath adb -Optional)) {
    $online = @(Get-OnlineDevices)
    if ($online.Count -eq 0) {
        Add-Check 'Device' 'WARN' 'none connected: .\scripts\start-emulator.ps1'
    } else {
        foreach ($serial in $online) {
            $booted = Test-DeviceBooted $serial
            Add-Check "Device $serial" $(if ($booted) { 'OK' } else { 'WARN' }) $(if ($booted) { 'online, boot completed' } else { 'still booting' })
            if ($booted -and $appId) {
                $installed = Test-AppInstalled $serial $appId
                Add-Check "App on $serial" $(if ($installed) { 'OK' } else { 'WARN' }) $(if ($installed) { "$appId $(Get-AppVersion $serial $appId)" } else { 'not installed: .\scripts\install-apk.ps1' })
            }
        }
    }
    $unauthorized = (Invoke-Native (Get-ToolPath adb) @('devices')).Output | Where-Object { $_ -match '\sunauthorized' }
    foreach ($line in $unauthorized) { Add-Check 'Device auth' 'FAIL' "$($line.Trim()): restart it with .\scripts\stop-emulator.ps1; .\scripts\start-emulator.ps1" }
}

# ---- Report
foreach ($check in $checks) {
    $color = switch ($check.Status) { 'OK' { 'Green' } 'WARN' { 'Yellow' } 'FAIL' { 'Red' } }
    Write-Host ("[{0,-4}] {1,-24} {2}" -f $check.Status, $check.Item, $check.Detail) -ForegroundColor $color
}
$failures = @($checks | Where-Object { $_.Status -eq 'FAIL' }).Count
$warnings = @($checks | Where-Object { $_.Status -eq 'WARN' }).Count
Write-Host ''
if ($failures) { Write-Host "$failures required check(s) failed, $warnings warning(s)." -ForegroundColor Red; exit 1 }
Write-Host "All required checks passed ($warnings warning(s))." -ForegroundColor Green
