<#
.SYNOPSIS
  Runs one flow by path or by (partial) file name.
.EXAMPLE
  .\scripts\run-single-test.ps1 app-launch
  .\scripts\run-single-test.ps1 .maestro\flows\regression\navigation.yaml -Record
#>
param(
    [Parameter(Mandatory, Position = 0)][string]$Test,
    [switch]$Record
)
. "$PSScriptRoot\_common.ps1"

if (Test-Path $Test -PathType Leaf) {
    $flow = (Resolve-Path $Test).Path
} else {
    $matches2 = @(Get-ChildItem (Join-Path $MaestroDir 'flows\smoke'), (Join-Path $MaestroDir 'flows\regression') -Filter *.yaml |
                  Where-Object { $_.BaseName -like "*$Test*" })
    if ($matches2.Count -eq 0) { Stop-WithError "No flow matches '$Test'. Available: $((Get-ChildItem $MaestroDir\flows\smoke, $MaestroDir\flows\regression -Filter *.yaml).BaseName -join ', ')" }
    if ($matches2.Count -gt 1) { Stop-WithError "'$Test' matches several flows: $($matches2.BaseName -join ', ')" }
    $flow = $matches2[0].FullName
}
if ($flow -like '*\flows\common\*' -or $flow -like '*\.maestro\pages\*') { Stop-WithError "$flow is a subflow or page action; run a test that uses it instead." }

$code = Invoke-MaestroRun -Label ("single-" + [IO.Path]::GetFileNameWithoutExtension($flow)) -Targets @($flow) -Record:$Record
exit $code
