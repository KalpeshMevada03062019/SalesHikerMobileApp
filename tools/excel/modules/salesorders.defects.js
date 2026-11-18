// Mobile Sales order defects (live app 2026-11-05 / 2026-11-18, Realme RMX3997, Android 16; web comparison 2026-11-18).
module.exports = [
  {
    id: 'MSOR-D01',
    category: 'Calculation / Web mismatch',
    title: 'The new sales order form total differs from the web for the same lines: the phone skips the order-level deducted tax',
    steps: '1. More > Sales orders > New sales order.\n2. Add service "test service": Qty 2, Discount % 10, Sales 10%; Add line.\n3. Add service: Qty 1, Discount amount 6, TDS 2%; Add line.\n4. Read Lines total; Discard.\n5. Web: New sales order with the same two lines (not saved); read the Summary.',
    expected: 'The same total as the web: Items ₹386, (+) Tax ₹27.88, (-) Deducted taxes ₹7.72, Grand Total ₹406.16.',
    actual: 'Phone: lines ₹277.20 and ₹136.68 (same as the web), Lines total ₹413.88, ₹7.72 more than the web.',
    images: [
      { file: "docs/defect-evidence/web/MSOR-D01-web-new-sales-order.jpg", caption: "Web: New sales order, same two lines (not saved): Deducted ₹7.72, Grand Total ₹406.16" },
    ],
    issueType: 'Bug', severity: 'High', priority: 'P2 - High', status: 'Open',
    tests: ['MSOR-011'], guardTest: 'MSOR-011',
    evidence: 'Web New sales order Summary (not saved), 2026-11-18; runs 20261118-161540 and 20261118-162653-single-MSOR-011.',
    qaComment: 'Reproduced in two runs; same cause as MINV-D03. The saved sales order SO-300004 matches the web exactly (MSOR-010).',
  },
];
