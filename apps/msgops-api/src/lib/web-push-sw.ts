import { readFileSync } from 'fs';
import { join } from 'path';

// Single source of truth for generating the PLATFORM web-push service worker
// (bms-sw.js) from the repo template + the platform Firebase web config saved in
// Super-Admin → FCM. Single-project model: one core for all accounts.

export interface PlatformWebPushConfig {
  webConfig?: Record<string, string | undefined>;
  trackerUrl: string;
}

// Resolve the template path. Works both from src (ts-jest: __dirname=src/lib) and
// dist (nest build copies the asset to dist/assets/push via nest-cli assets).
function coreTemplatePath(): string {
  return join(__dirname, '../assets/push/bms-sw-core.js');
}

export function buildPlatformServiceWorker(cfg: PlatformWebPushConfig): string {
  const core = readFileSync(coreTemplatePath(), 'utf8');
  const firebaseConfig = cfg.webConfig ? JSON.stringify(cleanWebConfig(cfg.webConfig)) : '{}';
  return [
    `// Generated ${new Date().toISOString()} — source: assets/push/bms-sw-core.js; do not edit on S3.`,
    core.replaceAll('__BMS_TRACKER_URL__', cfg.trackerUrl).replaceAll('__BMS_FIREBASE_CONFIG__', firebaseConfig),
  ].join('\n');
}

// Keep only the standard Firebase web-config keys, dropping undefined values.
function cleanWebConfig(raw: Record<string, string | undefined>): Record<string, string> {
  const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
  const out: Record<string, string> = {};
  for (const k of keys) {
    if (raw[k]) out[k] = String(raw[k]);
  }
  return out;
}

export const PLATFORM_SW_PATH = 'bms';
export const PLATFORM_SW_FILENAME = 'bms-sw.js';

// Renders bmstrk.js (the on-page tracker) from the repo template, pointing its
// hardcoded endpoints at THIS BMS instance instead of in.bri.us, and the
// web-push loader at our own route. publicBase = BMS_PUBLIC_URL.
export function buildTracker(publicBase: string): string {
  const core = readFileSync(join(__dirname, '../assets/push/bmstrk-core.js'), 'utf8');
  const base = publicBase.replace(/\/+$/, '');
  return core.replaceAll('__BMS_TRACKER_BASE__', base).replaceAll('__BMS_WEBPUSH_URL__', `${base}/bms/web-push.js`);
}
