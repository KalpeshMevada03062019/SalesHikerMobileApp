# Mobile UI testing rules (SalesHiker Android)

These rules apply to all work in this repository: writing, running, debugging and reporting the TypeScript tests (WebdriverIO + Appium UiAutomator2, Mocha, Chai).

## Inspect before you write

- Inspect the live app before you write or change any selector. Never guess a locator or an expected text.
- Dump the screen with adb: `adb shell uiautomator dump`, then pull the XML; `reports\explore-campaign\dump.ps1 <name>` saves the XML and a screenshot and lists the labelled nodes. Appium's page source (saved in `failures\<test>\page-source.xml`) shows the same tree.
- Read both the hierarchy and a screenshot. The hierarchy tells you what is selectable. The screenshot tells you what a user actually sees, such as overlays, dialogs, the keyboard or a half-open sheet.
- UiAutomator only sees on-screen elements: scroll a sheet, list or chip row before deciding something is missing.
- When a web reference is asked for, compare with the web app (beta workspace) read-only.

## Selectors

- Build 1.0.0 exposes **no resource-ids**. Use accessibility labels (`~Label`, content-desc), then `UiSelector` text/description, then XPath anchored on a label. Coordinates only as a documented last resort.
- WebdriverIO 10 is strict: `$()` fails when a selector matches several elements. Use `(xpath)[1]` or a narrower selector.
- `enforceXPath1` is on (wdio config). In UiSelector regexes write `[0-9]` and `[.]`, not `\\d` or `\\.`: Appium does not unescape them.
- Selectors and expected texts live **only** in page classes (`src/pages/*.ts`). Specs use page methods; test inputs live in `src/data/testData.ts`.

## Writing tests

- Specs go in `test/specs/smoke` or `test/specs/regression`. Every `it()` title starts with its ID (`MLGN-001`, `MCMP-012`, `MBRD-020`, `MINB-010`, `MPIP-020`, `REG-NAV-01`) and is a **literal string**. Do not build titles in loops, and do not use apostrophes: the runner and the workbooks read titles from the source.
- Signed-in specs call `requiresAccount()` and start from `launchSignedIn()` (or a module helper in `test/helpers`).
- Assert outcomes the user can observe. Add `checkpoint()` screenshots at key states. Wait with explicit timeouts for anything network-bound; no fixed sleeps to hide slowness.
- Data-dependent tests call `skipBecause(this, reason)` when the account lacks the data; they never pass silently.
- Add each new test case to `tools\excel\modules\<module>.cases.js` (and defects to `.defects.js`) with the same ID and title.

## Running and proving results

- Run every new or changed test with `.\scripts\run-single-test.ps1 <ID>`, then its module (`.\scripts\run-regression.ps1 -IncludeSmoke -Grep <prefix>`).
- One test command at a time: all runs share the phone, and parallel runs end each other's sessions.
- Never call a test passed without execution evidence: a run folder `reports\<timestamp>-*\` with `summary.md`, `results.json` and artifacts. Quote the actual counts (passed / failed / skipped / not executed).
- Report skipped and not-executed tests separately from failures.
- Every run updates the workbooks and `docs\SalesHiker_Mobile_QA_Automation_Framework.pdf`; do not edit those files by hand.

## Classifying failures

Keep these three categories separate:

1. **Test-side issue**: wrong selector, missing wait, bad test data, strict-mode match. Fix the test.
2. **Environment issue**: device unauthorized/offline, Appium session lost, the ColorOS install prompt, system-wide ANRs. The runner reports these as NOT EXECUTED. These are not product defects.
3. **Application defect**: behaviour that contradicts the app's own UI, the web app, or reasonable user expectations, **reproduced at least twice**. Log it in `tools\excel\modules\<module>.defects.js` with steps, expected vs actual and evidence, link its guard test, and leave that test failing.

- Re-check by hand anything that "passes" or "fails" against what you saw live, before reporting it. Withdraw a defect that does not reproduce.
- Never change an assertion just to make a failing test pass when the app is wrong.

## Safety

- The APK points to the **beta** backend (`accountsbeta.saleshiker.com`). Never use production.
- **Real WhatsApp messages** only with the switch on (`BROADCAST_SEND`, `INBOX_SEND`), only to the allowlisted numbers in `config\.env`, and only after the tests' own recipient checks. Never choose "All contacts". Send once, never retry.
- **Data changes** only on records the user approved: the QA deal DL-100005 (always restored to Qualification), the allowlist contacts and tag. Ask before creating, editing or deleting anything else.
- Do not tap through phone security prompts (for example "Install anyway") yourself; ask the user.
- Do not run destructive device commands (factory reset, `pm clear` of other apps, uninstalling anything but the app under test) without asking. Restore phone settings you change (stay-awake).
- Never hard-code or print credentials, tokens or real customer data. `config\.env`, `reports\` and `screenshots\` stay out of commits and chats.
