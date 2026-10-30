// Thin wrappers around adb for things Appium does not cover: device discovery, logcat, crash buffer.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function adbPath(): string {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
  const exe = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  return fs.existsSync(exe) ? exe : 'adb';
}

export function adb(args: string[], serial?: string, timeoutMs = 60_000): string {
  const full = serial ? ['-s', serial, ...args] : args;
  return execFileSync(adbPath(), full, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
}

export function onlineDevices(): string[] {
  return adb(['devices'])
    .split(/\r?\n/)
    .map((line) => line.match(/^(\S+)\s+device$/)?.[1])
    .filter((s): s is string => Boolean(s));
}

/** The configured serial, or the only connected device. Throws with a clear message otherwise. */
export function resolveDevice(preferred: string): string {
  const online = onlineDevices();
  if (preferred) {
    if (!online.includes(preferred)) throw new Error(`Device ${preferred} (DEVICE_SERIAL) is not connected. Connected: ${online.join(', ') || 'none'}`);
    return preferred;
  }
  if (online.length === 0) throw new Error('No Android device connected. Start one with .\\scripts\\start-emulator.ps1 or connect a phone with USB debugging.');
  if (online.length > 1) throw new Error(`Several devices connected (${online.join(', ')}). Set DEVICE_SERIAL in config\\.env.`);
  return online[0];
}

export function clearLogcat(serial: string): void {
  adb(['logcat', '-c'], serial);
}

/** Saves the main log and, if not empty, the crash buffer next to it. Returns the files written. */
export function saveLogcat(serial: string, file: string): string[] {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, adb(['logcat', '-d', '-v', 'threadtime'], serial));
  const written = [file];
  const crash = adb(['logcat', '-d', '-b', 'crash', '-v', 'threadtime'], serial);
  if (crash.trim()) {
    const crashFile = file.replace(/\.txt$/, '.crash.txt');
    fs.writeFileSync(crashFile, crash);
    written.push(crashFile);
  }
  return written;
}

/** ANR events recorded for a package since the last logcat clear. */
export function anrEvents(serial: string, appId: string): string[] {
  return adb(['logcat', '-d', '-b', 'events'], serial).split(/\r?\n/).filter((l) => l.includes('am_anr') && l.includes(appId));
}
