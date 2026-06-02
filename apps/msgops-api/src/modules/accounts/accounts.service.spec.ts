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

describe('AccountsService.getWebPushIntegration — snippet must NOT leak platform Firebase config', () => {
  // SECURITY/PARITY: the snippet the customer pastes must be "dumb" — apiKey +
  // accountHash + flags only. The platform Firebase config + VAPID are injected
  // SERVER-SIDE into /bms/web-push.js (buildWebPush), never into the public HTML.
  // (And it has to be server-side anyway: the bmsPush constructor calls
  // initializeApp() before any snippet override could apply.)
  function build() {
    const service = Object.create(AccountsService.prototype) as AccountsService;
    (service as any).findByAccountConfig = jest.fn().mockImplementation((_id: number, name: string) => {
      if (name === 'api_key') return Promise.resolve({ value: 'acct-key-123' });
      if (name === 'default_domain') return Promise.resolve({ value: 'https://shop.example.com' });
      return Promise.resolve(null); // webpush_settings
    });
    (service as any).safeJsonParse = (v: string) => JSON.parse(v);
    return { service };
  }

  it('renders a snippet with apiKey + accountHash + flags only', async () => {
    const { service } = build();
    const { snippet } = await service.getWebPushIntegration(7);

    expect(snippet).toContain("apiKey: 'acct-key-123'");
    expect(snippet).toContain('accountHash:');
    expect(snippet).toContain('startWebPush: true');
    expect(snippet).toContain('window.bmsTrkOptions = bmsTrkOptions;');
  });

  it('falls back to api_key_tracker when api_key config is absent (the key the tracker auth accepts)', async () => {
    const service = Object.create(AccountsService.prototype) as AccountsService;
    (service as any).findByAccountConfig = jest.fn().mockImplementation((_id: number, name: string) => {
      // account has only api_key_tracker, not api_key (the common real case)
      if (name === 'api_key_tracker') return Promise.resolve({ value: 'tracker-key-166' });
      return Promise.resolve(null);
    });
    (service as any).safeJsonParse = (v: string) => JSON.parse(v);
    const { snippet } = await service.getWebPushIntegration(7);
    expect(snippet).toContain("apiKey: 'tracker-key-166'");
    expect(snippet).not.toContain('<API_KEY>');
  });

  it('does NOT expose firebaseConfig or vapidKey in the snippet', async () => {
    const { service } = build();
    const { snippet } = await service.getWebPushIntegration(7);

    expect(snippet).not.toContain('firebaseConfig');
    expect(snippet).not.toContain('vapidKey');
  });

  it('omits cookiesToSearch when not configured', async () => {
    const { service } = build(); // webpush_cookies_to_search → null
    const { snippet } = await service.getWebPushIntegration(7);
    expect(snippet).not.toContain('cookiesToSearch');
  });

  function buildWithCookies(value: string) {
    const service = Object.create(AccountsService.prototype) as AccountsService;
    (service as any).findByAccountConfig = jest.fn().mockImplementation((_id: number, name: string) => {
      if (name === 'api_key') return Promise.resolve({ value: 'acct-key-123' });
      if (name === 'webpush_cookies_to_search') return Promise.resolve({ value });
      return Promise.resolve(null);
    });
    (service as any).safeJsonParse = (v: string) => JSON.parse(v);
    return { service };
  }

  it('renders cookiesToSearch from a CSV config', async () => {
    const { service } = buildWithCookies('registeredLead, _quiz_maker_quiz');
    const { snippet } = await service.getWebPushIntegration(7);
    expect(snippet).toContain('cookiesToSearch: ["registeredLead","_quiz_maker_quiz"]');
  });

  it('renders cookiesToSearch from a JSON-array config', async () => {
    const { service } = buildWithCookies('["registeredLead"]');
    const { snippet } = await service.getWebPushIntegration(7);
    expect(snippet).toContain('cookiesToSearch: ["registeredLead"]');
  });
});

describe('AccountsService.getWebPushPlatformConfig', () => {
  function build(fcmValue: any) {
    const service = Object.create(AccountsService.prototype) as AccountsService;
    (service as any).accountConfigRepository = {
      manager: { query: jest.fn().mockResolvedValue(fcmValue === undefined ? [] : [{ value: fcmValue }]) },
    };
    return { service };
  }

  it('returns the platform webConfig + vapidPublicKey from fcm_settings', async () => {
    const { service } = build({ webConfig: { projectId: 'bms-open' }, vapidPublicKey: 'BVapid' });
    await expect(service.getWebPushPlatformConfig()).resolves.toEqual({ webConfig: { projectId: 'bms-open' }, vapidPublicKey: 'BVapid' });
  });

  it('returns null when fcm_settings is not configured', async () => {
    const { service } = build(undefined);
    await expect(service.getWebPushPlatformConfig()).resolves.toBeNull();
  });
});
