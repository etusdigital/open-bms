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

// The substitution rewrites known bundle literals by value. That only works while
// the literals in the vendored asset still match the ones the code looks for — and
// when they drift, nothing throws: the rewrite quietly becomes a no-op and every
// install keeps serving the old project. These tests cover that drift plus the
// partial-config paths, which are the other ways the output silently ends up wrong.
describe('buildWebPush — substitution edge cases', () => {
  const base = 'https://bms.example.com';
  const FULL = {
    apiKey: 'AIza-platform-key',
    authDomain: 'platform.firebaseapp.com',
    projectId: 'platform-project',
    storageBucket: 'platform.firebasestorage.app',
    messagingSenderId: '111222333444',
    appId: '1:111222333444:web:abcdef',
    measurementId: 'G-PLATFORM',
  };

  const FULL_PLATFORM = { webConfig: FULL, vapidPublicKey: 'BE_platform_vapid' };

  // Every literal the substitution looks for/writes, quoted exactly as it appears
  // in the asset, checked in BOTH directions against the CONFIGURED output: if a
  // re-paste of the vendored bundle changes a literal the code looks for, the
  // matching replaceAll silently becomes a no-op and the platform value never
  // appears (first assertion catches that); if the bundle's own default drifts
  // to a different literal than BUNDLE_FIREBASE_CONFIG/BUNDLE_VAPID_KEY expect,
  // the stale value survives the swap unnoticed (second assertion catches that).
  // A table that only inspects the UNCONFIGURED bundle — the previous version of
  // this test — misses that second direction entirely.
  it.each([
    ['AIzaSyDCZGtCEwcA3Cp5pD1LkapMp_Nkf8XgslE', 'AIza-platform-key', 'apiKey'],
    ['bms-push-49662.firebaseapp.com', 'platform.firebaseapp.com', 'authDomain'],
    ['bms-push-49662', 'platform-project', 'projectId'],
    ['bms-push-49662.appspot.com', 'platform.firebasestorage.app', 'storageBucket'],
    ['570410747557', '111222333444', 'messagingSenderId'],
    ['1:570410747557:web:9a56271b512d3275876f4c', '1:111222333444:web:abcdef', 'appId'],
    ['G-H1Q2K5EDS0', 'G-PLATFORM', 'measurementId'],
    ['BPoMGU5hsce_S3F4Uicv6zfZ_fCs09kKqMvmu66MMlKR5UpTBy7DBOZxnAzgN9BfOA1sCOvsKOpHw7uHQv8iKG0', 'BE_platform_vapid', 'vapidKey'],
  ])('%s (bundle) → %s (platform) for %s', (bundleValue, platformValue) => {
    const out = buildWebPush(base, FULL_PLATFORM);
    expect(out).toContain(`'${platformValue}'`);
    expect(out).not.toContain(`'${bundleValue}'`);
  });

  it.each(['apiKey', 'projectId', 'messagingSenderId', 'appId', 'authDomain', 'storageBucket'])('keeps the bundle config whole when %s is missing', (faltando) => {
    const parcial = { ...FULL };
    delete (parcial as Record<string, string>)[faltando];
    const out = buildWebPush(base, { webConfig: parcial, vapidPublicKey: 'BE_platform_vapid' });

    // All-or-nothing: no field may move, or the config becomes a mix of two
    // projects and mints tokens that never deliver.
    expect(out).toContain('bms-push-49662');
    expect(out).toContain('570410747557');
    expect(out).not.toContain('platform-project');
  });

  it('drops the bundle measurementId instead of leaving its analytics id behind when the platform config omits it', () => {
    // measurementId is not in the required set, so the gate still opens without
    // it. Substituting the other six fields but leaving G-H1Q2K5EDS0 in place
    // would attribute analytics to the wrong Firebase project — the property is
    // dropped instead.
    const semMeasurement = { ...FULL };
    delete (semMeasurement as Record<string, string | undefined>).measurementId;
    const out = buildWebPush(base, { webConfig: semMeasurement, vapidPublicKey: 'BE_platform_vapid' });

    expect(out).toContain("'platform-project'");
    expect(out).not.toContain('G-H1Q2K5EDS0');
    expect(out).not.toContain('measurementId');
  });

  it('does NOT swap the web config when no VAPID key is supplied', () => {
    // firebaseConfig and vapidKey must move together: saving the web config
    // without a VAPID key used to swap the project alone, pairing it with the
    // bundle's own VAPID — getToken mints successfully against that mismatched
    // pair and nothing is ever delivered. All-or-nothing across the whole
    // platform config, same reasoning as the six required webConfig fields.
    const out = buildWebPush(base, { webConfig: FULL });

    expect(out).toContain('bms-push-49662');
    expect(out).not.toContain('platform-project');
    expect(out).toContain('BPoMGU5hsce_S3F4Uicv6zfZ_fCs09kKqMvmu66MMlKR5UpTBy7DBOZxnAzgN9BfOA1sCOvsKOpHw7uHQv8iKG0');
  });

  it('does NOT swap the VAPID key alone without a complete web config', () => {
    const out = buildWebPush(base, { vapidPublicKey: 'BE_platform_vapid' });

    expect(out).not.toContain('BE_platform_vapid');
    expect(out).toContain('bms-push-49662');
    expect(out).toContain('BPoMGU5hsce_S3F4Uicv6zfZ_fCs09kKqMvmu66MMlKR5UpTBy7DBOZxnAzgN9BfOA1sCOvsKOpHw7uHQv8iKG0');
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
