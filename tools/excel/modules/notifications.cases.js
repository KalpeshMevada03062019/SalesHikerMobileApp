// Mobile Notification test cases (More > WORKSPACE > Notifications, the bell on the More screen, Settings >
// Notifications and Devices, Android push), SalesHiker Android 1.0.0. Expected results come from the live app on the
// Realme RMX3997 (2026-11-20). Read only: nothing is changed in the app or in Android settings. MNTF-007 runs only with
// NOTIFY_WAIT=1, while someone sends a WhatsApp message to the workspace number.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in.';
const tc = (fields) => ({ req: 'REQ-MNTF-01', input: 'Test account from config\\.env.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MNTF-01', scenario: 'Notification list', id: 'MNTF-001', title: 'Notifications opens from More with each notification showing a title, date and text',
    steps: '1. More > Notifications.', type: 'Smoke', design: 'Positive',
    expected: '"Notifications" with rows of title, date and text, then "End of list".', observed: '2 notifications: "Tally Prime needs attention" (22 Oct) and "QA mentioned you in a note" (28 Sep).' }),
  tc({ ts: 'TS-MNTF-01', scenario: 'Notification list', id: 'MNTF-002', title: 'The bell on the More screen opens the same notifications as the More entry',
    steps: '1. More > Notifications; read.\n2. Restart; More > bell; read.', type: 'Functional', design: 'Validation',
    expected: 'The same notifications in the same order both ways.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MNTF-01', scenario: 'Notification list', id: 'MNTF-003', title: 'A mention notification opens the chat where the note was written and Back returns to the list',
    steps: '1. More > Notifications.\n2. Tap "QA mentioned you in a note".\n3. Back to Inbox.', type: 'Functional', design: 'Validation',
    expected: 'The chat opens with its composer; Back returns to Notifications with the mention still listed. Nothing is sent.', observed: 'Opens the Kalpesh Mevada chat (exploration).' }),
  tc({ ts: 'TS-MNTF-02', scenario: 'Notification settings', id: 'MNTF-004', title: 'Notification settings show push on for this phone and what it covers',
    steps: '1. More > Settings > Notifications.', type: 'Functional', design: 'Validation',
    expected: 'THIS PHONE: "Push notifications, On"; Open system settings; "New chats, assignments and mentions arrive as push notifications while the app is closed."; the web note about sound and desktop reminders.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MNTF-02', scenario: 'Notification settings', id: 'MNTF-005', title: 'Open system settings shows the Android notification setting of the app and Back returns to the app',
    steps: '1. More > Settings > Notifications > Open system settings; read.\n2. Back.', type: 'Functional', design: 'Validation',
    expected: 'Android "App info" for Saleshiker with "Manage notifications: Allow" (Force stop / Uninstall not tapped); Back returns to the app with push still On.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MNTF-02', scenario: 'Notification settings', id: 'MNTF-006', title: 'Devices lists this phone as signed in',
    steps: '1. More > Settings > Devices.', type: 'Functional', design: 'Validation',
    expected: 'SIGNED IN lists "realme RMX3997, Android 16" marked "This device" (Sign out not tapped).', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MNTF-03', scenario: 'Incoming push', id: 'MNTF-007', title: 'An incoming WhatsApp message raises a push while the app is in the background',
    steps: '1. Open the app signed in; press Home (the app stays in the background).\n2. From an allowlisted phone, send one WhatsApp message to the workspace number.\n3. Wait up to NOTIFY_WAIT_MINUTES for a SalesHiker notification (Android notification list).', input: 'NOTIFY_WAIT=1; one WhatsApp message from an allowlisted phone', type: 'Functional', design: 'Positive',
    expected: 'A SalesHiker push on the "messages" channel with the sender and message (Settings: "New chats, assignments and mentions arrive as push notifications while the app is closed.").',
    observed: 'By hand 2026-11-20 15:40: the message reached the Kalpesh Mevada chat (assigned to Yash G., auto-reply sent 15:41) but no push was posted within 14.5 min and no in-app notification was added. Reported again by the tester (MNTF-D01).', defect: 'MNTF-D01' }),
];
