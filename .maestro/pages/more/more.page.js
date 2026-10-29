// Page object: "More" screen (bottom navigation > More) and its sign-out confirmation dialog.
// Values read from the live app (build 1.0.0).
output.more = {
  marker: 'Tasks today',          // stat tile shown only on this screen; "More" alone also matches the tab
  signOut: 'Sign out',            // last list item; it sits behind the floating tab bar until scrolled
  signOutDialog: {
    title: 'Sign out\\?',
    message: 'You stop getting notifications on this phone\\.',
    cancel: 'Cancel',
    confirm: 'Sign out',          // same text as the list item: anchor below the message
  },
}
