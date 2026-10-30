// WebdriverIO configuration: Appium (UiAutomator2) on one Android device, Mocha + Chai specs in TypeScript.
// Run through scripts\run-*.ps1, or directly: npx wdio run ./config/wdio.android.conf.ts --suite smoke
import fs from 'node:fs';
import path from 'node:path';
import { settings, PROJECT_ROOT } from '../src/config/settings.js';
import { resolveDevice, clearLogcat, saveLogcat, anrEvents } from '../src/utils/adb.js';
import { captureFailure } from '../src/utils/evidence.js';

const serial = resolveDevice(settings.deviceSerial);
const runDir = settings.runDir;
fs.mkdirSync(runDir, { recursive: true });
// Workers are forked from this process: pin the folder so every worker writes to the same run.
process.env.RUN_DIR = runDir;

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
    'appium:disableWindowAnimation': true,
    'appium:newCommandTimeout': 300,
    // Slow hosts: the UiAutomator2 server needs time to install and start.
    'appium:uiautomator2ServerInstallTimeout': 180_000,
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
    ['junit', { outputDir: runDir, outputFileFormat: () => 'junit.xml' }],
    ['allure', { outputDir: path.join(runDir, 'allure-results'), disableWebdriverStepsReporting: true, disableWebdriverScreenshotsReporting: true }],
  ],

  before: () => {
    clearLogcat(serial);
  },

  afterTest: async (test, _context, result) => {
    if (!result.passed) await captureFailure(test.title, serial, runDir);
  },

  after: () => {
    saveLogcat(serial, path.join(runDir, 'logcat.txt'));
    const anrs = anrEvents(serial, settings.appId);
    if (anrs.length) fs.writeFileSync(path.join(runDir, 'anr-events.txt'), anrs.join('\n'));
  },
};
