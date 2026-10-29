<#
.SYNOPSIS
  Runs every flow tagged "regression" (optionally narrowed by extra tags).
.EXAMPLE
  .\scripts\run-regression.ps1
  .\scripts\run-regression.ps1 -Tags validation
  .\scripts\run-regression.ps1 -IncludeSmoke   # full run: smoke + regression
#>
param(
    [string[]]$Tags = @(),
    [switch]$IncludeSmoke,
    [switch]$Record
)
. "$PSScriptRoot\_common.ps1"

$include = if ($Tags.Count -gt 0) { $Tags } elseif ($IncludeSmoke) { @('smoke', 'regression') } else { @('regression') }
$code = Invoke-MaestroRun -Label 'regression' -Targets @($MaestroDir) -IncludeTags $include -Record:$Record
exit $code
