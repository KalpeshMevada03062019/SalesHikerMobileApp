// Run settings. Precedence: config/.env.example < config/.env < variables already set in the shell
// (the same rule the PowerShell scripts use).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadEnvFiles(): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const name of ['.env.example', '.env']) {
    const file = path.join(PROJECT_ROOT, 'config', name);
    if (fs.existsSync(file)) Object.assign(merged, dotenv.parse(fs.readFileSync(file)));
  }
  for (const key of Object.keys(merged)) {
    const fromShell = process.env[key];
    if (fromShell) merged[key] = fromShell;
  }
  return merged;
}

const env = loadEnvFiles();
const value = (key: string, fallback = ''): string => (env[key] ?? process.env[key] ?? fallback).trim();

export const settings = {
  appId: value('APP_ID', 'com.saleshiker.app'),
  appActivity: value('APP_ACTIVITY', '.MainActivity'),
  apkPath: value('APK_PATH'),
  /** Device to test on; empty = the only connected device (emulator or phone). */
  deviceSerial: value('DEVICE_SERIAL') || value('ANDROID_SERIAL'),
  testUser: { email: value('TEST_USERNAME'), password: value('TEST_PASSWORD') },
  appiumPort: Number(value('APPIUM_PORT', '4723')),
  /** Folder for this run's reports. Set by the PowerShell runners; generated otherwise. */
  runDir: value('RUN_DIR') || path.join(PROJECT_ROOT, 'reports', `${new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}-wdio`),
};

export const hasCredentials = (): boolean => Boolean(settings.testUser.email && settings.testUser.password);
