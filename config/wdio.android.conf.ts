// WebdriverIO configuration: Appium (UiAutomator2) on one Android device, Mocha + Chai specs in TypeScript.
// Run through scripts\run-*.ps1, or directly: npx wdio run ./config/wdio.android.conf.ts --suite smoke
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Reporters } from '@wdio/types';
import { HtmlReporter, ReportAggregator } from 'wdio-html-nice-reporter';
import { settings, PROJECT_ROOT } from '../src/config/settings.js';
import { resolveDevice, clearLogcat, saveLogcat, anrEvents } from '../src/utils/adb.js';
import { captureFailure } from '../src/utils/evidence.js';

const serial = resolveDevice(settings.deviceSerial);
const runDir = settings.runDir;
fs.mkdirSync(runDir, { recursive: true });
// Workers are forked from this process: pin the folder so every worker writes to the same run.
process.env.RUN_DIR = runDir;

// WebdriverIO HTML report of this run (reports\<run>\html-reports\report.html). The reporter joins its folder to
// the working directory, so it must be relative; checkpoint screenshots are picked up from takeScreenshot.
const htmlOptions = {
  outputDir: `${path.relative(process.cwd(), path.join(runDir, 'html-reports'))}${path.sep}`,
  filename: 'report.html',
  reportTitle: `SalesHiker Mobile - ${path.basename(runDir)}`,
  browserName: serial,
  useOnAfterCommandForScreenshot: true,
  linkScreenshots: true,
  collapseTests: true,
  showInBrowser: false,
};
let htmlAggregator: ReportAggregator | undefined;

export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: path.join(PROJECT_ROOT, 'tsconfig.json'),

  specs: [path.join(PROJECT_ROOT, 'test', 'specs', '**', '*.spec.ts')],
  suites: {
    smoke: [path.join(PROJECT_ROOT, 'test', 'specs', 'smoke', '*.spec.ts')],
    regression: [path.join(PROJECT_ROOT, 'test', 'specs', 'regression', '*.spec.ts')],
  },
  // One device, one session at a time.
  maxInstances: 1,

  capabilities: [{
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:udid': serial,
    'appium:appPackage': settings.appId,
    'appium:appActivity': settings.appActivity,
    // Tests reset app data themselves (AppActions.launchFresh) so a session never reinstalls the APK.
    'appium:noReset': true,
    'appium:autoGrantPermissions': true,
    // Keep animations on: with them off, the app's bottom sheets (Send from, Saved list, Template)
    // often stop at the dimmed backdrop and never slide up (runs 20261031-133943, -140658).
    'appium:disableWindowAnimation': false,
    'appium:newCommandTimeout': 300,
    // Slow hosts: the UiAutomator2 server needs time to install and start.
    'appium:uiautomator2ServerInstallTimeout': 180_000,
    // SKIP_SERVER_INSTALL=1 uses the UiAutomator2 server already on the device. For phones (ColorOS)
    // that hold every adb install behind a "risky app" prompt; the installed server must still work.
    'appium:skipServerInstallation': settings.skipServerInstall,
    'appium:uiautomator2ServerLaunchTimeout': 180_000,
    'appium:adbExecTimeout': 120_000,
  }],

  logLevel: 'warn',
  outputDir: path.join(runDir, 'wdio-logs'),
  waitforTimeout: 15_000,
  connectionRetryTimeout: 300_000,
  connectionRetryCount: 1,

  // Uses the Appium installed globally (appium + uiautomator2 driver), see docs\SETUP.md.
  services: [['appium', {
    command: 'appium',
    args: { address: '127.0.0.1', port: settings.appiumPort, logLevel: 'info', log: path.join(runDir, 'appium.log') },
  }]],
  port: settings.appiumPort,

  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 300_000 },

  reporters: [
    'spec',
    // suiteNameFormat: keep titles verbatim ("MCMP-001 ...") so results match test IDs; the default
    // strips punctuation ("MCMP 001 ...").
    // One file per worker (spec): a shared name lets the last spec overwrite the others.
    ['junit', { outputDir: runDir, outputFileFormat: (o: { cid: string }) => `junit-${o.cid}.xml`, suiteNameFormat: /[\r\n]+/ }],
    ['allure', { outputDir: path.join(runDir, 'allure-results'), disableWebdriverStepsReporting: true, disableWebdriverScreenshotsReporting: true }],
    // Built for WebdriverIO 8; its types differ from the v10 reporter types, the runtime events do not.
    [HtmlReporter as unknown as Reporters.ReporterClass, htmlOptions],
  ],

  // The aggregator empties its folder when created: create it before the workers start.
  onPrepare: () => {
    htmlAggregator = new ReportAggregator(htmlOptions as never);
    htmlAggregator.clean();
  },

  before: async () => {
    clearLogcat(serial);
    // The default XPath 2 engine fails on axes like following:: ("ArrayList$ListItr cannot be cast ...").
    await driver.updateSettings({ enforceXPath1: true });
  },

  afterTest: async (test, _context, result) => {
    // this.skip() also ends with passed=false; only real failures carry an error other than Pending.
    if (!result.passed && result.error && !/pending|skip/i.test(`${result.error.name} ${result.error.message}`)) {
      await captureFailure(test.title, serial, runDir);
    }
  },

  after: () => {
    saveLogcat(serial, path.join(runDir, 'logcat.txt'));
    const anrs = anrEvents(serial, settings.appId);
    if (anrs.length) fs.writeFileSync(path.join(runDir, 'anr-events.txt'), anrs.join('\n'));
  },

  // This run's HTML report; then, for direct runs (npm test, npx wdio ...), record the results as the runner
  // does, so the workbooks and the all-modules reports (reports\allure, reports\html, reports\monocart) are
  // updated after every run. The runner scripts set QA_RUNNER and do the rest themselves, after writing
  // summary.md and results.json.
  onComplete: async () => {
    try { await htmlAggregator?.createReport(); } catch (err) { console.warn(`Run HTML report not generated: ${err}`); }
    if (process.env.QA_RUNNER) return;
    const node = (script: string, ...args: string[]) => {
      const out = spawnSync(process.execPath, [path.join(PROJECT_ROOT, script), ...args], { cwd: PROJECT_ROOT, encoding: 'utf8' });
      if (out.stdout?.trim()) console.log(out.stdout.trim());
      if (out.status !== 0) console.warn(`${script} failed: ${(out.stderr || '').trim()}`);
    };
    if (fs.readdirSync(runDir).some((f) => /^junit.*\.xml$/.test(f))) node('tools/excel/update-workbooks.js', runDir);
    node('tools/allure/build-report.mjs');
    node('tools/html/build-report.mjs');
    node('tools/monocart/build-report.mjs');
  },
};
