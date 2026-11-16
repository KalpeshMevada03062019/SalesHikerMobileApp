// Mobile Invoices defects / observations (live app 2026-11-06, Realme RMX3997, Android 16).
module.exports = [
  {
    id: 'MINV-D01',
    category: 'Payments / Calculation',
    title: 'A partially paid invoice shows more paid than the payments it lists',
    steps: '1. More > Invoices; search INV-004221 and open it.\n2. Read PAYMENT (Total, Paid, Balance due), the payment history under it and ACTIVITY.',
    expected: 'Paid equals the sum of the payments listed (and recorded in ACTIVITY), or the screen shows where the rest of the paid amount comes from.',
    actual: 'Total ₹98,500.13, Paid ₹40,381, Balance due ₹58,119.13, "Paid 41%" (also "Paid ₹40,381" on the list), but the history lists one payment of ₹500 (20 Aug, Cash, UTR-VERIFY-196) and ACTIVITY shows 1 entry, "Payment of 500.00 recorded". ₹39,881 of the paid amount has no payment behind it. INV-300005 is consistent (₹976.92 + ₹100 = Paid ₹1,076.92).',
    issueType: 'Observation', severity: 'Medium', priority: 'P3 - Medium', status: 'Needs Decision',
    tests: ['MINV-009'], guardTest: 'MINV-009',
    evidence: 'reports/explore-campaign/inv3.xml, inv4.xml (2026-11-06 17:30); run 20261106-181625-single-MINV-009',
    qaComment: 'Reproduced twice on 2026-11-06: by hand at 17:30 and in run 20261106-181625 (Paid vs the payments listed: 500 vs 40,381). Likely seeded data (a paid amount set without payment records), to confirm against the web and decide; Total, Paid, Balance and progress agree with each other. MINV-009 fails while the gap remains.',
  },
  {
    id: 'MINV-D02',
    category: 'Calculation / Tax',
    title: 'A TDS 2% line on a mobile invoice adds the tax instead of deducting it',
    steps: '1. More > Invoices > New invoice; subject QA-TEST-INV <timestamp>.\n2. Add service "test service" (₹140): Qty 2, Discount % 10, Tax Sales 10%; Add line.\n3. Add service again: Qty 1, Discount amount 6, Tax TDS 2%; Add line.\n4. Read each line and Lines total; Save; read the saved invoice.',
    expected: 'TDS is a deducted tax, as the app shows elsewhere ("Deducted Tax -₹21.98" on INV-300005; TDS 2% subtracted on QT-301006): line 2 = 134 - 2.68 = ₹131.32; Tax 25.20 - 2.68 = ₹22.52; Total ₹408.52.',
    actual: 'Line 2 shows ₹136.68 (134 + 2.68) on the form and on the saved invoice; Lines total ₹413.88; saved INV-300013: Subtotal ₹386, Tax ₹27.88 (25.20 + 2.68), Total and amount ₹413.88, ₹5.36 too much. Line 1 (Sales 10%, 10% off) is right: ₹277.20. Same with the product line: 90 + 1.80 = ₹91.80 instead of ₹88.20.',
    issueType: 'Bug', severity: 'High', priority: 'P2 - High', status: 'Open',
    tests: ['MINV-020', 'MINV-021', 'MINV-022'], guardTest: 'MINV-022',
    evidence: 'Form: by hand 2026-11-16 11:40 (reports/explore-campaign/l2b.xml), runs 20261116-122306, -122530 (product) and -123358 (service) of MINV-021. Saved: INV-300013, run 20261116-123643 (MINV-020), runs -124006 and -124218 (MINV-022).',
    qaComment: 'Reproduced on the form 4 times (product and service) and on the saved invoice INV-300013 in 3 runs. Only the TDS line is affected; percent and amount discounts and the Sales 10% tax are right. To compare with the web (same invoice INV-300013) when the Chrome extension is connected. Test data INV-300013 is the one approved QA-TEST invoice, kept as Draft.',
  },
];
