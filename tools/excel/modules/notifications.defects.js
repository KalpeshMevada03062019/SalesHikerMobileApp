// Mobile Notifications defects / observations (live app 2026-11-20, Realme RMX3997, Android 16).
module.exports = [
  {
    id: 'MNTF-D01',
    category: 'Push notifications',
    title: 'No push notification is shown when a WhatsApp message is received while the app is in the background',
    steps: '1. Sign in to the app; check More > Settings > Notifications: "Push notifications, On"; Settings > Devices lists this phone as "This device".\n2. Android App info > Saleshiker: Manage notifications "Allow".\n3. Press Home (the app stays in the background, not force-stopped).\n4. From an allowlisted phone, send a WhatsApp message to the workspace number.\n5. Wait 10-15 minutes and watch the Android notification shade.',
    expected: 'A SalesHiker push with the sender and message within a few seconds, as the app promises: "New chats, assignments and mentions arrive as push notifications while the app is closed."',
    actual: 'The message reaches the Inbox (Kalpesh Mevada chat, assigned to Yash G.; the auto-reply "Thanks for message" went out at 15:41) but no notification is posted: Android lists no SalesHiker notification at all (adb dumpsys notification, pkg com.saleshiker.app: 0) after 14.5 minutes, and no in-app notification is added under More > Notifications.',
    images: [
      { file: 'docs/defect-evidence/phone/MNTF-D01-message-1540-no-push.png', caption: 'Phone: message received 15:40 in the Inbox (auto-reply 15:41), but no push was posted (sender signature hidden)' },
      { file: 'docs/defect-evidence/phone/MNTF-D01-app-info-notifications-allow.png', caption: 'Phone: Android App info for Saleshiker 1.0.0, Manage notifications "Allow"' },
    ],
    issueType: 'Bug', severity: 'High', priority: 'P2 - High', status: 'Open',
    tests: ['MNTF-007'], guardTest: 'MNTF-007',
    evidence: 'By hand 2026-11-20 15:40-15:55 (screenshots in docs/defect-evidence/phone/MNTF-D01-*.png, the chat with the sender signature hidden; dumpsys notification polled for 14.5 min); reported again by the tester 2026-11-20 (incoming messages raise no push); dumpsys at 18:05 still shows no SalesHiker notification. Guard test MNTF-007 (run with NOTIFY_WAIT=1).',
    qaComment: 'Seen twice: verified by hand at 15:40 and reported again by the tester. Push setting On, device registered, POST_NOTIFICATIONS granted, app in the background (not force-stopped), so the phone side is set up. The chat already existed; the settings text covers "New chats, assignments and mentions", so confirm with the product team whether a message in an existing chat should push. A timed automated reproduction (MNTF-007 with NOTIFY_WAIT=1) is still pending.',
  },
];
