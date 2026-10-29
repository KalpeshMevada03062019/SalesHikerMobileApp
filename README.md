# SalesHiker mobile QA automation

Native Android UI tests for the SalesHiker app (`com.saleshiker.app`), built on **Maestro** YAML flows. They run on an Android emulator managed from PowerShell, with no Android Studio. Claude Code can inspect the live app through **Maestro MCP**.

## Quick start

```powershell
.\scripts\doctor.ps1                                        # check setup
.\scripts\start-emulator.ps1                                # boot the emulator (creates the AVD if needed)
.\scripts\install-apk.ps1 -ApkPath "C:\Apps\your-app.apk"   # install or update the APK (default: APK_PATH in config\.env)
.\scripts\run-smoke.ps1                                     # smoke suite
.\scripts\run-regression.ps1                                # regression suite
.\scripts\stop-emulator.ps1                                 # shut the emulator down
```

If scripts are blocked by the execution policy, use `powershell -ExecutionPolicy Bypass -File .\scripts\<script>.ps1`.

## All commands

| Action | Command |
|---|---|
| Check setup, device and app | `.\scripts\doctor.ps1` |
| List connected devices | `adb devices -l` or `maestro list-devices` |
| Start emulator (visible window) | `.\scripts\start-emulator.ps1` (options: `-Headless`, `-ColdBoot`, `-WipeData`) |
| Stop emulator | `.\scripts\stop-emulator.ps1` |
| Install / update APK | `.\scripts\install-apk.ps1 [-ApkPath <apk>] [-Clean] [-Launch]` |
| Launch the app | `.\scripts\install-apk.ps1 -Launch`, or `adb shell monkey -p com.saleshiker.app 1` |
| Smoke suite | `.\scripts\run-smoke.ps1 [-Record]` |
| Regression suite | `.\scripts\run-regression.ps1 [-Tags auth] [-IncludeSmoke] [-Record]` |
| One test | `.\scripts\run-single-test.ps1 navigation [-Record]` |
| Screenshot + logs + hierarchy | `.\scripts\capture-evidence.ps1 -Label <name> [-RecordSeconds 30]` |
| Raw Maestro (no wrapper) | `maestro test .maestro/flows/smoke/app-launch.yaml` |
| Inspect the current screen | `maestro hierarchy --compact` (or Maestro MCP `inspect_screen`) |

Each run writes `reports\<timestamp>-<suite>\summary.md` (passed / failed / skipped / not executed), `junit.xml`, screenshots, logs and optional videos. See `docs\FRAMEWORK_OVERVIEW.md#evidence-locations`.

## Configuration

Copy `config\.env.example` to `config\.env` (git-ignored) and set:

- `APK_PATH`: the APK to install
- `TEST_USERNAME`, `TEST_PASSWORD`: a **beta** test account. Without them, login tests are reported as SKIPPED
- `AVD_*`: emulator image and hardware

## Test coverage

| ID | Test | Suite |
|---|---|---|
| SMK-01 | App launches to the sign-in screen with all controls | smoke |
| SMK-02 | Valid user can sign in (needs credentials) | smoke |
| REG-AUTH-01 | Empty, malformed and unknown credentials are rejected with the right messages | regression |
| REG-FORM-01 | Per-field validation and Show/Hide password | regression |
| REG-NAV-01 | Scan-a-code screen and Back, dark/light toggle, browser hand-off for Forgot password and Create workspace | regression |

Post-login workflows are not covered yet: they need a test account and live inspection of those screens. See `docs\TEST_STRATEGY.md`.

## Latest verified execution (2026-10-29)

Device: `SalesHiker_API35` (Android 15, Google APIs x86_64, emulator-5554). App: `com.saleshiker.app` 1.0.0 from `saleshiker-beta-2026-10-28.apk`.

| Suite | Passed | Failed | Skipped | Not executed | Report |
|---|---|---|---|---|---|
| Smoke | 1 (SMK-01) | 0 | 1 (SMK-02, no credentials) | 0 | `reports\20261029-142258-smoke\summary.md` |
| Regression | 3 (REG-AUTH-01, REG-FORM-01, REG-NAV-01) | 0 | 0 | 0 | `reports\20261029-142408-regression\summary.md` |
| **Total (5 tests)** | **4** | **0** | **1** | **0** | |

There were no ANR events and no crashes for any process during these runs. Earlier runs on the API 37 Play image hit environment problems (system-app ANRs, a SystemUI crash loop); they are documented as ENV-001 to ENV-003 in `docs\DEFECT_TRACKER.md`.

Defects: **APP-001 (Low)**: the sign-in request is sent although client-side email validation has failed. Details and evidence are in `docs\DEFECT_TRACKER.md`.

## Using Claude Code

`.mcp.json` registers the Maestro MCP server, and `.claude/rules/mobile-testing.md` tells Claude how to work: inspect before writing locators, run every test, never claim a pass without evidence, and keep test, environment and app issues apart. Start Claude Code in this folder, approve the `maestro` server, and ask, for example:

- "Inspect the current screen and list stable selectors."
- "Write a regression test for <workflow> using the live app, run it and fix test-side issues."
- "Investigate the last failed run and draft a defect entry."

## Documentation

- `docs\ENVIRONMENT_AUDIT.md`: what was found and installed on this PC
- `docs\SETUP.md`: setup from scratch, plus troubleshooting
- `docs\FRAMEWORK_OVERVIEW.md`: architecture, folders, scripts, evidence, conventions
- `docs\TEST_STRATEGY.md`: scope, coverage, triage
- `docs\DEFECT_TRACKER.md`: observations and environment issues, with evidence
- `test-data\README.md`: test data and secret handling
