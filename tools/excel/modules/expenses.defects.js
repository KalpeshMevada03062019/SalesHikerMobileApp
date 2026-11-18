// Mobile Expenses defects / observations (live app 2026-11-16, Realme RMX3997, Android 16).
module.exports = [
  {
    id: 'MEXP-D01',
    category: 'Calculation / Tax',
    title: 'TDS 2% on a new expense adds the tax instead of deducting it',
    steps: '1. More > Expenses > New expense.\n2. Amount (before tax) 1000.\n3. Tax rate TDS 2%.\n4. Read Amount, Tax and Total.',
    expected: 'TDS is a deducted tax, as the app shows elsewhere ("Deducted Tax -₹21.98" on INV-300005; TDS subtracted on QT-301006): Tax -₹20, Total ₹980.',
    actual: 'Tax ₹20, Total ₹1,020. Other rates are right: Sales 10% 1000 + 100 = 1,100; VAT 4.5% and Service 12.5% add 45 and 125; Sales 10% included in 1000 gives 909.09 + 90.91.',
    issueType: 'Bug', severity: 'High', priority: 'P2 - High', status: 'Open',
    tests: ['MEXP-013'], guardTest: 'MEXP-013',
    evidence: 'By hand 2026-11-16 (reports/explore-campaign/exc2.xml); run 20261116-175012-single-MEXP-013.',
    qaComment: 'Same cause as MINV-D02 (TDS on invoice lines). Reproduced by hand and in run 20261116-175012; nothing saved (the form is discarded).',
  },
];
