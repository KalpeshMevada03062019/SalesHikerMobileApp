# Defect tracker

Only issues backed by observed evidence are listed. Each entry is classified as:

- **APP**: a confirmed application defect
- **OBS**: an application observation that needs product confirmation or reproduction
- **ENV**: a test-environment issue, not a product defect
- **TST**: a test-side issue, fixed in the framework

The build under test is `com.saleshiker.app` 1.0.0 (versionCode 1), from `saleshiker-beta-2026-10-28.apk`. Devices used:

- `SalesHiker_API37`: Android 17, Google Play image. Used first; unstable on this host, see ENV-003.
- `SalesHiker_API35`: Android 15, Google APIs image. The current default; healthy, with no ANRs or crashes in the final runs.

## Confirmed application defects (APP)

### APP-001: Sign-in request is sent even when client-side email validation fails (Low)

- **Area / build:** Sign-in, 1.0.0
- **Steps:** Launch from a clean state. Enter `not-an-email` as the email and `Secret123` as the password. Tap **Sign in**.
- **Expected:** The inline error "Enter a full email, like you@company.com." is shown and no sign-in request is made. The form already blocks submission when a field is empty: those errors appear without a "Signing in…" state.
- **Actual:** The inline error is shown, **and** the form submits anyway:
  - On API 35, the screenshot taken right after the tap shows the button as "Signing in…" with a spinner while the inline error is visible.
  - On API 37, after the request returned, a second banner, "Invalid email", appeared under the form. The user sees two messages for one problem, and the backend receives a request the client already knew was invalid.
- **Reproducibility:** 2 of 2 devices (API 37 exploration on 2026-10-29 at 13:10; API 35 final regression run). The API 35 device was healthy: no `am_anr` and no crashes in that run.
- **Evidence:**
  - `reports\20261029-142408-regression\artifacts\2026-10-29_142411\REG-AUTH-01 Sign-in rejects missing, malformed and unknown credentials\takeScreenshot\REG-AUTH-01-malformed-email.png` ("Signing in…" alongside the inline error)
  - API 37: the inline error plus the "Invalid email" banner, seen in the exploration run (scratch evidence, not kept in `reports\`). Re-capture it with `.\scripts\capture-evidence.ps1` when filing.
- **Test:** REG-AUTH-01 asserts the inline message only, so it passes either way. To guard the fix, add `assertNotVisible: "Signing in.*"` after the tap once product confirms the expected behaviour.

## Observations needing confirmation (OBS)

### OBS-002: Native crash in the app's RenderThread on an unstable emulator

- **Area:** App stability
- **Observed:** On 2026-10-29 at 13:48:52, `Fatal signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x4 in tid RenderThread, pid 5391 (.saleshiker.app)`.
- **Why not APP:** It happened while SystemUI was crash-looping inside the Android runtime (ENV-003). The device was unhealthy, so the crash cannot be attributed to the app.
- **Next step:** Watch `logcat.crash.txt` in every run folder. Promote this to APP only if a SalesHiker native crash happens on a healthy device (no other process crashing).

### Testability note: no resource-ids or testIDs

The app exposes no `resource-id`s and no React Native `testID`s. The tests rely on accessibility labels, which change whenever copy or localisation changes. **Recommendation:** add `testID` to the sign-in inputs, buttons and links (for example `login-email`, `login-password`, `login-submit`). Maestro can then use `id:` selectors.

## Environment issues (ENV)

| ID | Issue | Evidence | Status |
|---|---|---|---|
| ENV-001 | ANRs (including "Saleshiker isn't responding") on the default AVD with 2 vCPU, 2 GB RAM and a software GPU | `am_anr` for systemui, phone, gms and vending before the app was touched; the app's ANR reason was "Application does not have a focused window" | Fixed: AVD set to 4 vCPU / 4 GB / host GPU via `config\.env`. The app ran without ANR afterwards |
| ENV-002 | A "Pixel Launcher isn't responding" dialog covered the app during the SMK-01 `-Record` run | `reports\20261029-134130-single-app-launch\...\step-012-*.png`: the app renders correctly underneath | Mitigated: `launch-app.yaml` taps "Wait" on other apps' ANR dialogs, never on Saleshiker's own |
| ENV-003 | SystemUI crash loop in ART on the API 37 Play image; afterwards a cold boot never came online | crash buffer: `Check failed: method->GetDexFile()->IsInDataSection(handlers_ptr) ... SystemUIGoogle.apk`, repeating every ~4 s | Resolved: default AVD switched to `SalesHiker_API35` (Google APIs, approved). Final smoke and regression runs there had 0 ANR events and 0 crashes |
| ENV-006 | After about 2 h of uptime, Maestro could not install its driver: `NullPointerException ... PackageManagerInternal.freeStorage ... StorageManagerService.allocateBytes`; `dumpsys package` returned no version. A normal restart restored the same state from the quick-boot snapshot | `reports\20261029-164123-single-login-smoke\maestro-console.txt` | Fixed by `start-emulator.ps1 -ColdBoot`. The runner now detects the missing version and stops with that advice |
| ENV-004 | The Scan-a-code camera preview is black | screenshot `REG-NAV-01-scan-screen.png` | Expected on an emulator without a configured camera. QR scanning is out of scope |
| ENV-005 | Browser hand-offs land on Chrome's first-run screen, which hides the destination page | `REG-NAV-01-forgot-password-handoff.png` | Known limitation. Tests assert the hand-off only |

## Test-side issues (TST), fixed

| ID | Issue | Fix |
|---|---|---|
| TST-001 | `"New here\? ..."` in a double-quoted YAML string failed to parse | Regex selectors use single quotes |
| TST-002 | "Sign in" matched the title, the button and its label | Button anchored with `below: "Password"` |
| TST-003 | Maestro driver start-up timeout on this host | `MAESTRO_DRIVER_STARTUP_TIMEOUT=180000` |
| TST-004 | POM refactor: `eraseText` in `enter-email` left the keyboard closed, then `hideKeyboard` sent BACK and closed the app (3 flows failed on "Password" not found; the screenshot showed the home screen) | `eraseText` removed (fields are always empty after `launch-app`); the pitfall is documented in the action and the rules |

## Template for new entries

```
### APP-nnn: <short title>
- Area / build / device:
- Preconditions:
- Steps:
- Expected (and why):
- Actual:
- Reproducibility: x/y runs, device healthy (no other am_anr / crashes): yes/no
- Evidence: reports\<run>\... (screenshot, commands.json step, logcat lines)
- Test: <flow ID>, left failing on purpose
```
