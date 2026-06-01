import { BmsLeadsController } from './bms-leads.controller';
import { BmsLeadDto, WebPushSubscriptionDto } from './bms-leads.dto';

describe('BmsLeadsController', () => {
  function buildController(overrides: { existing?: any; upsertWebPushDevice?: jest.Mock } = {}) {
    const contactsService = {
      findByProperty: jest.fn().mockResolvedValue(overrides.existing ?? null),
      create: jest.fn().mockResolvedValue({ id: 1, email: 'lead@dominio.com' }),
      update: jest.fn().mockResolvedValue({ id: overrides.existing?.id ?? 1, email: 'lead@dominio.com' }),
      upsertWebPushDevice: overrides.upsertWebPushDevice ?? jest.fn().mockResolvedValue({ deviceId: 1, contactId: 1 }),
    };
    const controller = new BmsLeadsController(contactsService as any);
    return { controller, contactsService };
  }

  const baseDto: BmsLeadDto = {
    contact: { email: 'lead@dominio.com', firstName: 'Fulano', lastName: 'Silva' },
    apiKey: 'irrelevant_here',
    tagName: 'evo-hub',
  };

  it('creates a new contact when none exists for the email and assigns the tag', async () => {
    const { controller, contactsService } = buildController();

    const result = await controller.register(baseDto);

    expect(result).toEqual({ ok: true });
    expect(contactsService.findByProperty).toHaveBeenCalledWith({ email: 'lead@dominio.com' });
    expect(contactsService.create).toHaveBeenCalledTimes(1);
    expect(contactsService.update).not.toHaveBeenCalled();
    // Tag arrives as tagNames[] — the evo-academy pixel sends singular `tagName`
    // but the service contract is the array form.
    expect(contactsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'lead@dominio.com',
        firstName: 'Fulano',
        lastName: 'Silva',
        tagNames: ['evo-hub'],
      }),
    );
  });

  it('updates the existing contact when a match by email is found (idempotent retries)', async () => {
    const existing = { id: 99, email: 'lead@dominio.com', accountId: 1 };
    const { controller, contactsService } = buildController({ existing });

    const result = await controller.register(baseDto);

    expect(result).toEqual({ ok: true });
    expect(contactsService.update).toHaveBeenCalledTimes(1);
    expect(contactsService.create).not.toHaveBeenCalled();
    expect(contactsService.update).toHaveBeenCalledWith(expect.objectContaining({ email: 'lead@dominio.com', tagNames: ['evo-hub'] }), existing);
  });

  it('defaults firstName/lastName to empty strings when the pixel omits them', async () => {
    const { controller, contactsService } = buildController();

    await controller.register({ ...baseDto, contact: { email: 'lead@dominio.com' } });

    expect(contactsService.create).toHaveBeenCalledWith(expect.objectContaining({ firstName: '', lastName: '' }));
  });

  it('passes phone through so ContactEntity @BeforeInsert mirrors it into whatsapp (send-whatsapp reads contact.whatsapp)', async () => {
    const { controller, contactsService } = buildController();

    await controller.register({
      ...baseDto,
      contact: { email: 'lead@dominio.com', phone: '+5511999999999' },
    });

    expect(contactsService.create).toHaveBeenCalledWith(expect.objectContaining({ phone: '+5511999999999' }));
  });

  it('honors an explicit whatsapp value distinct from phone (callers that already split the columns)', async () => {
    const { controller, contactsService } = buildController();

    await controller.register({
      ...baseDto,
      contact: { email: 'lead@dominio.com', phone: '+5511111111111', whatsapp: '+5511999999999' },
    });

    expect(contactsService.create).toHaveBeenCalledWith(expect.objectContaining({ phone: '+5511111111111', whatsapp: '+5511999999999' }));
  });

  it('returns the minimal envelope { ok: true } — never leaks the contact row to the external webhook caller', async () => {
    const { controller, contactsService } = buildController();
    contactsService.create.mockResolvedValue({ id: 123, email: 'lead@dominio.com', accountId: 1, hashedEmail: 'leak' });

    const result = await controller.register(baseDto);

    expect(result).toEqual({ ok: true });
    expect(Object.keys(result)).toEqual(['ok']);
  });

  describe('registerWebPush (POST /bms/leads/web-push)', () => {
    const webPushDto: WebPushSubscriptionDto = {
      contact: {
        email: 'sub@dominio.com',
        uuid: 'uuid-1',
        devices: [
          {
            token: 'fcm-token-1',
            type: 'web-push',
            os: 'mac',
            browser: 'chrome',
            browserVersion: '120',
            deviceType: 'desktop',
            resolution: '1920x1080',
            subscriptionUrl: 'https://shop.dominio.com/p/1',
          },
        ],
      },
      apiKey: 'irrelevant_here',
    };

    it('maps the first device into upsertWebPushDevice and returns the deviceId', async () => {
      const upsertWebPushDevice = jest.fn().mockResolvedValue({ deviceId: 42, contactId: 9 });
      const { controller, contactsService } = buildController({ upsertWebPushDevice });

      const result = await controller.registerWebPush(webPushDto);

      expect(contactsService.upsertWebPushDevice).toHaveBeenCalledWith({
        contact: { email: 'sub@dominio.com', uuid: 'uuid-1' },
        device: {
          token: 'fcm-token-1',
          type: 'web-push',
          os: 'mac',
          browser: 'chrome',
          browserVersion: '120',
          deviceType: 'desktop',
          resolution: '1920x1080',
          subscriptionUrl: 'https://shop.dominio.com/p/1',
        },
      });
      expect(result).toEqual({ ok: true, deviceId: 42 });
    });

    it('forwards an anonymous subscription (no email) — token must not be lost', async () => {
      const upsertWebPushDevice = jest.fn().mockResolvedValue({ deviceId: 7, contactId: 3 });
      const { controller, contactsService } = buildController({ upsertWebPushDevice });

      const result = await controller.registerWebPush({
        ...webPushDto,
        contact: { devices: [{ token: 'anon-token' }] },
      } as WebPushSubscriptionDto);

      expect(contactsService.upsertWebPushDevice).toHaveBeenCalledWith(
        expect.objectContaining({ contact: { email: undefined, uuid: undefined }, device: expect.objectContaining({ token: 'anon-token' }) }),
      );
      expect(result).toEqual({ ok: true, deviceId: 7 });
    });
  });

  describe('update (POST /bms/leads/update)', () => {
    const updateDto = { contact: { uuid: 'u-1', customFields: { plan: 'pro' } }, tagName: 'engaged', apiKey: 'k' };

    it('updates the contact resolved by uuid with tag + custom fields', async () => {
      const existing = { id: 9, uuid: 'u-1', email: 'a@b.com', firstName: 'A', lastName: 'B', phone: '', whatsapp: '' };
      const { controller, contactsService } = buildController({ existing });

      const result = await controller.update(updateDto as any);

      expect(contactsService.findByProperty).toHaveBeenCalledWith({ uuid: 'u-1' });
      expect(contactsService.update).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com', tagNames: ['engaged'], customFields: { plan: 'pro' } }), existing);
      expect(result).toEqual({ ok: true });
    });

    it('is a no-op (still ok) when the uuid does not resolve', async () => {
      const { controller, contactsService } = buildController({ existing: null });
      const result = await controller.update(updateDto as any);
      expect(contactsService.update).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });
  });
});
