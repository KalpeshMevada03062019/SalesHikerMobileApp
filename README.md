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

**Phones that block adb installs (ColorOS / Realme, MIUI):** Appium normally installs its UiAutomator2 server on the device, and those phones hold the install behind a "risky app" prompt. `SKIP_SERVER_INSTALL=1` in `config\.env` (already set for the Realme phone) reuses the server that is already installed. To install a new server instead, approve the prompt on the phone (**View details > Install anyway**, for `io.appium.uiautomator2.server` and `.server.test`).

**Tests that send real WhatsApp messages** are switched off by default; without the switch they run every check and stop before sending (reported as skipped):

```powershell
$env:BROADCAST_SEND='true'; .\scripts\run-single-test.ps1 MBRD-020; Remove-Item Env:BROADCAST_SEND   # one broadcast to the allowlisted tag
$env:INBOX_SEND='true'; .\scripts\run-regression.ps1 -Grep MINB-01; Remove-Item Env:INBOX_SEND       # one template of each type to INBOX_RECIPIENT
```

Only one test command at a time: all runs share the same phone, and two runs end each other's sessions.

## Configuration

Copy `config\.env.example` to `config\.env` (git-ignored) and set:

- `TEST_USERNAME`, `TEST_PASSWORD`: a **beta** test account. Without them, tests that need a sign-in are reported as SKIPPED.
- `DEVICE_SERIAL`: the adb serial to use when several devices are connected.
- `APK_PATH`, `AVD_*`: APK and emulator settings.
- `SKIP_SERVER_INSTALL`: `1` to reuse the UiAutomator2 server on the phone (see above).
- `BROADCAST_SEND`, `BROADCAST_ALLOWLIST`, `BROADCAST_TAG`, `BROADCAST_TEMPLATE`: the broadcast send test (MBRD-020). The tag must be carried only by the allowlisted contacts.
- `INBOX_SEND`, `INBOX_RECIPIENT`: the Inbox send tests (MINB-010 … 018). The chat header must show exactly this number before every send.

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

### All-modules Allure report

`reports\allure\index.html` shows every module in one Allure report, built by `tools\allure\build-report.mjs`. It is rebuilt automatically after every test run:

- **Runner scripts** (`scripts\run-*.ps1`): always rebuilt, even with `-SkipWorkbooks` or when nothing ran.
- **Direct runs** (`npm test`, `npx wdio run ...`): the wdio `onComplete` hook first adds the run's results to the ledger and workbooks, then rebuilds the report.
- **By hand:** `npm run report`.

What the report shows:

- Each test shows its latest PASS/FAIL from `docs\test-execution-ledger.json`, the same result the workbooks use, with that run's screenshots and failure diagnostics. Up to 4 earlier runs appear under Retries, without attachments.
- **Suites** and **Behaviors** group tests by module and scenario. Smoke tests have severity *critical*.
- **Categories:** a failure linked to a defect shows the defect ID and tracker status, for example `[MLED-D01 Open]`. Other failures show their triage classification from the defect tracker.
- **Trend:** the trend charts build up from `reports\allure\history` with each rebuild.
- Each run folder still has its own `allure-report\index.html` for that run alone.

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

## Framework overview document (automatic)

`docs\SalesHiker_Mobile_QA_Automation_Framework.pdf` (and `.html`) is the team-facing overview: summary, tool stack, how it works, kinds of tests and safety rules, scope, results snapshot and an appendix. It follows the same layout as the web project's `SalesHiker_QA_Automation_Framework.pdf`.

- Every number is read from the repository when the document is built: tests in `test\specs`, results in the ledger, test cases and defects in `tools\excel\modules`, defect status from the tracker workbook, recent runs from `reports\`, and versions from `package.json` and Appium.
- The document is rebuilt automatically after every run, and by `npm run excel`. It is only rewritten when its content changed.
- `npm run docs:framework` rebuilds it by hand. `npm run docs:watch` rebuilds it whenever specs, page classes, modules or results change. `npm run docs:framework:check` exits 1 when the document is out of date.
- The PDF is printed with the installed Chrome or Edge (set `DOCS_BROWSER` to use another one), so no extra package is needed. The document never contains credentials, phone numbers or contact names.

## Test coverage

| Module | IDs | Specs |
|---|---|---|
| Login (sign-in, validation, session, sign-out, offline) | MLGN-001 … MLGN-024 | `smoke/app-launch`, `smoke/login`, `regression/login-*`, `session`, `network` |
| Navigation before sign-in | REG-NAV-01, REG-NAV-02 | `regression/navigation` |
| Campaigns: list, filters, search | MCMP-001 … MCMP-012 | `smoke/campaigns`, `regression/campaigns-list`, `regression/campaigns-search` |
| Campaigns: detail screen | MCMP-013 … MCMP-019 | `regression/campaign-detail` |
| Broadcasts: list, New Broadcast wizard, send | MBRD-001 … MBRD-012, MBRD-020 | `smoke/broadcasts`, `regression/broadcast-wizard`, `regression/broadcast-send` |
| Inbox: chat, Send Template sheet, one template per message type | MINB-001 … MINB-006, MINB-010 … MINB-018 | `smoke/inbox`, `regression/inbox-chat`, `regression/inbox-send-templates` |
| Pipeline (Deals): stages, search, Mine, deal detail, stage moves | MPIP-001 … MPIP-009, MPIP-020 … MPIP-022 | `smoke/pipeline`, `regression/pipeline-view`, `regression/pipeline-move` |

What the tests change:
- **Campaigns:** nothing. Campaign names are read from the live list at run time.
- **Broadcasts:** the wizard tests always Cancel or Discard. MBRD-020 sends one broadcast, only with `BROADCAST_SEND=true`.
- **Inbox:** MINB-010 … 018 send messages, only with `INBOX_SEND=true`, and only to `INBOX_RECIPIENT`.
- **Pipeline:** only the QA deal DL-100005, which is put back to Qualification after every test.

Some tests are **expected to fail** until their defect is fixed, because they assert the correct behaviour (current list: the "expected to fail" count in the framework PDF, or the guard tests in the defect tracker).

Free-form WhatsApp messages (text, attachments) and receiving are **not covered yet**: they need the recipient to message the business number first, so that the 24-hour window is open.

## Using Claude Code

`.claude/rules/mobile-testing.md` tells Claude how to work here: inspect the live app before writing selectors, run every test, never claim a pass without evidence, and keep test, environment and app issues apart.

## Documentation

- `docs\SETUP.md`: setup from scratch and troubleshooting
- `docs\FRAMEWORK_OVERVIEW.md`, `docs\TEST_STRATEGY.md`: architecture and scope
- `docs\DEFECT_TRACKER.md`: environment issues and observations, with evidence
- `docs\ENVIRONMENT_AUDIT.md`: what was found and installed on this PC
