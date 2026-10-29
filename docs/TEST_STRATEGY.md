# Test strategy

## Scope

| In scope | Out of scope (for now) |
|---|---|
| Native Android UI of SalesHiker (`com.saleshiker.app`), through the real UI | Backend APIs (only exercised through the UI) |
| Sign-in screen, field validation, error handling, theme toggle, Scan-a-code screen, hand-off to web pages | Content of the external web pages (`accountsbeta.saleshiker.com`) |
| Post-login workflows, once a test account is available | QR scanning itself (the emulator has no real camera input) |
| | iOS, performance, security and load testing |

Everything runs against the **beta** backend that the APK is built for.

## Suites

| Suite | Purpose | Target time | When to run |
|---|---|---|---|
| Smoke (`smoke`) | Can the build start and does sign-in work? | < 5 min | Every new APK, before anything else |
| Regression (`regression`) | Behaviour of each feature area, including negative paths | < 15 min | Before release; after changes in an area (`-Tags auth`) |

## Coverage

All expected texts were taken from the running app (build 1.0.0, 2026-10-28), not from specifications.

| ID | Flow | Covers | Needs login |
|---|---|---|---|
| SMK-01 | `smoke/app-launch.yaml` | App starts from a clean state; logo, title, both fields, password toggle, Sign in, Forgot password, Scan a code, Create workspace and theme toggle are shown | no |
| SMK-02 | `smoke/login-smoke.yaml` | Valid beta account signs in and lands on the Home ("Today") dashboard | **yes** |
| REG-AUTH-01 | `regression/login-validation.yaml` | Empty submit shows "Enter your email" and "Enter your password"; malformed email shows "Enter a full email, like you@company.com."; unknown account shows "Email or password is wrong."; the user stays on sign-in each time | no |
| REG-FORM-01 | `regression/form-validation.yaml` | Each field validates on its own (email only gives the password error only, and vice versa); the password is masked by default; Show/Hide password toggles it | no |
| REG-NAV-01 | `regression/navigation.yaml` | Scan-a-code screen opens with instructions and Back returns; dark/light toggle switches and its label follows; Forgot password and Create workspace hand off to the browser | no |

### Not yet covered

- **Workflows after sign-in.** SMK-02 confirms that the Home ("Today") dashboard loads. The Home screen shows an unread-chats ring, follow-ups, a week calendar, a "New Task" action and a bottom navigation bar with six icons. None of these are tested yet. Each must be inspected live and given a page object before tests are written.
- Error messages clearing after the user corrects a field (not yet observed).
- Offline and slow-network behaviour.
- The destination of browser hand-offs. Chrome's first-run screen hides the page; only the hand-off itself is asserted.
- Deep links (none identified yet).

## Test design rules

- Page Object Model: selectors and expected messages live in `.maestro/pages/*/*.page.js`, and reusable steps in page actions (see `FRAMEWORK_OVERVIEW.md`). Tests contain scenarios and assertions only.
- One feature area per file. Scenarios inside a file restart the app with `launch-app.yaml`, so a failure screenshot always shows a known starting point.
- Assert what the user sees (text, screen change, label state), and take a screenshot at each meaningful state.
- Negative tests use reserved `example.com` addresses. No test creates accounts, workspaces or password-reset emails.
- Waits are explicit (`extendedWaitUntil` with a timeout). There are no fixed sleeps.

## Entry and exit criteria

- **Entry**: `doctor.ps1` passes, the emulator is booted, and the APK is installed (`install-apk.ps1`).
- **Exit (release candidate)**: the smoke suite passes 100%; regression has no FAILED and no NOT EXECUTED tests; every failure is classified (test, environment or app); and confirmed app defects are logged in `DEFECT_TRACKER.md`.

## Failure triage

1. Open `summary.md`, then the flow's failure screenshot under `artifacts\...\screenshots\`.
2. Check `commands.json` to see which step failed and how long each step took.
3. Check `logcat.txt` and `anr-events.txt`. Run `adb logcat -d -b events | findstr am_anr` to see whether *other* processes also ANR'd (that means environment starvation).
4. Re-run the single test: `.\scripts\run-single-test.ps1 <name> -Record`.
5. Classify the failure as a test issue, an environment issue or an app defect (see `.claude/rules/mobile-testing.md`). Log app defects only once they reproduce on a healthy device.

## Environment risks on this workstation

The 4-core host and Google Play system images are heavy. The run of 2026-10-29 saw system-app ANRs and a SystemUI crash loop on the API 37 Play image (see `ENVIRONMENT_AUDIT.md`). Treat a sudden step-time increase (for example `launchApp` > 15 s) as an environment signal and restart the emulator before trusting results.
