<#
.SYNOPSIS
  Gracefully stops running emulators (adb emu kill), force-stopping only if they do not exit.
.EXAMPLE
  .\scripts\stop-emulator.ps1               # all emulators
  .\scripts\stop-emulator.ps1 -Serial emulator-5556
#>
param(
    [string]$Serial,
    [int]$TimeoutSec = 60
)
. "$PSScriptRoot\_common.ps1"

$adb = Get-ToolPath adb
$targets = @(if ($Serial) { $Serial } else { Get-OnlineDevices | Where-Object { $_ -like 'emulator-*' } })
# Also catch emulators adb sees as offline/unauthorized.
if (-not $Serial) {
    foreach ($line in (Invoke-Native $adb @('devices')).Output) {
        if ($line -match '^(emulator-\d+)\s+(offline|unauthorized)' -and $targets -notcontains $Matches[1]) { $targets += $Matches[1] }
    }
}
if ($targets.Count -eq 0 -and -not (Get-Process qemu-system-* -ErrorAction SilentlyContinue)) {
    Write-Ok "No emulator is running"
    exit 0
}

foreach ($target in $targets) {
    Write-Step "Stopping $target"
    $null = Invoke-Native $adb @('-s', $target, 'emu', 'kill')
}

$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
    $remaining = @(Get-OnlineDevices | Where-Object { $targets -contains $_ })
    if ($remaining.Count -eq 0 -and ($Serial -or -not (Get-Process qemu-system-* -ErrorAction SilentlyContinue))) { break }
    Start-Sleep -Seconds 2
}

if (-not $Serial -and (Get-Process qemu-system-* -ErrorAction SilentlyContinue)) {
    Write-Warn "Emulator did not exit within $TimeoutSec s; force-stopping the qemu process"
    Get-Process qemu-system-* -ErrorAction SilentlyContinue | Stop-Process -Force
}
Write-Ok "Emulator stopped"
