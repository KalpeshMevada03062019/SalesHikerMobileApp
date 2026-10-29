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

# Picks the device to test on: $env:ANDROID_SERIAL if set, else the only online device.
function Get-TargetDevice {
    $online = @(Get-OnlineDevices)
    if ($env:ANDROID_SERIAL) {
        if ($online -notcontains $env:ANDROID_SERIAL) {
            Stop-WithError "ANDROID_SERIAL=$env:ANDROID_SERIAL is not connected. Connected: $($online -join ', ')"
        }
        $serial = $env:ANDROID_SERIAL
    } elseif ($online.Count -eq 0) {
        Stop-WithError "No Android device is connected. Start one with: .\scripts\start-emulator.ps1"
    } elseif ($online.Count -gt 1) {
        Stop-WithError "Several devices are connected ($($online -join ', ')). Set `$env:ANDROID_SERIAL to choose one."
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
    if ($pass) {
        foreach ($file in Get-ChildItem $runDir -Recurse -File -Include *.json, *.log, *.txt, *.xml) {
            $text = [IO.File]::ReadAllText($file.FullName)
            if ($text.Contains($pass)) { [IO.File]::WriteAllText($file.FullName, $text.Replace($pass, '***REDACTED***')) }
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
