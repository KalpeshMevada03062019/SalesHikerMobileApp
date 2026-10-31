# Shared helpers for the framework scripts. Dot-source it from a script:
#   . "$PSScriptRoot\_common.ps1"
# Compatible with Windows PowerShell 5.1 and PowerShell 7.

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$ProjectRoot    = Split-Path -Parent $PSScriptRoot
$MaestroDir     = Join-Path $ProjectRoot '.maestro'
$ReportsDir     = Join-Path $ProjectRoot 'reports'
$ScreenshotsDir = Join-Path $ProjectRoot 'screenshots'
$ConfigDir      = Join-Path $ProjectRoot 'config'

# The sdkmanager/avdmanager launchers parse a single-number Java version such as
# "27" as 27 < 170 and refuse to start. JDK 17+ is still required; this only
# bypasses the broken comparison.
$env:SKIP_JDK_VERSION_CHECK = '1'
$env:MAESTRO_CLI_NO_ANALYTICS = '1'
$env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true'
# The default driver start-up wait is too short for an emulator on a 4-core host.
if (-not $env:MAESTRO_DRIVER_STARTUP_TIMEOUT) { $env:MAESTRO_DRIVER_STARTUP_TIMEOUT = '180000' }

# ---------------------------------------------------------------- output

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message)   { Write-Host "[OK]   $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Stop-WithError([string]$Message) {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    exit 1
}

# Runs a native command, capturing stdout+stderr as strings without letting
# PowerShell 5.1 turn stderr lines into terminating errors.
function Invoke-Native {
    param([Parameter(Mandatory)][string]$Exe, [string[]]$Arguments = @())
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Exe @Arguments 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    [pscustomobject]@{ ExitCode = $code; Output = @($output); Text = (@($output) -join "`n") }
}

# ---------------------------------------------------------------- config

# Precedence: config/.env.example < config/.env < variables already set in the shell.
function Get-FrameworkConfig {
    $config = [ordered]@{}
    foreach ($file in @((Join-Path $ConfigDir '.env.example'), (Join-Path $ConfigDir '.env'))) {
        if (-not (Test-Path $file)) { continue }
        foreach ($line in Get-Content $file) {
            $trimmed = $line.Trim()
            if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
            $idx = $trimmed.IndexOf('=')
            if ($idx -lt 1) { continue }
            $key = $trimmed.Substring(0, $idx).Trim()
            $value = $trimmed.Substring($idx + 1).Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $config[$key] = $value
        }
    }
    foreach ($key in @($config.Keys)) {
        $fromShell = [Environment]::GetEnvironmentVariable($key, 'Process')
        if ($fromShell) { $config[$key] = $fromShell }
    }
    if (-not (Test-Path (Join-Path $ConfigDir '.env'))) {
        Write-Warn "config\.env not found; using defaults from config\.env.example. Copy it to config\.env to customise."
    }
    $config
}

function Get-ConfigValue($Config, [string]$Key, [string]$Default = '') {
    if ($Config.Contains($Key) -and $Config[$Key]) { return [string]$Config[$Key] }
    $Default
}

# ---------------------------------------------------------------- tools

function Get-SdkRoot {
    foreach ($candidate in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'))) {
        if ($candidate -and (Test-Path (Join-Path $candidate 'platform-tools'))) { return $candidate }
    }
    Stop-WithError "Android SDK not found. Set ANDROID_HOME to the SDK folder (see docs\SETUP.md)."
}

function Get-ToolPath([ValidateSet('adb', 'emulator', 'avdmanager', 'sdkmanager', 'aapt', 'maestro')][string]$Name, [switch]$Optional) {
    $path = $null
    if ($Name -eq 'maestro') {
        $cmd = Get-Command maestro -ErrorAction SilentlyContinue
        if ($cmd) { $path = $cmd.Source }
        elseif (Test-Path "$env:USERPROFILE\maestro\bin\maestro.bat") { $path = "$env:USERPROFILE\maestro\bin\maestro.bat" }
        $hint = 'Install Maestro CLI (docs\SETUP.md, step "Maestro").'
    } else {
        $sdk = Get-SdkRoot
        switch ($Name) {
            'adb'        { $path = Join-Path $sdk 'platform-tools\adb.exe' }
            'emulator'   { $path = Join-Path $sdk 'emulator\emulator.exe' }
            'avdmanager' { $path = Join-Path $sdk 'cmdline-tools\latest\bin\avdmanager.bat' }
            'sdkmanager' { $path = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat' }
            'aapt' {
                $bt = Get-ChildItem (Join-Path $sdk 'build-tools') -Directory -ErrorAction SilentlyContinue |
                      Sort-Object { [version]($_.Name -replace '[^0-9.].*$', '') } -Descending | Select-Object -First 1
                if ($bt) { $path = Join-Path $bt.FullName 'aapt.exe' }
            }
        }
        $hint = "Install the '$Name' component into $sdk (docs\SETUP.md)."
    }
    if (-not $path -or -not (Test-Path $path)) {
        if ($Optional) { return $null }
        Stop-WithError "$Name not found. $hint"
    }
    $path
}

# ---------------------------------------------------------------- devices

function Get-OnlineDevices {
    $adb = Get-ToolPath adb
    $result = Invoke-Native $adb @('devices')
    $serials = @()
    foreach ($line in $result.Output) {
        if ($line -match '^(\S+)\s+device$') { $serials += $Matches[1] }
    }
    $serials
}

function Test-DeviceBooted([string]$Serial) {
    $adb = Get-ToolPath adb
    $boot = (Invoke-Native $adb @('-s', $Serial, 'shell', 'getprop', 'sys.boot_completed')).Text.Trim()
    $anim = (Invoke-Native $adb @('-s', $Serial, 'shell', 'getprop', 'init.svc.bootanim')).Text.Trim()
    $pm   = (Invoke-Native $adb @('-s', $Serial, 'shell', 'pm', 'path', 'android')).Text
    ($boot -eq '1') -and ($anim -ne 'running') -and ($pm -match 'package:')
}

# Picks the device to test on: $env:ANDROID_SERIAL, else DEVICE_SERIAL from config\.env,
# else the only online device (emulator or phone).
function Get-TargetDevice {
    $online = @(Get-OnlineDevices)
    $wanted = $env:ANDROID_SERIAL
    if (-not $wanted) { $wanted = Get-ConfigValue (Get-FrameworkConfig) 'DEVICE_SERIAL' }
    if ($wanted) {
        if ($online -notcontains $wanted) {
            Stop-WithError "Device $wanted (ANDROID_SERIAL / DEVICE_SERIAL) is not connected. Connected: $($online -join ', ')"
        }
        $serial = $wanted
    } elseif ($online.Count -eq 0) {
        Stop-WithError "No Android device is connected. Start one with .\scripts\start-emulator.ps1 or connect a phone with USB debugging."
    } elseif ($online.Count -gt 1) {
        Stop-WithError "Several devices are connected ($($online -join ', ')). Set DEVICE_SERIAL in config\.env to choose one."
    } else {
        $serial = $online[0]
    }
    if (-not (Test-DeviceBooted $serial)) {
        Stop-WithError "Device $serial is connected but has not finished booting. Wait, or re-run .\scripts\start-emulator.ps1"
    }
    $serial
}

function Test-AppInstalled([string]$Serial, [string]$AppId) {
    $adb = Get-ToolPath adb
    $out = (Invoke-Native $adb @('-s', $Serial, 'shell', 'pm', 'path', $AppId)).Text
    $out -match 'package:'
}

function Get-AppVersion([string]$Serial, [string]$AppId) {
    $adb = Get-ToolPath adb
    $out = (Invoke-Native $adb @('-s', $Serial, 'shell', 'dumpsys', 'package', $AppId)).Output
    $line = $out | Where-Object { $_ -match 'versionName=' } | Select-Object -First 1
    if ($line) { return ($line -replace '.*versionName=', '').Trim() }
    ''
}

# ---------------------------------------------------------------- evidence

function Save-DeviceScreenshot([string]$Serial, [string]$Path) {
    $adb = Get-ToolPath adb
    $remote = '/sdcard/qa_capture.png'
    $null = Invoke-Native $adb @('-s', $Serial, 'shell', 'screencap', '-p', $remote)
    $pull = Invoke-Native $adb @('-s', $Serial, 'pull', $remote, $Path)
    $null = Invoke-Native $adb @('-s', $Serial, 'shell', 'rm', $remote)
    ($pull.ExitCode -eq 0) -and (Test-Path $Path)
}

function Save-DeviceLog([string]$Serial, [string]$Path, [string]$AppId = '') {
    $adb = Get-ToolPath adb
    $log = Invoke-Native $adb @('-s', $Serial, 'logcat', '-d', '-v', 'threadtime')
    $log.Output | Set-Content -Path $Path -Encoding UTF8
    if ($AppId) {
        $crashPath = [IO.Path]::ChangeExtension($Path, '.crash.txt')
        $crash = Invoke-Native $adb @('-s', $Serial, 'logcat', '-d', '-b', 'crash', '-v', 'threadtime')
        if ($crash.Output.Count -gt 0) { $crash.Output | Set-Content -Path $crashPath -Encoding UTF8 }
    }
    Test-Path $Path
}

function New-RunDirectory([string]$Label) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $dir = Join-Path $ReportsDir "$stamp-$Label"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $dir
}

# ---------------------------------------------------------------- flows

# Reads `name:` and `tags:` from a flow's header (the part before `---`).
function Get-FlowInfo([string]$Path) {
    $name = $null; $tags = @(); $inTags = $false
    foreach ($line in Get-Content $Path) {
        if ($line -match '^---\s*$') { break }
        if ($line -match '^name:\s*["'']?(.+?)["'']?\s*$') { $name = $Matches[1]; $inTags = $false; continue }
        if ($line -match '^tags:\s*\[(.*)\]') { $tags = @($Matches[1] -split ',' | ForEach-Object { $_.Trim(" '`"") }); continue }
        if ($line -match '^tags:\s*$') { $inTags = $true; continue }
        if ($inTags -and $line -match '^\s+-\s*(\S+)') { $tags += $Matches[1]; continue }
        if ($line -match '^\S') { $inTags = $false }
    }
    if (-not $name) { $name = [IO.Path]::GetFileNameWithoutExtension($Path) }
    [pscustomobject]@{ Path = $Path; Name = $name; Tags = $tags; File = [IO.Path]::GetFileNameWithoutExtension($Path) }
}

# Flows that a run over $Targets with the given tag filters should execute.
function Get-ExpectedFlows([string[]]$Targets, [string[]]$IncludeTags, [string[]]$ExcludeTags) {
    $files = @()
    foreach ($target in $Targets) {
        if (Test-Path $target -PathType Container) {
            $files += Get-ChildItem (Join-Path $target 'flows\smoke'), (Join-Path $target 'flows\regression') -Filter *.yaml -ErrorAction SilentlyContinue
        } else {
            $files += Get-Item $target
        }
    }
    foreach ($file in $files) {
        $info = Get-FlowInfo $file.FullName
        if ($IncludeTags -and -not ($info.Tags | Where-Object { $IncludeTags -contains $_ })) { continue }
        $info | Add-Member -NotePropertyName Excluded -NotePropertyValue ([bool]($ExcludeTags -and ($info.Tags | Where-Object { $ExcludeTags -contains $_ })))
        $info
    }
}

# Runs Maestro on the target device, collects evidence and writes summary.md.
# Returns the process exit code: 0 only when every expected flow ran and passed.
function Invoke-MaestroRun {
    param(
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][string[]]$Targets,
        [string[]]$IncludeTags = @(),
        [string[]]$ExcludeTags = @(),
        [switch]$Record
    )
    $config  = Get-FrameworkConfig
    $appId   = Get-ConfigValue $config 'APP_ID'
    $maestro = Get-ToolPath maestro
    $adb     = Get-ToolPath adb
    if (-not $appId) { Stop-WithError "APP_ID is not set in config\.env" }

    Write-Step "Checking device and app"
    $serial = Get-TargetDevice
    if (-not (Test-AppInstalled $serial $appId)) {
        Stop-WithError "$appId is not installed on $serial. Run: .\scripts\install-apk.ps1"
    }
    $version = Get-AppVersion $serial $appId
    if (-not $version) {
        # Seen on 2026-10-29: system_server's package manager broke and Maestro could not install its
        # driver (NPE in StorageManagerService). The quick-boot snapshot preserved the broken state.
        Stop-WithError ("The package manager on $serial is not answering (no version for $appId). Restart without the snapshot:`n" +
                        "  .\scripts\stop-emulator.ps1; .\scripts\start-emulator.ps1 -ColdBoot")
    }
    Write-Ok "$serial ready, $appId $version installed"

    # Test data reaches flows as MAESTRO_* shell variables, so secrets never appear on a command line.
    $env:MAESTRO_APP_ID = $appId
    $env:MAESTRO_RECORD = if ($Record) { 'true' } else { 'false' }
    $user = Get-ConfigValue $config 'TEST_USERNAME'
    $pass = Get-ConfigValue $config 'TEST_PASSWORD'
    $skipReason = @{}
    if ($user -and $pass) {
        $env:MAESTRO_TEST_USERNAME = $user
        $env:MAESTRO_TEST_PASSWORD = $pass
    } else {
        Remove-Item Env:\MAESTRO_TEST_USERNAME, Env:\MAESTRO_TEST_PASSWORD -ErrorAction SilentlyContinue
        $ExcludeTags = @($ExcludeTags) + 'requires-login'
        $skipReason['requires-login'] = 'TEST_USERNAME / TEST_PASSWORD not set in config\.env'
        Write-Warn "No test credentials configured; flows tagged 'requires-login' will be skipped"
    }

    $expected = @(Get-ExpectedFlows $Targets $IncludeTags $ExcludeTags)
    $toRun = @($expected | Where-Object { -not $_.Excluded })
    if ($toRun.Count -eq 0) { Write-Warn "No flows match this selection" }

    $runDir    = New-RunDirectory $Label
    $artifacts = Join-Path $runDir 'artifacts'
    $junit     = Join-Path $runDir 'junit.xml'
    $console   = Join-Path $runDir 'maestro-console.txt'

    $maestroArgs = @('--device', $serial, 'test') + $Targets + @('--format', 'JUNIT', '--output', $junit, '--test-output-dir', $artifacts, '--no-ansi')
    if ($IncludeTags) { $maestroArgs += @('--include-tags', ($IncludeTags -join ',')) }
    if ($ExcludeTags) { $maestroArgs += @('--exclude-tags', ($ExcludeTags -join ',')) }

    $null = Invoke-Native $adb @('-s', $serial, 'logcat', '-c')
    $started = Get-Date
    $exitCode = 0
    if ($toRun.Count -gt 0) {
        Write-Step "Running $($toRun.Count) flow(s): maestro $($maestroArgs -join ' ')"
        $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        & $maestro @maestroArgs 2>&1 | ForEach-Object { "$_" } |
            Where-Object { $_ -notmatch '^WARNING: (Final field|Use --enable-final|Mutating final|A terminally deprecated|sun\.misc\.|Please consider reporting)' } |
            Tee-Object -FilePath $console | Out-Host
        $exitCode = $LASTEXITCODE
        $ErrorActionPreference = $previous
    }
    $duration = [math]::Round(((Get-Date) - $started).TotalSeconds)

    # ---- Evidence captured after every run
    $null = Save-DeviceLog $serial (Join-Path $runDir 'logcat.txt') $appId
    $null = Save-DeviceScreenshot $serial (Join-Path $runDir 'final-screen.png')
    $anr = (Invoke-Native $adb @('-s', $serial, 'logcat', '-d', '-b', 'events')).Output | Where-Object { $_ -match "am_anr.*$([regex]::Escape($appId))" }
    if ($anr) { $anr | Set-Content (Join-Path $runDir 'anr-events.txt') -Encoding UTF8 }

    # Maestro records typed text in commands.json and maestro.log; strip the test password.
    # MLGN-007 also types the password with its letter case swapped; redact that variant too.
    if ($pass) {
        $swapped = -join ($pass.ToCharArray() | ForEach-Object { $s = [string]$_; if ($s -ceq $s.ToUpper()) { $s.ToLower() } else { $s.ToUpper() } })
        foreach ($file in Get-ChildItem $runDir -Recurse -File -Include *.json, *.log, *.txt, *.xml) {
            $text = [IO.File]::ReadAllText($file.FullName)
            $clean = $text.Replace($pass, '***REDACTED***').Replace($swapped, '***REDACTED***')
            if ($clean -ne $text) { [IO.File]::WriteAllText($file.FullName, $clean) }
        }
    }

    # ---- Results
    $results = @{}
    if (Test-Path $junit) {
        [xml]$xml = Get-Content $junit -Raw
        foreach ($case in $xml.SelectNodes('//testcase')) {
            $failure = $case.SelectSingleNode('failure')
            if (-not $failure) { $failure = $case.SelectSingleNode('error') }
            $status = if ($failure) { 'FAILED' } elseif ($case.SelectSingleNode('skipped')) { 'SKIPPED' } else { 'PASSED' }
            $message = if ($failure) { (($failure.InnerText, $failure.GetAttribute('message')) | Where-Object { $_ } | Select-Object -First 1) } else { '' }
            $results[$case.GetAttribute('name')] = [pscustomobject]@{ Status = $status; Time = $case.GetAttribute('time'); Message = $message }
        }
    }
    # A flow whose Maestro log shows the device dropping out never really ran: report it as
    # NOT EXECUTED (environment), not as a product failure.
    $envFailure = 'DeviceServerDiedException|host:transport:[^)]*\): device offline|device .* not found|Maestro Android driver did not start'
    foreach ($name in @($results.Keys)) {
        if ($results[$name].Status -ne 'FAILED') { continue }
        $log = Get-ChildItem $artifacts -Recurse -Filter maestro.log -ErrorAction SilentlyContinue |
               Where-Object { $_.Directory.Parent.Name -eq $name } | Select-Object -First 1
        if ($log -and (Select-String -Path $log.FullName -Pattern $envFailure -Quiet)) {
            $results[$name] = [pscustomobject]@{ Status = 'NOT EXECUTED'; Time = $results[$name].Time; Message = 'environment: device went offline during the run (see logs\maestro.log)' }
        }
    }

    $rows = foreach ($flow in $expected) {
        $result = $results[$flow.Name]
        if (-not $result) { $result = $results[$flow.File] }
        if ($flow.Excluded) {
            $reason = ($flow.Tags | Where-Object { $skipReason.ContainsKey($_) } | ForEach-Object { $skipReason[$_] } | Select-Object -First 1)
            if (-not $reason) { $reason = 'excluded by tag filter' }
            [pscustomobject]@{ Test = $flow.Name; Status = 'SKIPPED'; Seconds = ''; Detail = $reason; File = $flow.Path }
        } elseif ($result) {
            [pscustomobject]@{ Test = $flow.Name; Status = $result.Status; Seconds = $result.Time; Detail = (($result.Message -split "`n")[0]); File = $flow.Path }
        } else {
            [pscustomobject]@{ Test = $flow.Name; Status = 'NOT EXECUTED'; Seconds = ''; Detail = 'no result in junit.xml (run aborted or flow not picked up)'; File = $flow.Path }
        }
    }
    $rows = @($rows)
    $count = { param($s) @($rows | Where-Object { $_.Status -eq $s }).Count }
    $passed = & $count 'PASSED'; $failed = & $count 'FAILED'; $skipped = & $count 'SKIPPED'; $notRun = & $count 'NOT EXECUTED'

    $relative = { param($p) $p.Replace($ProjectRoot + '\', '') }
    $md = @(
        "# Execution summary: $Label", '',
        "| | |", "|---|---|",
        "| Started | $($started.ToString('yyyy-MM-dd HH:mm:ss')) |",
        "| Duration | $duration s |",
        "| Device | $serial |",
        "| App | $appId $(Get-AppVersion $serial $appId) |",
        "| Maestro exit code | $exitCode |", '',
        "**Passed: $passed | Failed: $failed | Skipped: $skipped | Not executed: $notRun**", '',
        '| Test | Status | Time (s) | Detail |', '|---|---|---|---|'
    )
    $md += $rows | ForEach-Object { "| $($_.Test) | $($_.Status) | $($_.Seconds) | $(($_.Detail -replace '\|', '/')) |" }
    $md += @('', '## Evidence', '',
        "- Maestro console: ``$(& $relative $console)``",
        "- JUnit report: ``$(& $relative $junit)``",
        "- Per-flow screenshots, commands.json, maestro.log, device logcat: ``$(& $relative $artifacts)``",
        "- Device log after run: ``$(& $relative (Join-Path $runDir 'logcat.txt'))``",
        "- Final screen: ``$(& $relative (Join-Path $runDir 'final-screen.png'))``")
    if ($anr) { $md += "- **ANR events for $appId recorded**: ``$(& $relative (Join-Path $runDir 'anr-events.txt'))``" }
    $md | Set-Content (Join-Path $runDir 'summary.md') -Encoding UTF8

    Write-Host ''
    $rows | Format-Table Test, Status, Seconds, Detail -AutoSize -Wrap | Out-String -Width 200 | Write-Host
    $color = if ($failed -or $notRun) { 'Red' } else { 'Green' }
    Write-Host "Passed: $passed  Failed: $failed  Skipped: $skipped  Not executed: $notRun" -ForegroundColor $color
    if ($anr) { Write-Warn "ANR events for $appId were logged during this run: $(Join-Path $runDir 'anr-events.txt')" }
    Write-Host "Report: $(Join-Path $runDir 'summary.md')"

    if ($failed -or $notRun -or ($exitCode -ne 0 -and $toRun.Count -gt 0)) { return 1 }
    0
}

# ---------------------------------------------------------------- WebdriverIO (Appium) runs

# IDs of the tests a run should execute, read from the `it('<ID> ...')` titles of the selected specs.
function Get-ExpectedTests([string[]]$SpecFiles, [string]$Grep) {
    foreach ($file in $SpecFiles) {
        foreach ($m in [regex]::Matches((Get-Content $file -Raw), "\bit\(\s*'([^']+)'")) {
            $title = $m.Groups[1].Value
            # Same rule as --mochaOpts.grep, which WebdriverIO applies as a regular expression.
            if ($Grep -and $title -notmatch $Grep) { continue }
            [pscustomobject]@{ Title = $title; File = $file.Replace($ProjectRoot + '\', '') }
        }
    }
}

# Runs WebdriverIO + Appium on the target device, then writes the Allure HTML report and summary.md.
# Returns the exit code: 0 only when every expected test ran and passed (skips are allowed).
function Invoke-WdioRun {
    param(
        [Parameter(Mandatory)][string]$Label,
        [ValidateSet('', 'smoke', 'regression')][string]$Suite = '',
        [string]$Spec = '',
        [string]$Grep = '',
        [switch]$SkipWorkbooks
    )
    $config = Get-FrameworkConfig
    $appId  = Get-ConfigValue $config 'APP_ID'
    $adb    = Get-ToolPath adb
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { Stop-WithError 'Node.js/npx not found. Install Node.js 22.19+ (docs\SETUP.md).' }
    if (-not (Get-Command appium -ErrorAction SilentlyContinue)) { Stop-WithError 'Appium not found. Run: npm install -g appium; appium driver install uiautomator2' }
    if (-not (Test-Path (Join-Path $ProjectRoot 'node_modules\@wdio\cli'))) { Stop-WithError 'Project dependencies missing. Run: npm install' }

    Write-Step 'Checking device and app'
    $serial = Get-TargetDevice
    if (-not (Test-AppInstalled $serial $appId)) { Stop-WithError "$appId is not installed on $serial. Run: .\scripts\install-apk.ps1" }
    $version = Get-AppVersion $serial $appId
    if (-not $version) { Stop-WithError "The package manager on $serial is not answering. Restart the device (emulator: .\scripts\start-emulator.ps1 -ColdBoot)." }
    Write-Ok "$serial ready, $appId $version installed"

    $runDir = New-RunDirectory $Label
    $env:RUN_DIR = $runDir
    $env:DEVICE_SERIAL = $serial
    $console = Join-Path $runDir 'wdio-console.txt'

    $specDir = Join-Path $ProjectRoot 'test\specs'
    $specFiles = if ($Spec) { @((Resolve-Path $Spec).Path) }
                 elseif ($Suite) { @(Get-ChildItem (Join-Path $specDir $Suite) -Filter *.spec.ts | ForEach-Object FullName) }
                 else { @(Get-ChildItem $specDir -Recurse -Filter *.spec.ts | ForEach-Object FullName) }
    $expected = @(Get-ExpectedTests $specFiles $Grep)

    $wdioArgs = @('wdio', 'run', './config/wdio.android.conf.ts')
    if ($Suite) { $wdioArgs += @('--suite', $Suite) }
    if ($Spec) { $wdioArgs += @('--spec', (Resolve-Path $Spec).Path) }
    if ($Grep) { $wdioArgs += @('--mochaOpts.grep', $Grep) }

    $null = Invoke-Native $adb @('-s', $serial, 'logcat', '-c')
    $started = Get-Date
    Write-Step "Running $($expected.Count) test(s): npx $($wdioArgs -join ' ')"
    Push-Location $ProjectRoot
    $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & npx @wdioArgs 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath $console | Out-Host
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previous
    Pop-Location
    $duration = [math]::Round(((Get-Date) - $started).TotalSeconds)

    # Reports can contain the typed password; strip it (and its case-swapped variant, MLGN-007).
    $pass = Get-ConfigValue $config 'TEST_PASSWORD'
    if ($pass) {
        $swapped = -join ($pass.ToCharArray() | ForEach-Object { $s = [string]$_; if ($s -ceq $s.ToUpper()) { $s.ToLower() } else { $s.ToUpper() } })
        foreach ($file in Get-ChildItem $runDir -Recurse -File -Include *.json, *.log, *.txt, *.xml) {
            $text = [IO.File]::ReadAllText($file.FullName)
            $clean = $text.Replace($pass, '***REDACTED***').Replace($swapped, '***REDACTED***')
            if ($clean -ne $text) { [IO.File]::WriteAllText($file.FullName, $clean) }
        }
    }

    # ---- HTML report (Allure, single self-contained file)
    $allureResults = Join-Path $runDir 'allure-results'
    $allureReport = Join-Path $runDir 'allure-report'
    if (Test-Path $allureResults) {
        $gen = Invoke-Native 'npx' @('allure', 'generate', $allureResults, '--clean', '--single-file', '-o', $allureReport)
        if ($gen.ExitCode -ne 0) { Write-Warn "Allure report not generated: $($gen.Text)" }
    }

    # ---- Results
    $results = @{}
    $junit = Join-Path $runDir 'junit-*.xml'   # one file per spec worker
    foreach ($junitFile in @(Get-ChildItem $junit -ErrorAction SilentlyContinue)) {
        [xml]$xml = Get-Content $junitFile.FullName -Raw
        foreach ($case in $xml.SelectNodes('//testcase')) {
            $failure = $case.SelectSingleNode('failure'); if (-not $failure) { $failure = $case.SelectSingleNode('error') }
            $message = if ($failure) { (($failure.GetAttribute('message'), $failure.InnerText) | Where-Object { $_ } | Select-Object -First 1) } else { '' }
            $status = if ($failure) { 'FAILED' } elseif ($case.SelectSingleNode('skipped')) { 'SKIPPED' } else { 'PASSED' }
            # A lost device or Appium session means the test never really ran.
            if ($status -eq 'FAILED' -and $message -match 'Could not start a new session|socket hang up|ECONNREFUSED|device offline|instrumentation process is not running|session is either terminated') {
                $status = 'NOT EXECUTED'; $message = "environment: $($message.Split("`n")[0])"
            }
            $results[$case.GetAttribute('name')] = [pscustomobject]@{ Status = $status; Time = $case.GetAttribute('time'); Message = $message }
        }
    }
    $rows = foreach ($test in $expected) {
        $key = @($results.Keys | Where-Object { $_ -eq $test.Title -or $_.EndsWith(" $($test.Title)") }) | Select-Object -First 1
        if ($key) {
            $r = $results[$key]
            [pscustomobject]@{ Test = $test.Title; Status = $r.Status; Seconds = $r.Time; Detail = (($r.Message -split "`n")[0]) }
        } else {
            [pscustomobject]@{ Test = $test.Title; Status = 'NOT EXECUTED'; Seconds = ''; Detail = 'no result in junit (session failed or run aborted)' }
        }
    }
    $rows = @($rows)
    $count = { param($s) @($rows | Where-Object { $_.Status -eq $s }).Count }
    $passed = & $count 'PASSED'; $failed = & $count 'FAILED'; $skipped = & $count 'SKIPPED'; $notRun = & $count 'NOT EXECUTED'

    $null = Save-DeviceScreenshot $serial (Join-Path $runDir 'final-screen.png')
    $relative = { param($p) $p.Replace($ProjectRoot + '\', '') }
    $device = "$serial ($((Invoke-Native $adb @('-s', $serial, 'shell', 'getprop', 'ro.product.model')).Text.Trim()), Android $((Invoke-Native $adb @('-s', $serial, 'shell', 'getprop', 'ro.build.version.release')).Text.Trim()))"
    # Machine-readable results for tools\excel\update-workbooks.js (same classification as summary.md).
    [pscustomobject]@{
        meta  = [pscustomobject]@{ label = $Label; started = $started.ToString('o'); durationSeconds = $duration; device = $device; app = "$appId $version" }
        tests = @($rows)
    } | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $runDir 'results.json') -Encoding UTF8
    $md = @(
        "# Execution summary: $Label", '',
        '| | |', '|---|---|',
        "| Started | $($started.ToString('yyyy-MM-dd HH:mm:ss')) |",
        "| Duration | $duration s |",
        "| Device | $device |",
        "| App | $appId $version |",
        "| WebdriverIO exit code | $exitCode |", '',
        "**Passed: $passed | Failed: $failed | Skipped: $skipped | Not executed: $notRun**", '',
        '| Test | Status | Time (s) | Detail |', '|---|---|---|---|'
    )
    $md += $rows | ForEach-Object { "| $($_.Test) | $($_.Status) | $($_.Seconds) | $(($_.Detail -replace '\|', '/')) |" }
    $md += @('', '## Evidence', '',
        "- HTML report: ``$(& $relative (Join-Path $allureReport 'index.html'))``",
        "- JUnit: ``$(& $relative $junit)``",
        "- Console: ``$(& $relative $console)``",
        "- Appium server log: ``$(& $relative (Join-Path $runDir 'appium.log'))``",
        "- Checkpoint screenshots: ``$(& $relative (Join-Path $runDir 'screenshots'))``",
        "- Failure diagnostics (screenshot, UI hierarchy, foreground app, logcat): ``$(& $relative (Join-Path $runDir 'failures'))``",
        "- Device log for the run: ``$(& $relative (Join-Path $runDir 'logcat.txt'))``")
    if (Test-Path (Join-Path $runDir 'anr-events.txt')) { $md += "- **ANR events for $appId recorded**: ``$(& $relative (Join-Path $runDir 'anr-events.txt'))``" }
    $md | Set-Content (Join-Path $runDir 'summary.md') -Encoding UTF8

    Write-Host ''
    $rows | Format-Table Test, Status, Seconds, Detail -AutoSize -Wrap | Out-String -Width 220 | Write-Host
    $color = if ($failed -or $notRun) { 'Red' } else { 'Green' }
    Write-Host "Passed: $passed  Failed: $failed  Skipped: $skipped  Not executed: $notRun" -ForegroundColor $color
    Write-Host "Summary: $(Join-Path $runDir 'summary.md')"
    if (Test-Path (Join-Path $allureReport 'index.html')) { Write-Host "HTML report: $(Join-Path $allureReport 'index.html')" }

    # ---- Test-case and defect workbooks (docs\*.xlsx), only when some test produced a result
    if (-not $SkipWorkbooks -and ($passed + $failed + $skipped) -gt 0) {
        Write-Step 'Updating test-case and defect workbooks'
        $wbOut = Invoke-Native 'node' @((Join-Path $ProjectRoot 'tools\excel\update-workbooks.js'), $runDir)
        $wbOut.Text.Trim() -split "`r?`n" | ForEach-Object { Write-Host "  $_" }
        if ($wbOut.ExitCode -ne 0) { Write-Warn 'Workbooks not updated (see above). The run itself is unaffected.' }
    }

    if ($failed -or $notRun) { return 1 }
    0
}
