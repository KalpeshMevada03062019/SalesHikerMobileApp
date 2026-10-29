<#
.SYNOPSIS
  Runs every flow tagged "smoke" on the connected device.
.EXAMPLE
  .\scripts\run-smoke.ps1
  .\scripts\run-smoke.ps1 -Record       # also save a screen recording per flow
#>
param([switch]$Record)
. "$PSScriptRoot\_common.ps1"

$code = Invoke-MaestroRun -Label 'smoke' -Targets @($MaestroDir) -IncludeTags @('smoke') -Record:$Record
exit $code
