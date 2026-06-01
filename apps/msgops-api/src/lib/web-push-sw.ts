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

// The Firebase web config + VAPID public key hardcoded in the vendored bundle
// (the bri.us "bms-push-49662" project). These are PUBLIC client-side values, not
// secrets — but in the single-project model the token must be minted against OUR
// project, so we substitute them at serve time.
//
// CRITICAL: this MUST be a serve-time substitution of the bundle literals, NOT a
// runtime override via the page snippet. The bmsPush constructor runs
// `initializeApp(this.firebaseConfig)` in a field initializer — BEFORE the
// `e.firebaseConfig || ...` override line — so a snippet value would bind too late
// and getToken would still mint against bms-push-49662. Replacing the literal is
// the only thing that actually changes the project. (It also keeps the platform
// Firebase config out of the HTML the customer pastes — parity with Enterprise.)
const BUNDLE_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDCZGtCEwcA3Cp5pD1LkapMp_Nkf8XgslE',
  authDomain: 'bms-push-49662.firebaseapp.com',
  projectId: 'bms-push-49662',
  storageBucket: 'bms-push-49662.appspot.com',
  messagingSenderId: '570410747557',
  appId: '1:570410747557:web:9a56271b512d3275876f4c',
  measurementId: 'G-H1Q2K5EDS0',
};
const BUNDLE_VAPID_KEY = 'BPoMGU5hsce_S3F4Uicv6zfZ_fCs09kKqMvmu66MMlKR5UpTBy7DBOZxnAzgN9BfOA1sCOvsKOpHw7uHQv8iKG0';

export interface WebPushPlatformConfig {
  webConfig?: Record<string, string | undefined>;
  vapidPublicKey?: string;
}

// Renders web-push.js (the on-page FCM client) from the verbatim vendored asset.
// We do NOT touch the bundled Firebase SDK; we substitute (a) the endpoint base
// (__BMS_TRACKER_BASE__ → this instance) and (b) the hardcoded Firebase config +
// VAPID literal → the platform values from Super-Admin → FCM. When no platform
// config is set, the bundle defaults are left in place (web-push simply targets
// the bri.us project until FCM is configured — logged/flagged by the caller).
export function buildWebPush(publicBase: string, platform?: WebPushPlatformConfig): string {
  let core = readFileSync(join(__dirname, '../assets/push/web-push-core.js'), 'utf8');
  const base = publicBase.replace(/\/+$/, '');
  core = core.replaceAll('__BMS_TRACKER_BASE__', base);

  const web = platform?.webConfig ? cleanWebConfig(platform.webConfig) : null;
  // Only substitute when the config is COMPLETE enough to fully replace the
  // bundle's project. A partial config would leave some bri.us fields (e.g.
  // authDomain/storageBucket) in place → a Frankenstein config that mints dead
  // tokens. All-or-nothing is safer than a half-swap. (Firebase always emits all
  // 7 fields, so a complete config is the normal case.)
  const REQUIRED = ['apiKey', 'projectId', 'messagingSenderId', 'appId', 'authDomain', 'storageBucket'] as const;
  if (web && REQUIRED.every((k) => web[k])) {
    // The bundle is prettier-printed, so the object literal in the source uses
    // single quotes + indentation. We can't safely string-match that multi-line
    // literal, so we rewrite each scalar field by its KNOWN bri.us value →
    // platform value. measurementId is optional (may be absent in either).
    for (const key of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'] as const) {
      const from = (BUNDLE_FIREBASE_CONFIG as Record<string, string>)[key];
      const to = web[key];
      if (from && to) core = core.replaceAll(`'${from}'`, `'${to}'`);
    }
  }
  if (platform?.vapidPublicKey) {
    core = core.replaceAll(`'${BUNDLE_VAPID_KEY}'`, `'${platform.vapidPublicKey}'`);
  }
  return core;
}
