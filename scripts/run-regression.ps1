<#
.SYNOPSIS
  Runs the regression suite (test\specs\regression), or everything with -IncludeSmoke.
.EXAMPLE
  .\scripts\run-regression.ps1
  .\scripts\run-regression.ps1 -IncludeSmoke    # smoke + regression
  .\scripts\run-regression.ps1 -Grep MLGN-0     # only tests whose title contains "MLGN-0"
#>
param(
    [switch]$IncludeSmoke,
    [string]$Grep = '',
    [switch]$SkipWorkbooks
)
. "$PSScriptRoot\_common.ps1"

$suite = if ($IncludeSmoke) { '' } else { 'regression' }
$code = Invoke-WdioRun -Label ($(if ($IncludeSmoke) { 'full' } else { 'regression' })) -Suite $suite -Grep $Grep -SkipWorkbooks:$SkipWorkbooks
exit $code
