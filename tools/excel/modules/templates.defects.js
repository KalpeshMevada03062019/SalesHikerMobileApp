// Mobile Templates defects / observations (live app 2026-11-02/03, Realme RMX3997, Android 16; web
// template scenarios as the reference).
module.exports = [
  {
    id: 'MTPL-D01',
    category: 'Consistency with web',
    title: 'The mobile template form has no Location header type, which the web offers',
    steps: '1. More > Templates > New template.\n2. Open the Header tab.\n3. Compare with the web template form (Location header, web scenario TPL-020).',
    expected: 'Header types as on the web: None, Text, Image, Video, Document and Location.',
    actual: 'Mobile offers None, Text, Image, Video and Document only; location templates can only be made on the web, and sending them from the mobile Inbox fails (MINB-D02).',
    issueType: 'Observation', severity: 'Low', priority: 'P4 - Low', status: 'Needs Decision',
    tests: ['MTPL-013'], guardTest: 'MTPL-013',
    evidence: 'reports/explore-templates/15-Header.xml (2026-11-02)',
    qaComment: 'Feature gap against the web; product to decide whether mobile should create location templates. Automated test MTPL-013 fails while it persists.',
  },
];
