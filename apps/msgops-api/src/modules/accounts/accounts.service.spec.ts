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
