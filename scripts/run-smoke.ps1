<#
.SYNOPSIS
  Runs the smoke suite (test\specs\smoke) with WebdriverIO + Appium on the target device.
.EXAMPLE
  .\scripts\run-smoke.ps1
  .\scripts\run-smoke.ps1 -SkipWorkbooks   # do not update docs\*.xlsx
#>
param([switch]$SkipWorkbooks)
. "$PSScriptRoot\_common.ps1"

$code = Invoke-WdioRun -Label 'smoke' -Suite 'smoke' -SkipWorkbooks:$SkipWorkbooks
exit $code
