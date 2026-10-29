# Framework overview

## Architecture

```
PowerShell scripts ──► Maestro CLI ──► Maestro driver on the emulator ──► SalesHiker app (real UI)
   (device, app,          (YAML flows,       (installed automatically      com.saleshiker.app
    data, evidence)        JUnit report)      on first run)
        │
        └──► adb (install, logcat, screenshots, boot checks)

Claude Code ──► Maestro MCP (inspect_screen, take_screenshot, run) ──► same emulator
```

- **Maestro** drives the real UI through Android accessibility. There are no API calls, mocks or web drivers.
- **PowerShell scripts** wrap device management and evidence collection so a run is one command and every result is backed by artefacts.
- **Claude Code** uses `.claude/rules/mobile-testing.md` and the Maestro MCP server to inspect the live app and write flows against what is actually on screen.

## Folder structure

```
SalesHikerMobileApp/
├── .claude/rules/mobile-testing.md   Rules Claude Code follows in this repo
├── .mcp.json                         Registers the Maestro MCP server (project scope)
├── .maestro/
│   ├── config.yaml                   Workspace: which folders hold runnable flows
│   ├── pages/                        PAGE OBJECT MODEL (never run on their own)
│   │   ├── load-page-objects.yaml    Loads every *.page.js into `output` (tests call it in onFlowStart)
│   │   ├── shared/header.page.js     Back button, dark/light theme toggle
│   │   ├── sign-in/
│   │   │   ├── sign-in.page.js       Selectors + expected messages  -> output.signIn
│   │   │   ├── assert-displayed.yaml Page actions (reusable steps) ...
│   │   │   ├── enter-email.yaml          EMAIL
│   │   │   ├── enter-password.yaml       PASSWORD
│   │   │   ├── submit.yaml
│   │   │   ├── sign-in-with.yaml         EMAIL, PASSWORD
│   │   │   └── go-to-scan-code.yaml
│   │   ├── scan-code/
│   │   │   ├── scan-code.page.js     -> output.scanCode
│   │   │   ├── assert-displayed.yaml
│   │   │   └── go-back.yaml
│   │   └── home/
│   │       ├── home.page.js          -> output.home ("Today" dashboard after sign-in)
│   │       └── assert-displayed.yaml
│   └── flows/
│       ├── common/                   App-level subflows (never run on their own)
│       │   ├── launch-app.yaml       Clean start + wait for sign-in (dismisses other apps' ANR dialogs)
│       │   ├── login.yaml            Sign in with TEST_USERNAME / TEST_PASSWORD, land on Home
│       │   ├── start-recording.yaml  Video hook, active with -Record
│       │   └── stop-recording.yaml
│       ├── smoke/                    Tests: fast "is the build usable" checks
│       └── regression/               Tests: behaviour checks per feature area
├── config/
│   ├── .env.example                  Documented settings (committed)
│   └── .env                          Local values and credentials (git-ignored)
├── scripts/                          PowerShell entry points (see below)
├── test-data/README.md               Where test data comes from and how it is protected
├── reports/                          One folder per run (git-ignored)
├── screenshots/                      Ad-hoc captures from capture-evidence.ps1 (git-ignored)
└── docs/                             This documentation
```

Deviation from the requested layout: the project root is this existing `SalesHikerMobileApp` folder rather than a new `mobile-app-qa` sub-folder, and the flows sit under `.maestro/flows/`, which is Maestro's workspace convention.

## Page Object Model

Tests never contain UI strings. Every screen has two parts.

**1. Page object** (`pages/<screen>/<screen>.page.js`): a plain JS object on Maestro's `output`, holding the screen's selectors and the messages it can show. The values were read from the live app.

```js
output.signIn = {
  emailField: 'Email address',
  submitButton: 'Sign in',                  // anchor below passwordField
  errors: { emailRequired: 'Enter your email', /* ... */ },
}
```

**2. Page actions** (`pages/<screen>/*.yaml`): reusable multi-step interactions, parameterised with `env`. Each action loads its own page object first, so it also works when run alone (Maestro MCP).

```yaml
- runFlow:
    file: ../../pages/sign-in/sign-in-with.yaml
    env: { EMAIL: "qa.user@example.com", PASSWORD: "Secret123" }
- assertVisible: ${output.signIn.errors.wrongCredentials}
```

How the layers fit:

| Layer | Contains | Example |
|---|---|---|
| Test (`flows/smoke`, `flows/regression`) | Scenario, assertions, screenshots | `REG-AUTH-01` |
| App subflows (`flows/common`) | App lifecycle and business flows | `launch-app`, `login` |
| Page actions (`pages/*/*.yaml`) | Steps on one screen; navigation ends with the next screen's `assert-displayed` | `sign-in-with`, `go-to-scan-code` |
| Page objects (`pages/*/*.page.js`) | Selectors and expected texts only | `output.signIn.submitButton` |

Rules:

- Every test starts with `onFlowStart: - runFlow: ../../pages/load-page-objects.yaml`. After that, any `${output.<page>.<name>}` can be used directly in `tapOn`, `assertVisible`, `below:` and waits.
- Single interactions can stay inline in a test (`tapOn: ${output.header.darkModeToggle}`). Anything with two or more steps, or used by more than one test, becomes a page action.
- Page actions do not assert outcomes for the caller. `assert-displayed.yaml` is the exception: it only confirms which screen is shown.
- Values are Maestro regexes written as JS strings, so escape special characters twice (`'Forgot password\\?'`).
- `env` passed to `runFlow` stays scoped to that call (verified), so actions can be reused with different data within one test.
- When the app gains `testID`s, only the page objects change. Use a separate key such as `emailFieldId: 'login-email'`, used with `id: ${output.signIn.emailFieldId}`.

**Adding a screen:** inspect it live (MCP `inspect_screen`, or `maestro hierarchy --compact`). Create `pages/<screen>/<screen>.page.js` and `assert-displayed.yaml`, add a `runScript` line to `pages/load-page-objects.yaml`, then write actions for the multi-step interactions.

## Scripts

| Script | Purpose | Key options |
|---|---|---|
| `doctor.ps1` | Checks every prerequisite, the device and the installed app; exit 1 if anything required fails | |
| `start-emulator.ps1` | Creates the AVD if needed, applies hardware settings, boots a visible window, waits for full boot, disables animations | `-Headless`, `-ColdBoot`, `-WipeData`, `-AvdName`, `-KeepAnimations` |
| `stop-emulator.ps1` | `adb emu kill`, waits, force-stops only as a fallback | `-Serial` |
| `install-apk.ps1` | Reads package and launch activity with `aapt`, installs or updates (`-r -d -g`), verifies, optionally launches | `-ApkPath`, `-Clean`, `-Launch` |
| `run-smoke.ps1` | Runs flows tagged `smoke` | `-Record` |
| `run-regression.ps1` | Runs flows tagged `regression` | `-Tags <tag>`, `-IncludeSmoke`, `-Record` |
| `run-single-test.ps1` | Runs one flow by path or partial name | `-Record` |
| `capture-evidence.ps1` | Screenshot, hierarchy, logcat, crash buffer, focus, optional screen recording | `-Label`, `-RecordSeconds` |
| `maestro-mcp.cmd` | Launcher used by `.mcp.json` | |
| `_common.ps1` | Shared helpers (config, tool lookup, device checks, the run/report engine) | |

All scripts run in Windows PowerShell 5.1. When the execution policy blocks them, use `powershell -ExecutionPolicy Bypass -File .\scripts\<name>.ps1`.

## What a run does (`Invoke-MaestroRun`)

1. Loads `config\.env.example`, then `config\.env`, then any same-named shell variables.
2. Picks the device (`$env:ANDROID_SERIAL`, or the single connected one), checks the boot is complete and the app is installed. Otherwise it stops with the command that fixes it.
3. Passes data to flows as `MAESTRO_*` variables. When no credentials are set, it excludes `requires-login` flows and reports them as **SKIPPED** with the reason.
4. Clears logcat, then runs `maestro test` with a JUnit report and a per-run output folder.
5. Saves the device logcat, the crash buffer, the final screen and any ANR events for the app, and redacts the test password from the text artefacts.
6. Writes `summary.md`, which lists **PASSED / FAILED / SKIPPED / NOT EXECUTED** separately. A flow that should have run but has no result is NOT EXECUTED, never PASSED.
7. Exits 0 only when every expected flow ran and passed.

## Evidence locations

| What | Where |
|---|---|
| Run summary | `reports\<yyyyMMdd-HHmmss>-<suite>\summary.md` |
| JUnit XML (CI) | `...\junit.xml` |
| Live console output | `...\maestro-console.txt` |
| Per-flow screenshots (`takeScreenshot`) | `...\artifacts\<ts>\<flow name>\takeScreenshot\` |
| Automatic failure screenshots | `...\artifacts\<ts>\<flow name>\screenshots\` |
| Executed commands with timings | `...\artifacts\<ts>\<flow name>\commands.json` |
| Maestro log and device log per flow | `...\artifacts\<ts>\<flow name>\logs\` |
| Video (`-Record`) | `...\artifacts\<ts>\<flow name>\startRecording\*.mp4` |
| Device log after the run | `...\logcat.txt`, `logcat.crash.txt` |
| App ANR events | `...\anr-events.txt` (only when there were any) |
| Manual captures | `reports\<ts>-evidence-<label>\`, `screenshots\` |
| Emulator output | `reports\emulator.log` |

## Conventions

- **Test IDs**: `SMK-nn` for smoke, `REG-<AREA>-nn` for regression (`AUTH`, `FORM`, `NAV`, …). The flow `name:` starts with the ID followed by the behaviour, for example `REG-AUTH-01 Sign-in rejects missing, malformed and unknown credentials`.
- **File names**: kebab-case, one feature area per file.
- **Tags**: `smoke` or `regression` (required); area tags such as `auth`, `validation`, `navigation`, `launch`; and `requires-login` for flows that need credentials.
- **Selectors**: only in page objects (see "Page Object Model" above and `.claude/rules/mobile-testing.md`). Build 1.0.0 has no resource-ids, so page objects use accessibility labels.
- **Page files**: `pages/<screen>/<screen>.page.js` sets `output.<screenCamelCase>`. Actions are verb-first (`enter-email`, `go-to-scan-code`, `assert-displayed`).
- **State**: every test starts with `common/launch-app.yaml` (`clearState: true`), so tests are independent and can run in any order.
