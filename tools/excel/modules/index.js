// Modules covered by the workbooks. Each becomes one sheet in the test-case workbook and one in the
// defect tracker. To add a module: create <name>.cases.js and <name>.defects.js and list it here.
module.exports = [
  { sheet: 'Login', label: 'Login (mobile sign-in)', role: 'Workspace user (mobile app)',
    cases: require('./login.cases'), defects: require('./login.defects') },
  { sheet: 'Campaigns', label: 'Campaigns (WhatsApp)', role: 'Signed-in workspace user (mobile app)',
    cases: require('./campaigns.cases'), defects: require('./campaigns.defects') },
];
