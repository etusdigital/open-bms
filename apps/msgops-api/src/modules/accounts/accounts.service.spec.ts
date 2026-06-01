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
