// Page object: Sign-in screen, the first screen after a clean launch.
// All values were read from the live app (build 1.0.0). They are Maestro selectors: full-match
// regexes over text / accessibility label. Escape ? . ( ) [ ] * as \\? etc.
// Build 1.0.0 exposes no resource-ids; when testIDs are added, switch to { id: '...' } usage here.
output.signIn = {
  // Elements
  logo: 'SalesHiker',
  title: 'Sign in',
  subtitle: 'Welcome back to SalesHiker',      // unique on this screen; used to detect it
  emailField: 'Email address',
  passwordField: 'Password',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  submitButton: 'Sign in',                     // also matches the title: anchor below passwordField
  submitting: 'Signing in.*',
  forgotPassword: 'Forgot password\\?',
  scanCode: 'Scan a code from the web app',
  createWorkspace: 'New here\\? Create your workspace',

  // Messages
  errors: {
    emailRequired: 'Enter your email',
    passwordRequired: 'Enter your password',
    emailMalformed: 'Enter a full email, like you@company\\.com\\.',
    wrongCredentials: 'Email or password is wrong\\.',  // also for unknown accounts (no user enumeration)
    serverInvalidEmail: 'Invalid email',                // banner returned by the server, see APP-001
    noConnection: 'Check your connection and try again\\.',
  },
}
