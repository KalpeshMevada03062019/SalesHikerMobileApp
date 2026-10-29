<#
.SYNOPSIS
  Installs or updates the APK on the connected device and optionally launches it.
.EXAMPLE
  .\scripts\install-apk.ps1
  .\scripts\install-apk.ps1 -ApkPath "C:\Apps\your-app.apk" -Launch
  .\scripts\install-apk.ps1 -Clean      # uninstall first (wipes app data)
#>
param(
    [string]$ApkPath,
    [switch]$Clean,
    [switch]$Launch
)
. "$PSScriptRoot\_common.ps1"

$config = Get-FrameworkConfig
if (-not $ApkPath) { $ApkPath = Get-ConfigValue $config 'APK_PATH' }
$appId  = Get-ConfigValue $config 'APP_ID'
if (-not $ApkPath) { Stop-WithError "No APK given. Pass -ApkPath or set APK_PATH in config\.env" }
if (-not (Test-Path $ApkPath -PathType Leaf)) { Stop-WithError "APK not found: $ApkPath" }
$ApkPath = (Resolve-Path $ApkPath).Path
$adb = Get-ToolPath adb

# ---- Read the APK's own package ID / launch activity
$aapt = Get-ToolPath aapt -Optional
$apkPackage = $null
if ($aapt) {
    $badging = Invoke-Native $aapt @('dump', 'badging', $ApkPath)
    $pkgLine = $badging.Output | Where-Object { $_ -like 'package:*' } | Select-Object -First 1
    if ($pkgLine -match "name='([^']+)'.*? versionName='([^']*)'") {
        $apkPackage = $Matches[1]; $apkVersion = $Matches[2]
        Write-Step "APK: $apkPackage $apkVersion ($([math]::Round((Get-Item $ApkPath).Length / 1MB, 1)) MB)"
    }
    $activity = $badging.Output | Where-Object { $_ -like 'launchable-activity:*' } | Select-Object -First 1
    if ($activity -match "name='([^']+)'") { Write-Step "Launch activity: $($Matches[1])" }
} else {
    Write-Warn "aapt not found (build-tools missing); cannot verify the APK's package ID"
}
if ($apkPackage -and $appId -and $apkPackage -ne $appId) {
    Write-Warn "APK package '$apkPackage' differs from APP_ID '$appId' in config\.env; flows target APP_ID."
}
if (-not $appId) { $appId = $apkPackage }

$serial = Get-TargetDevice
Write-Step "Target device: $serial"

if ($Clean -and (Test-AppInstalled $serial $appId)) {
    Write-Step "Uninstalling $appId"
    $null = Invoke-Native $adb @('-s', $serial, 'uninstall', $appId)
}

$wasInstalled = Test-AppInstalled $serial $appId
Write-Step ($(if ($wasInstalled) { "Updating $appId (data is kept)" } else { "Installing $appId" }))
# -r replace existing, -d allow version downgrade, -g grant runtime permissions (camera, notifications, ...)
$install = Invoke-Native $adb @('-s', $serial, 'install', '-r', '-d', '-g', $ApkPath)
if ($install.ExitCode -ne 0 -or $install.Text -notmatch 'Success') {
    Stop-WithError "adb install failed:`n$($install.Text)"
}
if (-not (Test-AppInstalled $serial $appId)) { Stop-WithError "Install reported success but $appId is not on the device" }
Write-Ok "$appId $(Get-AppVersion $serial $appId) installed on $serial"

if ($Launch) {
    $resolved = (Invoke-Native $adb @('-s', $serial, 'shell', 'cmd', 'package', 'resolve-activity', '--brief', '-c', 'android.intent.category.LAUNCHER', $appId)).Output |
                Where-Object { $_ -match '/' } | Select-Object -Last 1
    if (-not $resolved) { Stop-WithError "No launcher activity found for $appId" }
    $start = Invoke-Native $adb @('-s', $serial, 'shell', 'am', 'start', '-W', '-n', $resolved.Trim())
    if ($start.Text -notmatch 'Status: ok') { Stop-WithError "Launch failed:`n$($start.Text)" }
    Start-Sleep -Seconds 3
    $pid2 = (Invoke-Native $adb @('-s', $serial, 'shell', 'pidof', $appId)).Text.Trim()
    if (-not $pid2) { Stop-WithError "$appId exited right after launch. Check: adb logcat -b crash -d" }
    Write-Ok "Launched $($resolved.Trim()) (pid $pid2)"
}
