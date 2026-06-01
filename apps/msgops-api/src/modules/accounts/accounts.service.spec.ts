import { AccountsService, DEFAULT_ACCOUNT_TIMEZONE } from './accounts.service';

describe('AccountsService.getTimezone', () => {
  function buildService(rows: Array<{ value: string }>) {
    const accountConfigRepository = {
      find: jest.fn().mockResolvedValue(rows),
    };
    const cls = { get: jest.fn().mockReturnValue(42) };
    const service = Object.create(AccountsService.prototype) as AccountsService;
    (service as any).accountConfigRepository = accountConfigRepository;
    (service as any).cls = cls;
    return { service, accountConfigRepository, cls };
  }

  it('returns the configured timezone when account_configs has a time_zone row', async () => {
    const { service } = buildService([{ value: 'Europe/Lisbon' }]);
    await expect(service.getTimezone()).resolves.toBe('Europe/Lisbon');
  });

  it('falls back to DEFAULT_ACCOUNT_TIMEZONE when account_configs has no time_zone row', async () => {
    const { service } = buildService([]);
    await expect(service.getTimezone()).resolves.toBe(DEFAULT_ACCOUNT_TIMEZONE);
  });

  it('uses the provided accountId when passed explicitly', async () => {
    const { service, accountConfigRepository, cls } = buildService([{ value: 'UTC' }]);
    await service.getTimezone(99);
    expect(accountConfigRepository.find).toHaveBeenCalledWith({
      where: { accountId: 99, name: 'time_zone' },
    });
    expect(cls.get).not.toHaveBeenCalled();
  });
});

// BMS-served web-push service worker (generate-on-request, no S3). The whole
// point: the rendered SW carries the PLATFORM Firebase config, and the public
// hash resolves to the right account.
describe('AccountsService.renderAccountServiceWorker + resolveAccountIdByHash', () => {
  const HASH_7 = require('crypto').createHash('sha256').update('7').digest('hex');

  function build() {
    const service = Object.create(AccountsService.prototype) as AccountsService;
    (service as any).getAllAccountsLightweight = jest.fn().mockResolvedValue([{ id: 7, name: 'A', isActive: true }]);
    (service as any).findByAccountConfig = jest.fn().mockResolvedValue(null); // no webpush_settings
    (service as any).parsePushContentVars = (v: string) => `const webpush_settings_replace = ${v};`;
    (service as any).accountConfigRepository = {
      manager: { query: jest.fn().mockResolvedValue([{ value: { webConfig: { projectId: 'bms-open', messagingSenderId: '799302104089', apiKey: 'AIza...' } } }]) },
    };
    return { service };
  }

  it('resolves a public accountHash back to the account id', async () => {
    const { service } = build();
    expect(await service.resolveAccountIdByHash(HASH_7)).toBe(7);
    expect(await service.resolveAccountIdByHash('deadbeef')).toBeNull();
  });

  it('renders a SW carrying the PLATFORM Firebase project (bms-open), no S3', async () => {
    const { service } = build();
    const js = await service.renderAccountServiceWorker(7);
    expect(js).toContain('bms-open');
    expect(js).toContain('799302104089');
    expect(js).toContain('firebase.initializeApp');
    // generated on the fly, no importScripts of a shared S3 core
    expect(js).not.toContain('importScripts("https://');
  });
});

describe('AccountsService.getWebPushIntegration — single-project Firebase injection', () => {
  // This is the make-or-break of the single-project model: the on-page snippet
  // MUST carry the PLATFORM firebaseConfig + vapidKey (from system_config
  // .fcm_settings) so web-push.js mints FCM tokens against OUR project. If they're
  // missing, bmsPush silently falls back to the bri.us defaults baked into the
  // vendored SDK and tokens land in a project we don't control.
  function build(fcmValue: any) {
    const service = Object.create(AccountsService.prototype) as AccountsService;
    (service as any).findByAccountConfig = jest.fn().mockImplementation((_id: number, name: string) => {
      if (name === 'api_key') return Promise.resolve({ value: 'acct-key-123' });
      if (name === 'default_domain') return Promise.resolve({ value: 'https://shop.example.com' });
      return Promise.resolve(null); // webpush_settings
    });
    (service as any).safeJsonParse = (v: string) => JSON.parse(v);
    (service as any).accountConfigRepository = {
      manager: { query: jest.fn().mockResolvedValue(fcmValue === undefined ? [] : [{ value: fcmValue }]) },
    };
    return { service };
  }

  const WEB_CONFIG = { apiKey: 'AIza-bms-open', authDomain: 'bms-open.firebaseapp.com', projectId: 'bms-open', messagingSenderId: '799302104089', appId: '1:799:web:abc' };
  const VAPID = 'BPlatformVapidPublicKey123';

  it('injects the platform firebaseConfig + vapidKey into the snippet when fcm_settings is set', async () => {
    const { service } = build({ webConfig: WEB_CONFIG, vapidPublicKey: VAPID });
    const { snippet } = await service.getWebPushIntegration(7);

    expect(snippet).toContain('firebaseConfig:');
    expect(snippet).toContain('"projectId":"bms-open"');
    expect(snippet).toContain('"messagingSenderId":"799302104089"');
    expect(snippet).toContain(`vapidKey: '${VAPID}'`);
    // sanity: account api_key + startWebPush flag are present too
    expect(snippet).toContain("apiKey: 'acct-key-123'");
    expect(snippet).toContain('startWebPush: true');
  });

  it('omits firebaseConfig + vapidKey when fcm_settings is empty (graceful fallback path)', async () => {
    const { service } = build(undefined); // no fcm_settings row
    const { snippet } = await service.getWebPushIntegration(7);

    expect(snippet).not.toContain('firebaseConfig:');
    expect(snippet).not.toContain('vapidKey:');
    // the rest of the snippet still renders (no broken JS from null lines)
    expect(snippet).toContain('startWebPush: true');
    expect(snippet).toContain('window.bmsTrkOptions = bmsTrkOptions;');
  });

  it('omits firebaseConfig when webConfig is an empty object (only vapid present)', async () => {
    const { service } = build({ webConfig: {}, vapidPublicKey: VAPID });
    const { snippet } = await service.getWebPushIntegration(7);

    expect(snippet).not.toContain('firebaseConfig:');
    expect(snippet).toContain(`vapidKey: '${VAPID}'`);
  });
});
