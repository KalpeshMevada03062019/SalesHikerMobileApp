<#
.SYNOPSIS
  Runs one test by its ID (e.g. MLGN-005), or one spec file by path or partial name.
.EXAMPLE
  .\scripts\run-single-test.ps1 MLGN-005
  .\scripts\run-single-test.ps1 login-validation
  .\scripts\run-single-test.ps1 test\specs\smoke\login.spec.ts
#>
param([Parameter(Mandatory, Position = 0)][string]$Test, [switch]$SkipWorkbooks)
. "$PSScriptRoot\_common.ps1"

$specDir = Join-Path $ProjectRoot 'test\specs'
if ($Test -match '^[A-Z]+(-[A-Z]+)?-\d+$') {
    # A test ID: find the spec that contains it and run only that test.
    $hit = Select-String -Path (Join-Path $specDir '*\*.spec.ts') -Pattern "it\(\s*'$([regex]::Escape($Test))\b" | Select-Object -First 1
    if (-not $hit) { Stop-WithError "No test titled '$Test ...' in test\specs" }
    $code = Invoke-WdioRun -Label "single-$Test" -Spec $hit.Path -Grep $Test -SkipWorkbooks:$SkipWorkbooks
} else {
    $spec = if (Test-Path $Test -PathType Leaf) { (Resolve-Path $Test).Path }
            else { @(Get-ChildItem $specDir -Recurse -Filter *.spec.ts | Where-Object { $_.BaseName -like "*$Test*" }) }
    if ($spec -is [array]) {
        if ($spec.Count -eq 0) { Stop-WithError "No spec matches '$Test'. Available: $((Get-ChildItem $specDir -Recurse -Filter *.spec.ts).BaseName -join ', ')" }
        if ($spec.Count -gt 1) { Stop-WithError "'$Test' matches several specs: $($spec.BaseName -join ', ')" }
        $spec = $spec[0].FullName
    }
    $code = Invoke-WdioRun -Label ("single-" + [IO.Path]::GetFileNameWithoutExtension($spec)) -Spec $spec -SkipWorkbooks:$SkipWorkbooks
}
exit $code
