// Page object: Home ("Today") dashboard, the first screen after a successful sign-in.
// Values read from the live app (build 1.0.0, beta test account). The greeting line
// ("Good afternoon, <first name>") is deliberately not used: it is time- and user-dependent.
output.home = {
  title: 'Today',
  // Label under the unread-chats ring; unique to this screen. Pluralised from live data:
  // "Unread chats" (0 or many) / "Unread chat" (exactly 1, seen on 2026-10-30).
  unreadChats: 'Unread chats?',
  moreTab: 'More',               // bottom navigation, right-most tab (accessibility label)
}
