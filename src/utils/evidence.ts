// Failure diagnostics: screenshot, UI hierarchy, current app/activity and logcat, saved to the run
// folder and attached to the Allure report.
import fs from 'node:fs';
import path from 'node:path';
import allure from '@wdio/allure-reporter';
import { saveLogcat } from './adb.js';
import { settings } from '../config/settings.js';

const safeName = (title: string): string => title.replace(/[^\w.-]+/g, '_').slice(0, 80);

export async function captureFailure(testTitle: string, serial: string, runDir: string): Promise<void> {
  const dir = path.join(runDir, 'failures', safeName(testTitle));
  fs.mkdirSync(dir, { recursive: true });
  // Each step is best-effort: a dead session must not hide the original failure.
  try {
    const png = await driver.takeScreenshot();
    fs.writeFileSync(path.join(dir, 'screenshot.png'), png, 'base64');
    allure.addAttachment('Failure screenshot', Buffer.from(png, 'base64'), 'image/png');
  } catch (e) { fs.writeFileSync(path.join(dir, 'screenshot-error.txt'), String(e)); }
  try {
    const source = await driver.getPageSource();
    fs.writeFileSync(path.join(dir, 'page-source.xml'), source);
    allure.addAttachment('UI hierarchy', source, 'application/xml');
  } catch (e) { fs.writeFileSync(path.join(dir, 'page-source-error.txt'), String(e)); }
  try {
    const where = `package: ${await driver.getCurrentPackage()}\nactivity: ${await driver.getCurrentActivity()}\n`;
    fs.writeFileSync(path.join(dir, 'foreground.txt'), where);
    allure.addAttachment('Foreground app', where, 'text/plain');
  } catch { /* session gone */ }
  try {
    for (const file of saveLogcat(serial, path.join(dir, 'logcat.txt'))) {
      allure.addAttachment(path.basename(file), fs.readFileSync(file, 'utf8').split('\n').slice(-400).join('\n'), 'text/plain');
    }
  } catch (e) { fs.writeFileSync(path.join(dir, 'logcat-error.txt'), String(e)); }
}

/** Screenshot of a key state, saved under screenshots/ in the run folder and attached to Allure. */
export async function checkpoint(name: string): Promise<void> {
  const png = await driver.takeScreenshot();
  const dir = path.join(settings.runDir, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${safeName(name)}.png`), png, 'base64');
  allure.addAttachment(name, Buffer.from(png, 'base64'), 'image/png');
}
