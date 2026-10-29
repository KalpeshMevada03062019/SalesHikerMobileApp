# Mobile UI testing rules (SalesHiker Android)

These rules apply to all work in this repository: writing, running, debugging and reporting Maestro tests.

## Inspect before you write

- Inspect the live app before you write or change any selector. Never guess a locator or an expected text.
- Use the Maestro MCP server (`.mcp.json`, server `maestro`) when it is available: `inspect_screen` for the view hierarchy, `take_screenshot` to see the screen, `run` to try commands inline, `cheat_sheet` for syntax.
- Without MCP, use the CLI: `maestro --device <serial> hierarchy --compact`, and `.\scripts\capture-evidence.ps1 -Label <name>` for a screenshot and hierarchy.
- Read both the hierarchy and a screenshot. The hierarchy tells you what is selectable. The screenshot tells you what a user actually sees, such as overlays, ANR dialogs, the keyboard or the external browser.

## Selectors

- Preference order: `id:` (resource-id or React Native `testID`), then accessibility label (`text:` matches `accessibilityText`), then visible text, then a relative position (`below:`, `above:`, `childOf:`). Use `index:` and coordinates (`point:`) only as a documented last resort.
- Build 1.0.0 exposes **no app resource-ids**. Every control has an accessibility label (`Email address`, `Password`, `Show password`, `Sign in`, `Back`, …). Use those labels. If the app gains `testID`s, switch to `id:`.
- Maestro `text` is a full-match regex. Escape `? . ( ) [ ] *` and write such patterns in single quotes: `'Forgot password\?'`.
- Several elements match "Sign in" (title, button, button label). Anchor the button below the password field; `pages/sign-in/submit.yaml` already does this.

## Page Object Model (mandatory)

- Selectors and expected texts live **only** in page objects: `.maestro/pages/<screen>/<screen>.page.js`, which sets `output.<screen>`. Tests and actions refer to them as `${output.signIn.emailField}`. Never put a raw UI string in a test.
- Multi-step or shared interactions are page actions: `.maestro/pages/<screen>/<verb>.yaml`, parameterised with `env`. Each action starts with `runScript: <screen>.page.js`. Navigation actions end by running the next screen's `assert-displayed.yaml`.
- For a new screen: inspect it live, then create the `.page.js` and `assert-displayed.yaml`, and register the script in `pages/load-page-objects.yaml`.
- When the app changes, fix the page object first. A label change must be a one-line edit.
- Avoid `eraseText` before `hideKeyboard`. On a root screen, `hideKeyboard` with no keyboard open sends BACK and closes the app (this happened once already).

## Writing flows

- Put tests in `.maestro/flows/smoke` or `.maestro/flows/regression`, and app-level subflows in `.maestro/flows/common`. Start every test with `runFlow: ../common/launch-app.yaml` (clean state, sign-in screen).
- Header: `appId: ${MAESTRO_APP_ID || 'com.saleshiker.app'}`, a `name:` in the form `<ID> <behaviour>` (`SMK-nn`, `REG-<AREA>-nn`), `tags:` (always `smoke` or `regression`; add `requires-login` when credentials are needed), and `onFlowStart` with `../../pages/load-page-objects.yaml` plus the recording hooks used by the existing flows.
- Assert outcomes the user can observe (text, navigation, element state), not just that a tap succeeded. Add a `takeScreenshot` at each key state.
- Use `extendedWaitUntil` with an explicit timeout for anything network-bound. Never add fixed sleeps to hide slowness.
- Test data comes from `config\.env` as `MAESTRO_*` variables. Never hard-code credentials, tokens or real customer data in flows, docs or commit messages. Use `example.com` addresses for invented accounts.

## Running and proving results

- Run every new or changed flow with `.\scripts\run-single-test.ps1 <name>` before reporting it. Then run the suite it belongs to.
- Never call a test passed without execution evidence: a run in `reports\<timestamp>-*\` with `summary.md`, `junit.xml` and artifacts. Quote the actual counts (passed / failed / skipped / not executed).
- Report skipped and not-executed tests separately from failures. Never fold them into "passed".

## Classifying failures

Keep these three categories separate in reports and in `docs\DEFECT_TRACKER.md`:

1. **Test-side issue**: wrong selector, missing wait, bad test data, or a flow-syntax error. Fix the test.
2. **Environment issue**: device not booted, Maestro driver timeout, emulator resource starvation (system-wide ANRs), missing camera, or the Chrome first-run screen. Fix or document the environment. These are not product defects.
3. **Application defect**: behaviour that contradicts the app's own UI or reasonable user expectations, reproduced at least twice on a healthy device. Log it with steps, expected vs actual, build and device, and evidence paths.

- Never change an assertion just to make a failing test pass when the app is wrong. Leave the test failing and log the defect.
- Before calling an ANR or crash an app defect, check `logcat -b events` for `am_anr` in *other* processes. If system apps also ANR, it is environment starvation.

## Safety

- The APK points to the **beta** backend (`accountsbeta.saleshiker.com`). Do not run flows against production, and do not create workspaces, send password resets or change data unless the user explicitly asks.
- Do not run destructive device commands (factory reset, `pm clear` of other apps, `adb uninstall` of anything but the app under test) without asking.
- `reports\` and `screenshots\` can contain personal data from the app. They are git-ignored; keep them out of commits and chats.
