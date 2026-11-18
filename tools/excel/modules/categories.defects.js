// Mobile Categories defects / observations (live app 2026-11-17, Realme RMX3997, Android 16).
module.exports = [
  {
    id: 'MCAT-D01',
    category: 'Sorting / List order',
    title: 'The category list ignores the sort order although the form says lower numbers show first',
    steps: '1. More > Categories.\n2. Open each of the first six categories and read DETAILS > Sort order.\n3. Compare with the list order.\n4. Open Edit on any category: Sort order shows "Lower numbers show first."',
    expected: 'The list (and the category pickers) in ascending sort order, as the form hint says: e.g. BEAUTY AND CARE, CHRISTMAS AND NEW YEAR (1) and BREAD AND BAKERY, FROZEN (1) before BEAUTY AND CARE (4).',
    actual: 'The list is alphabetical: BEAUTY AND CARE (4), BEAUTY AND CARE, CHRISTMAS AND NEW YEAR (1), BEVERAGES (5), BREAD AND BAKERY (7), BREAD AND BAKERY, FROZEN (1), CANNED FOOD (6). The Category pickers of Products and Parent category are alphabetical too.',
    issueType: 'Bug', severity: 'Medium', priority: 'P3 - Medium', status: 'Open',
    tests: ['MCAT-012'], guardTest: 'MCAT-012',
    evidence: 'By hand 2026-11-17 (reports/explore-campaign/cat-list.xml and per-category dumps); run 20261117-162414-single-MCAT-012.',
    qaComment: 'Reproduced by hand and in run 20261117-162414. Not compared with the web app yet (Chrome extension not connected): if the web also lists alphabetically, the hint may only apply elsewhere (e.g. a storefront) and this becomes a wording issue.',
  },
];
