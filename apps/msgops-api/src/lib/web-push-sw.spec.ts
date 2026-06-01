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

  it('retains the SDK-default Firebase config (overridden at runtime via bmsTrkOptions)', () => {
    // We intentionally do NOT edit the bundle's hardcoded config — the snippet's
    // window.bmsTrkOptions.firebaseConfig overrides it at runtime. The default
    // staying present proves we did not corrupt the constructor.
    expect(out).toContain('bms-push-49662');
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
