# SalesHiker mobile QA automation

Native Android UI tests for the SalesHiker app (`com.saleshiker.app`), written in **TypeScript** with **WebdriverIO + Appium (UiAutomator2)**, **Mocha** and **Chai**, using class-based page objects. They run on a real phone over USB or on an emulator, driven from PowerShell, with no Android Studio. After every run, the test-case and defect workbooks in `docs\` are updated automatically.

## Quick start

```powershell
npm install                                   # once: project dependencies
npm install -g appium; appium driver install uiautomator2    # once: Appium server and driver
adb devices                                   # phone or emulator must show "device"
npm run typecheck                             # TypeScript check
.\scripts\run-smoke.ps1                       # smoke suite
.\scripts\run-regression.ps1                  # regression suite
```

If scripts are blocked by the execution policy, use `powershell -ExecutionPolicy Bypass -File .\scripts\<script>.ps1`.

## All commands

| Action | Command |
|---|---|
| Smoke suite | `.\scripts\run-smoke.ps1` |
| Regression suite | `.\scripts\run-regression.ps1` |
| Everything | `.\scripts\run-regression.ps1 -IncludeSmoke` |
| One module (by ID prefix) | `.\scripts\run-regression.ps1 -IncludeSmoke -Grep MCMP` (Campaigns) or `-Grep MLGN` (Login) |
| One test | `.\scripts\run-single-test.ps1 MCMP-012` |
| One spec file | `.\scripts\run-single-test.ps1 campaigns-search` |
| Run without updating the workbooks | add `-SkipWorkbooks` to any run script |
| Rebuild the workbooks from recorded results | `npm run excel` |
| Add one run folder to the workbooks by hand | `npm run excel -- reports\<run folder>` |
| Plain WebdriverIO (no summary or workbooks) | `npx wdio run ./config/wdio.android.conf.ts --spec ./test/specs/smoke/campaigns.spec.ts` |
| Start / stop emulator | `.\scripts\start-emulator.ps1` / `.\scripts\stop-emulator.ps1` |
| Install / update the APK | `.\scripts\install-apk.ps1 [-ApkPath <apk>]` |

**Phones that block adb installs (ColorOS / Realme, MIUI):** Appium normally installs its UiAutomator2 server on the device, and those phones hold the install behind a "risky app" prompt. Either approve it on the phone (**View details > Install anyway**, for `io.appium.uiautomator2.server` and `.server.test`), or reuse the server that is already installed:

```powershell
$env:SKIP_SERVER_INSTALL = '1'; .\scripts\run-smoke.ps1
```

## Configuration

Copy `config\.env.example` to `config\.env` (git-ignored) and set:

- `TEST_USERNAME`, `TEST_PASSWORD`: a **beta** test account. Without them, tests that need a sign-in are reported as SKIPPED.
- `DEVICE_SERIAL`: the adb serial to use when several devices are connected.
- `APK_PATH`, `AVD_*`: APK and emulator settings.

## Project layout

```
config/wdio.android.conf.ts   WebdriverIO + Appium config, reporters, failure hooks
src/config/settings.ts        reads config\.env
src/pages/                    page objects: BasePage, LoginPage, HomePage, MorePage, ScanCodePage,
                              CampaignsPage, CampaignDetailPage (selectors and texts live only here)
src/utils/                    adb, app lifecycle (launchFresh, launchSignedIn), evidence capture
src/data/testData.ts          test inputs (no real data; the account comes from config\.env)
test/specs/smoke|regression   Mocha specs; every test title starts with its ID (MLGN-nnn, MCMP-nnn)
scripts/                      PowerShell runners (summary.md, Allure HTML report, workbook update)
tools/excel/                  workbook generator; test cases and defects per module in modules/
docs/                         workbooks, results ledger, setup and strategy documents
```

## Results and evidence

Each run writes `reports\<timestamp>-<name>\`:

- `summary.md`: passed / failed / skipped / not executed. Environment aborts (lost device or Appium session) count as **not executed**, never as failed.
- `allure-report\index.html`: HTML report with screenshots.
- `junit-*.xml` (one per spec), `results.json`, `wdio-console.txt`, `appium.log`, `logcat.txt`.
- `screenshots\`: checkpoint screenshots, named after the test ID.
- `failures\<test>\`: screenshot, UI hierarchy, foreground app and logcat for each failed test.

`reports\` can contain personal data from the app and is git-ignored.

## Test-case and defect workbooks (automatic)

After each run, `tools\excel\update-workbooks.js` updates:

- `docs\SalesHiker_Mobile_Test_Cases.xlsx`: one sheet per module (Login, Campaigns) with Actual Result, evidence link, Status, iteration, date and history, plus a Summary sheet built from formulas.
- `docs\SalesHiker_Mobile_Defect_Tracker.xlsx`: one sheet per module, plus **Failures to triage** and a Summary sheet.

How the update works:

- Results go into `docs\test-execution-ledger.json`, keyed by test ID. Running one test updates only that row; other results stay. A run folder is never counted twice.
- PASS and FAIL replace a test's last result. SKIPPED and NOT EXECUTED do not: they are added to Comments.
- Defects keep their Status and manual columns (Assigned To, Developer Comment, ...) between updates. A defect linked to a guard test moves automatically when that test has a new result:
  - guard fails and the defect is Closed or Ready for Retest → **Reopened**;
  - guard passes and the defect is Open, Reopened or In Progress → **Ready for Retest**.

  "Needs Decision" and "Won't Fix" are never changed, and closing a defect is always manual.
- A failed test with no linked defect is listed under **Failures to triage**, where a person classifies it as a test-side issue, environment issue or application defect. The tool never creates defects on its own.
- To change the wording of a test case or defect, edit `tools\excel\modules\<module>.cases.js` / `.defects.js`, not the workbook. To add a module, add those two files and list them in `modules\index.js`.
- If a workbook is open in Excel, the results are still saved in the ledger. Close Excel and run `npm run excel`.

## Test coverage

| Module | IDs | Specs |
|---|---|---|
| Login (sign-in, validation, session, sign-out, offline) | MLGN-001 … MLGN-024 | `smoke/app-launch`, `smoke/login`, `regression/login-*`, `session`, `network` |
| Navigation before sign-in | REG-NAV-01, REG-NAV-02 | `regression/navigation` |
| Campaigns: list, filters, search | MCMP-001 … MCMP-012 | `smoke/campaigns`, `regression/campaigns-list`, `regression/campaigns-search` |
| Campaigns: detail screen | MCMP-013 … MCMP-019 | `regression/campaign-detail` |

Campaign tests only read data: they never create, pause or edit campaigns. Campaign names come from the live list at run time, so the tests keep working when beta data changes.

Some tests are **expected to fail** until their defect is fixed, because they assert the correct behaviour: MLGN-012 (MLGN-D01), MCMP-012 (MCMP-D02) and MCMP-019 (MCMP-D01).

## Using Claude Code

`.claude/rules/mobile-testing.md` tells Claude how to work here: inspect the live app before writing selectors, run every test, never claim a pass without evidence, and keep test, environment and app issues apart.

## Documentation

- `docs\SETUP.md`: setup from scratch and troubleshooting
- `docs\FRAMEWORK_OVERVIEW.md`, `docs\TEST_STRATEGY.md`: architecture and scope
- `docs\DEFECT_TRACKER.md`: environment issues and observations, with evidence
- `docs\ENVIRONMENT_AUDIT.md`: what was found and installed on this PC
