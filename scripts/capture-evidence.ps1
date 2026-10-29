<#
.SYNOPSIS
  Captures the device's current state for a bug report: screenshot, view hierarchy,
  full logcat, crash buffer, foreground activity and (optionally) a screen recording.
.EXAMPLE
  .\scripts\capture-evidence.ps1 -Label login-spinner
  .\scripts\capture-evidence.ps1 -Label checkout-crash -RecordSeconds 30
#>
param(
    [string]$Label = 'manual',
    [ValidateRange(0, 180)][int]$RecordSeconds = 0
)
. "$PSScriptRoot\_common.ps1"

$config = Get-FrameworkConfig
$appId  = Get-ConfigValue $config 'APP_ID'
$serial = Get-TargetDevice
$adb    = Get-ToolPath adb
$dir    = New-RunDirectory "evidence-$Label"

if ($RecordSeconds -gt 0) {
    Write-Step "Recording the screen for $RecordSeconds s - reproduce the issue now"
    $remote = '/sdcard/qa_evidence.mp4'
    $null = Invoke-Native $adb @('-s', $serial, 'shell', 'screenrecord', '--time-limit', "$RecordSeconds", $remote)
    $null = Invoke-Native $adb @('-s', $serial, 'pull', $remote, (Join-Path $dir 'recording.mp4'))
    $null = Invoke-Native $adb @('-s', $serial, 'shell', 'rm', $remote)
}

$shot = Join-Path $ScreenshotsDir ("{0}-{1}.png" -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $Label)
if (Save-DeviceScreenshot $serial $shot) { Copy-Item $shot (Join-Path $dir 'screen.png') }
$null = Save-DeviceLog $serial (Join-Path $dir 'logcat.txt') $appId

$focus = (Invoke-Native $adb @('-s', $serial, 'shell', 'dumpsys', 'window')).Output | Where-Object { $_ -match 'mCurrentFocus' } | Select-Object -First 1
$device = @(
    "Captured:  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "Device:    $serial ($((Invoke-Native $adb @('-s', $serial, 'shell', 'getprop', 'ro.product.model')).Text.Trim()), Android $((Invoke-Native $adb @('-s', $serial, 'shell', 'getprop', 'ro.build.version.release')).Text.Trim()))",
    "App:       $appId $(Get-AppVersion $serial $appId)",
    "Focus:     $("$focus".Trim())"
)
$device | Set-Content (Join-Path $dir 'device-info.txt') -Encoding UTF8

$maestro = Get-ToolPath maestro -Optional
if ($maestro) {
    $hierarchy = Invoke-Native $maestro @('--device', $serial, 'hierarchy', '--compact')
    $hierarchy.Output | Where-Object { $_ -notmatch '^WARNING' } | Set-Content (Join-Path $dir 'hierarchy.csv') -Encoding UTF8
}

$device | ForEach-Object { Write-Host $_ }
Write-Ok "Evidence saved to $dir"
Get-ChildItem $dir | ForEach-Object { Write-Host "  $($_.Name)" }
