// Page object: device-level UI that is not part of the app.
// keyboard: the on-screen keyboard's root view (Gboard on the emulator, observed in the hierarchy;
// Samsung Keyboard on Samsung phones). Used as an `id:` regex.
output.device = {
  keyboard: 'com\\.google\\.android\\.inputmethod\\.latin:id/keyboard_holder|com\\.samsung\\.android\\.honeyboard:id/.*',
}
