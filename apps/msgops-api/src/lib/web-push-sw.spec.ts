import { buildWebPush, buildTracker, buildPlatformServiceWorker } from './web-push-sw';

// These tests lock the invariants for the on-page web-push assets that are
// vendored verbatim (the Firebase SDK is bundled). The danger with a verbatim
// third-party bundle is (a) a future re-paste corrupts the SDK body, or (b) the
// serve-time rewrite leaves a bri.us endpoint or an unsubstituted placeholder.
// Both ship a file that silently fails in the browser — exactly what a build /
// typecheck can't catch. These assertions are the cheap guard.

describe('buildWebPush', () => {
  const base = 'https://bms.example.com';
  const out = buildWebPush(`${base}/`); // trailing slash on purpose — must be stripped

  it('keeps the vendored Firebase SDK body intact', () => {
    // Sentinels from the bundle. If a re-paste drops any of these, the file
    // would throw at load (e.g. "initializeApp is not defined").
    expect(out).toContain('initializeApp');
    expect(out).toContain('getMessagingInWindow');
    expect(out).toContain('function getToken');
    expect(out).toContain('class bmsPush');
  });

  it('rewrites every endpoint to this BMS instance', () => {
    expect(out).toContain(`${base}/bms/push/`);
    expect(out).toContain(`${base}/bms/leads/web-push`);
    expect(out).toContain(`${base}/bms/events`);
  });

  it('leaves no placeholder and no bri.us endpoint behind', () => {
    expect(out).not.toContain('__BMS_');
    expect(out).not.toContain('in.bri.us');
    expect(out).not.toContain('assets.bri.us/bms/push/bmspush-');
  });

  it('strips a trailing slash from the public base (no //bms)', () => {
    expect(out).not.toContain(`${base}//bms`);
  });

  it('retains the bri.us bundle config when no platform config is supplied', () => {
    // Without FCM configured, the bundle defaults stay in place (web-push targets
    // the bri.us project until Super-Admin sets it). Proves we did not corrupt the
    // constructor and substitution is opt-in.
    expect(out).toContain('bms-push-49662');
  });
});

describe('buildWebPush — platform Firebase substitution (single-project)', () => {
  const base = 'https://bms.example.com';
  const PLATFORM = {
    webConfig: {
      apiKey: 'AIza-bms-open-key',
      authDomain: 'bms-open.firebaseapp.com',
      projectId: 'bms-open',
      storageBucket: 'bms-open.firebasestorage.app',
      messagingSenderId: '799302104089',
      appId: '1:799302104089:web:0a260a4b204d557dcb2688',
      measurementId: 'G-OPEN123',
    },
    vapidPublicKey: 'BE_PlatformVapidKey_xyz',
  };
  const out = buildWebPush(base, PLATFORM);

  it('substitutes the FULL platform Firebase config — project AND sender move together', () => {
    expect(out).toContain("'bms-open'");
    expect(out).toContain("'799302104089'");
    expect(out).toContain("'1:799302104089:web:0a260a4b204d557dcb2688'");
    // A mixed config (bms-open project + bri.us sender) would mint dead tokens —
    // assert NONE of the bri.us values survive.
    expect(out).not.toContain('bms-push-49662');
    expect(out).not.toContain('570410747557');
    expect(out).not.toContain('AIzaSyDCZGtCEwcA3Cp5pD1LkapMp_Nkf8XgslE');
  });

  it('substitutes the VAPID public key', () => {
    expect(out).toContain("'BE_PlatformVapidKey_xyz'");
    expect(out).not.toContain('BPoMGU5hsce_S3F4Uicv6zfZ_fCs09kKqMvmu66MMlKR5UpTBy7DBOZxnAzgN9BfOA1sCOvsKOpHw7uHQv8iKG0');
  });

  it('keeps the SDK body intact after substitution', () => {
    expect(out).toContain('class bmsPush');
    expect(out).toContain('initializeApp');
    expect(out).not.toContain('__BMS_');
  });
});

describe('buildTracker', () => {
  const base = 'https://bms.example.com';
  const out = buildTracker(`${base}/`);

  it('points the web-push loader at our route', () => {
    expect(out).toContain(`${base}/bms/web-push.js`);
  });

  it('leaves no placeholder behind', () => {
    expect(out).not.toContain('__BMS_');
  });
});

describe('buildPlatformServiceWorker', () => {
  it('substitutes the tracker url and firebase config', () => {
    const out = buildPlatformServiceWorker({
      trackerUrl: 'https://bms.example.com/bms/events?platform=web-push',
      webConfig: { apiKey: 'k', projectId: 'p', messagingSenderId: '1', appId: 'a' },
    });
    expect(out).not.toContain('__BMS_');
    expect(out).toContain('https://bms.example.com/bms/events');
    expect(out).toContain('"projectId":"p"');
  });

  it('falls back to an empty config object when none is provided', () => {
    const out = buildPlatformServiceWorker({ trackerUrl: 'https://x/y' });
    expect(out).not.toContain('__BMS_FIREBASE_CONFIG__');
  });
});
