// Mobile Login defects / observations, backed by observed evidence only.
// `evidenceShots` are screenshot file names looked up in the given run folder; `evidence` is fixed text.
// Columns P-U (Assigned To, Closed by, Requested by, Developer Comment, Closed Date) and Status
// are kept from the existing workbook when the generator is re-run, so manual triage is not lost.
module.exports = [
  {
    id: 'MLGN-D01',
    category: 'Validation',
    title: 'Sign-in request is sent even though the email failed the app\'s own format check',
    steps: '1. Launch the app (signed out).\n2. Email: not-an-email\n3. Password: Secret123\n4. Tap "Sign in".',
    expected: 'Only the inline error "Enter a full email, like you@company.com." is shown and no request is made, the same way empty fields are blocked (MLGN-008).',
    actual: 'The inline error is shown, but the form is submitted anyway: the button changes to "Signing in..." and the server then answers with a second banner, "Invalid email". The user sees two messages for one problem, and the backend receives a request the client already knew was invalid. Also seen with the SQL-injection input (MLGN-013).',
    issueType: 'Bug', severity: 'Low', priority: 'P4 - Low', status: 'Open',
    evidenceShots: ['MLGN-012-right-after-submit.png', 'MLGN-012-after-10s.png'],
    qaComment: 'Automated test: MLGN-012 (.maestro/flows/regression/login-malformed-email-not-sent.yaml). Reproduced on Android 15 (API 35) and Android 17 (API 37) emulators. The test is left failing on purpose until this is fixed.',
  },
  {
    id: 'MLGN-D02',
    category: 'Validation',
    title: 'No client-side length check on the email field',
    steps: '1. Launch the app (signed out).\n2. Email: 250 x "a" + "@example.com"\n3. Password: Secret123\n4. Tap "Sign in".',
    expected: 'The app rejects an address whose part before "@" exceeds 64 characters (RFC 5321) before sending it, or caps the field length.',
    actual: 'The full value is accepted and sent; the server replies "Email or password is wrong.". No crash, and the generic message is acceptable, but invalid input still reaches the backend.',
    issueType: 'Observation', severity: 'Low', priority: 'P4 - Low', status: 'Needs Decision',
    evidenceShots: ['MLGN-015-rejected.png'],
    qaComment: 'Automated test: MLGN-015 passes (it checks that the app copes safely). Product to decide whether a client-side limit is wanted.',
  },
  {
    id: 'MLGN-D03',
    category: 'Testability',
    title: 'Sign-in controls have no testID / resource-id',
    steps: '1. Open the sign-in screen.\n2. Inspect the view hierarchy (maestro hierarchy, or uiautomator dump).',
    expected: 'Inputs, buttons and links expose stable ids (React Native testID), e.g. login-email, login-password, login-submit.',
    actual: 'No app resource-ids exist. Automation has to use accessibility labels, which change with copy or localisation.',
    issueType: 'Enhancement', severity: 'Low', priority: 'P4 - Low', status: 'Open',
    evidenceShots: [],
    evidence: 'Hierarchy dump: reports/*-evidence-*/hierarchy.csv (no com.saleshiker.app:id/* except action_bar_root)',
    qaComment: 'Not a functional defect. Once ids are added, only the page objects in .maestro/pages/ need updating.',
  },
  {
    id: 'MLGN-D04',
    category: 'Stability',
    title: 'Native crash (SIGSEGV in RenderThread) seen once on an unstable emulator',
    steps: 'Seen once on 2026-10-29 13:48 on the Android 17 (API 37) Google Play emulator while its SystemUI was crash-looping. No reliable steps yet.',
    expected: 'The app does not crash.',
    actual: 'logcat: "Fatal signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x4 in tid RenderThread (.saleshiker.app)".',
    issueType: 'Observation', severity: 'Medium', priority: 'P3 - Medium', status: 'Needs Decision',
    evidenceShots: [],
    evidence: 'docs/DEFECT_TRACKER.md (OBS-002); device crash buffer of the API 37 emulator',
    qaComment: 'Not reproduced on the healthy Android 15 emulator in any login run (0 crashes). Not attributed to the app yet: the device itself was failing. Every run saves logcat.crash.txt, so watch for a repeat.',
  },
];
