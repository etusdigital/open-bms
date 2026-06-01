import { HttpException } from '@nestjs/common';
import { ContactsService } from './contacts.service';

// Covers the web-push token ingestion path used by POST /bms/leads/web-push.
// A subscriber may be known (email/uuid) or fully anonymous; either way the FCM
// token must land as a ContactDevice and the contact must be flagged hasWebPush.

const ACCOUNT_ID = 42;

function buildService(
  overrides: {
    findByProperty?: jest.Mock;
    create?: jest.Mock;
    contactRepository?: Record<string, jest.Mock>;
    contactDeviceRepository?: Record<string, jest.Mock>;
    accountId?: number | undefined;
  } = {},
) {
  const contactRepository = {
    create: jest.fn((v) => v),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides.contactRepository,
  };
  const contactDeviceRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((v) => v),
    save: jest.fn(),
    ...overrides.contactDeviceRepository,
  };
  const cls = { get: jest.fn().mockReturnValue('accountId' in overrides ? overrides.accountId : ACCOUNT_ID) };

  const service = Object.create(ContactsService.prototype) as ContactsService;
  (service as any).contactRepository = contactRepository;
  (service as any).contactDeviceRepository = contactDeviceRepository;
  (service as any).cls = cls;
  (service as any).logger = { error: jest.fn() };
  (service as any).findByProperty = overrides.findByProperty ?? jest.fn().mockResolvedValue(null);
  (service as any).create = overrides.create ?? jest.fn().mockResolvedValue(undefined);
  return { service, contactRepository, contactDeviceRepository, cls };
}

const DEVICE = {
  token: 'fcm-token-123',
  os: 'mac',
  browser: 'chrome',
  browserVersion: '120',
  deviceType: 'desktop',
  resolution: '1920x1080',
  subscriptionUrl: 'https://shop.example.com/p/1',
};

describe('ContactsService.upsertWebPushDevice', () => {
  afterEach(() => jest.clearAllMocks());

  it('rejects when there is no account context', async () => {
    const { service } = buildService({ accountId: undefined });
    await expect(service.upsertWebPushDevice({ contact: {}, device: DEVICE })).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects when the device token is missing', async () => {
    const { service } = buildService();
    await expect(service.upsertWebPushDevice({ contact: { email: 'a@b.com' }, device: { token: '' } })).rejects.toBeInstanceOf(HttpException);
  });

  it('attaches the token to an existing contact found by email', async () => {
    const findByProperty = jest.fn().mockResolvedValue({ id: 5, accountId: ACCOUNT_ID });
    const { service, contactDeviceRepository, contactRepository } = buildService({
      findByProperty,
      contactDeviceRepository: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((v) => v),
        save: jest.fn().mockResolvedValue({ id: 99 }),
      },
    });

    const out = await service.upsertWebPushDevice({ contact: { email: 'a@b.com' }, device: DEVICE });

    expect(findByProperty).toHaveBeenCalledWith({ email: 'a@b.com', uuid: undefined });
    expect(contactDeviceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID, contactId: 5, token: 'fcm-token-123', type: 'web-push', isActive: true }),
    );
    expect(contactRepository.update).toHaveBeenCalledWith({ id: 5, accountId: ACCOUNT_ID }, { hasWebPush: true });
    expect(out).toEqual({ deviceId: 99, contactId: 5 });
  });

  it('creates an anonymous contact when no email/uuid resolves', async () => {
    const findByProperty = jest.fn().mockResolvedValue(null);
    const { service, contactRepository, contactDeviceRepository } = buildService({
      findByProperty,
      contactRepository: {
        create: jest.fn((v) => v),
        save: jest.fn().mockResolvedValue({ id: 11, accountId: ACCOUNT_ID, hasWebPush: true }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      contactDeviceRepository: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((v) => v),
        save: jest.fn().mockResolvedValue({ id: 77 }),
      },
    });

    const out = await service.upsertWebPushDevice({ contact: {}, device: DEVICE });

    // Anonymous contact row created with the account + hasWebPush flag.
    expect(contactRepository.create).toHaveBeenCalledWith(expect.objectContaining({ accountId: ACCOUNT_ID, hasWebPush: true }));
    expect(contactDeviceRepository.save).toHaveBeenCalledWith(expect.objectContaining({ contactId: 11, token: 'fcm-token-123' }));
    expect(out).toEqual({ deviceId: 77, contactId: 11 });
  });

  it('reactivates an existing device row instead of duplicating it', async () => {
    const findByProperty = jest.fn().mockResolvedValue({ id: 5, accountId: ACCOUNT_ID });
    const existingDevice = { id: 88, isActive: false, isUnsubscribed: true, lastSession: null };
    const { service, contactDeviceRepository } = buildService({
      findByProperty,
      contactDeviceRepository: {
        findOne: jest.fn().mockResolvedValue(existingDevice),
        create: jest.fn((v) => v),
        save: jest.fn().mockResolvedValue(existingDevice),
      },
    });

    const out = await service.upsertWebPushDevice({ contact: { email: 'a@b.com' }, device: DEVICE });

    expect(contactDeviceRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 88, isActive: true, isUnsubscribed: false }));
    expect(contactDeviceRepository.create).not.toHaveBeenCalled();
    expect(out).toEqual({ deviceId: 88, contactId: 5 });
  });
});
