jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn(),
  AmqpConsumer: jest.fn(),
  createHttpBridgeHandler: jest.fn(),
  EXCHANGES: {
    email: 'bms.email',
    events: 'bms.events',
    leads: 'bms.leads',
    campaigns: 'bms.campaigns',
    triggers: 'bms.triggers',
    push: 'bms.push',
    whatsapp: 'bms.whatsapp',
    sms: 'bms.sms',
    tags: 'bms.tags',
  },
  DLX: 'bms.dlx',
}));

import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  let mockFirebaseProvider: {
    sendFirebaseMessages: jest.Mock;
  };
  let mockEventPublisher: {
    publish: jest.Mock;
    close: jest.Mock;
  };
  let mockRedisClient: {
    exists: jest.Mock;
    getdel: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };
  let mockRedisService: {
    getClient: jest.Mock;
  };
  let mockUtils: {
    parseVariables: jest.Mock;
    parseContent: jest.Mock;
    getDomainFromUrl: jest.Mock;
    createQueryParams: jest.Mock;
  };

  const account = {
    id: 1,
    accountConfigs: [
      { name: 'default_domain', value: 'https://example.com' },
      { name: 'language', value: 'en-US' },
      { name: 'time_zone', value: 'UTC' },
      { name: 'firebase_service_account_app', value: '{"project_id":"app"}' },
    ],
    customFields: [],
  };

  const contact = {
    id: 99,
    uuid: 'uuid-99',
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    email: 'john@example.com',
    hashedEmail: 'hash',
    phone: '11999999999',
    customFields: {},
    contactDevices: [
      {
        id: 10,
        accountId: 1,
        contactId: 99,
        type: 'web-push',
        token: 'token-1',
        isUnsubscribed: false,
        isActive: true,
      },
    ],
  };

  const message = {
    id: 55,
    accountId: 1,
    title: 'Title',
    subject: 'Hello %NAME%',
    content: 'Body %NAME%',
    url: 'https://example.com/landing?utm_source=custom&utm_medium=custom-medium',
    type: 'web-push',
  };

  const nextData = {
    id: 'state-1',
    automation: { id: 'a-1', type: 'email', activeStep: {}, steps: {} },
    contact: { id: 99 },
    tagName: 'tag',
    createdAt: 0,
    startedAt: 0,
    activeStepId: 'step-1',
  };

  beforeEach(() => {
    process.env.FIREBASE_SERVICE_ACCOUNT = '{"project_id":"default"}';

    mockFirebaseProvider = {
      sendFirebaseMessages: jest.fn().mockResolvedValue({ successCount: 1, failureCount: 0, responses: [] }),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockRedisClient = {
      exists: jest.fn().mockResolvedValue(0),
      getdel: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    mockUtils = {
      parseVariables: jest.fn((content: string) => content),
      parseContent: jest.fn((content: string) => content),
      getDomainFromUrl: jest.fn(() => 'example.com'),
      createQueryParams: jest.fn((params: Record<string, unknown>) =>
        Object.entries(params)
          .map(([key, value]) => `${key}=${value}`)
          .join('&')
      ),
    };

    service = new AppService(
      mockRedisService as never,
      mockFirebaseProvider as never,
      mockEventPublisher as never,
      mockUtils as never
    );
  });

  it('should return hello world', () => {
    expect(service.getHello()).toBe('Hello World!');
  });

  it('definedFirebaseService should use the per-account config for mobile-push', () => {
    const result = service.definedFirebaseService(account as never, 'mobile-push');

    expect(result).toEqual({
      service: '{"project_id":"app"}',
      firebaseApp: 'push-account-1',
    });
  });

  it('definedFirebaseService should ALSO use the per-account config for web-push (per-account with platform fallback)', () => {
    // Previously web-push always fell back to the platform env credential. Now
    // both push types honor the account's own firebase_service_account_app.
    const result = service.definedFirebaseService(account as never, 'web-push');

    expect(result).toEqual({
      service: '{"project_id":"app"}',
      firebaseApp: 'push-account-1',
    });
  });

  it('definedFirebaseService should fall back to the platform credential when the account has no config', () => {
    const accountNoFirebaseCfg = {
      ...account,
      accountConfigs: account.accountConfigs.filter((cfg) => cfg.name !== 'firebase_service_account_app'),
    };
    // Both push types fall back to the super-admin/platform env credential.
    expect(service.definedFirebaseService(accountNoFirebaseCfg as never, 'mobile-push')).toEqual({
      service: '{"project_id":"default"}',
      firebaseApp: 'default',
    });
    expect(service.definedFirebaseService(accountNoFirebaseCfg as never, 'web-push')).toEqual({
      service: '{"project_id":"default"}',
      firebaseApp: 'default',
    });
  });

  it('redisExists should proxy exists call', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(1);

    await expect(service.redisExists('my-key')).resolves.toBe(1);
    expect(mockRedisClient.exists).toHaveBeenCalledWith('my-key');
  });

  it('setRedis should set with and without expiration', async () => {
    await service.setRedis('k1', { ok: true }, 60);
    await service.setRedis('k2', 'value', 0);

    expect(mockRedisClient.set).toHaveBeenNthCalledWith(1, 'k1', JSON.stringify({ ok: true }), 'EX', 60);
    expect(mockRedisClient.set).toHaveBeenNthCalledWith(2, 'k2', JSON.stringify('value'));
  });

  it('getDelRedis should parse payload from redis', async () => {
    mockRedisClient.getdel.mockResolvedValueOnce('{"ok":true}');

    await expect(service.getDelRedis('payload-key')).resolves.toEqual({ ok: true });
    expect(mockRedisClient.getdel).toHaveBeenCalledWith('payload-key');
  });

  it('getDelRedis should return null when payload is missing', async () => {
    mockRedisClient.getdel.mockResolvedValueOnce(null);

    await expect(service.getDelRedis('payload-key')).resolves.toBeNull();
    expect(mockRedisClient.getdel).toHaveBeenCalledWith('payload-key');
  });

  it('addDefaultUTMs should merge defaults with existing query params', () => {
    const url = 'https://example.com/path?utm_source=existing&utm_medium=existing-medium&x=1';

    const result = service.addDefaultUTMs(url, account as never, 'campaign-1', 'web-push');

    expect(result).toContain('https://example.com/path?');
    expect(mockUtils.createQueryParams).toHaveBeenCalledWith({
      utm_source: 'existing',
      utm_medium: 'existing-medium',
      utm_campaign: 'campaign-1',
      x: '1',
    });
  });

  it('addDefaultUTMs should warn and continue when default_domain is missing', () => {
    const accountWithoutDomain = {
      ...account,
      accountConfigs: account.accountConfigs.filter((cfg) => cfg.name !== 'default_domain'),
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = service.addDefaultUTMs('', accountWithoutDomain as never, 'campaign-1', 'web-push');

    expect(result).toBe('');
    expect(warnSpy).toHaveBeenCalledWith('[AppService] Account 1 has no default_domain');
  });

  it('processSent should publish only when messages are present', async () => {
    await service.processSent([{ data: { id: '1' } } as never], 'web-push');

    expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      'bms.events',
      'event.received.push',
      { payload: expect.any(Array) },
      expect.objectContaining({ platform: 'push', message_type: 'web-push' })
    );

    mockEventPublisher.publish.mockClear();

    await service.processSent([], 'web-push');
    expect(mockEventPublisher.publish).not.toHaveBeenCalled();
  });

  it('processSingle should return early when message is already processing', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(1);

    const sendPushMessage = {
      automationId: 100,
      message,
      contact,
    };

    await expect(service.processSingle(sendPushMessage as never, '')).resolves.toBeUndefined();
    expect(mockFirebaseProvider.sendFirebaseMessages).not.toHaveBeenCalled();
  });

  it('processSingle should return early when message is already processed', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    const sendPushMessage = {
      automationId: 100,
      message,
      contact,
    };

    await expect(service.processSingle(sendPushMessage as never, '')).resolves.toBeUndefined();
    expect(mockFirebaseProvider.sendFirebaseMessages).not.toHaveBeenCalled();
  });

  it('processSingle should handle contacts without active devices for message type', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const sendPushMessage = {
      startedAt: 1,
      automationId: 100,
      automationName: 'auto',
      automationType: 'email',
      utmContent: 'content',
      utmCampaign: 'campaign',
      messageId: 'm-1',
      account,
      message,
      contact: {
        ...contact,
        contactDevices: [
          {
            id: 11,
            accountId: 1,
            contactId: 99,
            type: 'mobile-push',
            token: 'token-mobile',
            isUnsubscribed: false,
            isActive: true,
          },
        ],
      },
      next: {
        pubName: 'next-topic',
        data: nextData,
      },
    };

    const result = await service.processSingle(sendPushMessage as never, 'automation-key');

    expect(result).toEqual({
      status: true,
      message: expect.stringContaining('User without active devices'),
    });
    expect(mockEventPublisher.publish).toHaveBeenCalledWith('bms.triggers', 'trigger.process', nextData);
  });

  it('processSingle should send firebase messages and publish next step', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const sendPushMessage = {
      startedAt: 1,
      automationId: 100,
      automationName: 'auto',
      automationType: 'email',
      utmContent: 'content',
      utmCampaign: 'campaign',
      messageId: 'm-1',
      account,
      message,
      contact,
      next: {
        pubName: 'next-topic',
        data: nextData,
      },
    };

    const result = await service.processSingle(sendPushMessage as never, 'automation-key');

    expect(mockFirebaseProvider.sendFirebaseMessages).toHaveBeenCalledTimes(1);
    expect(mockEventPublisher.publish).toHaveBeenCalledWith('bms.triggers', 'trigger.process', nextData);
    expect(result).toEqual({ status: true, message: 'message sent to bms.triggers/trigger.process.' });
  });

  it('processSingle should log when contact uuid is empty', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const sendPushMessage = {
      startedAt: 1,
      automationId: 100,
      automationName: 'auto',
      automationType: 'email',
      utmContent: 'content',
      utmCampaign: 'campaign',
      messageId: 'm-1',
      account,
      message,
      contact: { ...contact, uuid: '' },
      next: {
        pubName: 'next-topic',
        data: nextData,
      },
    };

    const logSpy = jest.spyOn(service, 'logInfo');

    await service.processSingle(sendPushMessage as never, 'automation-key');

    expect(logSpy).toHaveBeenCalledWith('empty uuid', expect.any(String));
  });

  it('processSingle should delete processing key and throw when firebase send fails', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockFirebaseProvider.sendFirebaseMessages.mockRejectedValueOnce(new Error('fcm failed'));

    const sendPushMessage = {
      startedAt: 1,
      automationId: 100,
      automationName: 'auto',
      automationType: 'email',
      utmContent: 'content',
      utmCampaign: 'campaign',
      messageId: 'm-1',
      account,
      message,
      contact,
      next: {
        pubName: 'next-topic',
        data: nextData,
      },
    };

    await expect(service.processSingle(sendPushMessage as never, 'automation-key')).rejects.toThrow(
      '[m-1] Error to send message to next-topic error:'
    );
    expect(mockRedisClient.del).toHaveBeenCalledWith('send-push-message-processing:100:55:99');
  });

  it('process should return early when campaign page is already processing', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(1);

    const campaignMessage = {
      campaign: { id: 500, name: 'campaign-name', type: 'simple' },
      page: 1,
      contacts: [],
      message,
      account,
      totalPages: 1,
      campaign_id: 500,
    };

    await expect(service.process(campaignMessage as never, 'campaign-redis-key')).resolves.toBeUndefined();
  });

  it('process should return early when campaign page is already processed', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    const campaignMessage = {
      campaign: { id: 500, name: 'campaign-name', type: 'simple' },
      page: 1,
      contacts: [],
      message,
      account,
      totalPages: 1,
      campaign_id: 500,
    };

    await expect(service.process(campaignMessage as never, 'campaign-redis-key')).resolves.toBeUndefined();
  });

  it('process should process campaign batch and publish tracker', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const campaignMessage = {
      account,
      campaign: {
        id: 500,
        name: 'campaign-name',
        type: 'simple',
      },
      contacts: [contact],
      message,
      page: 1,
      totalPages: 1,
      campaign_id: 500,
    };

    const result = await service.process(campaignMessage as never, 'campaign-redis-key');

    expect(mockFirebaseProvider.sendFirebaseMessages).toHaveBeenCalledTimes(1);
    // 1x event.received.push (processSent) + 1x campaign.tracked (sendTracker)
    expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      'bms.events',
      'event.received.push',
      expect.any(Object),
      expect.objectContaining({ platform: 'push' })
    );
    expect(mockEventPublisher.publish).toHaveBeenCalledWith('bms.campaigns', 'campaign.tracked', expect.any(Object));
    expect(result).toEqual({ status: 201, message: 'ok' });
  });

  it('process should delete processing key and throw when campaign fails', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockFirebaseProvider.sendFirebaseMessages.mockRejectedValueOnce(new Error('campaign failed'));

    const campaignMessage = {
      account,
      campaign: {
        id: 700,
        name: 'campaign-name',
        type: 'simple',
      },
      contacts: [{ ...contact, uuid: '' }],
      message,
      page: 2,
      totalPages: 2,
      campaign_id: 700,
    };

    await expect(service.process(campaignMessage as never, 'campaign-redis-key')).rejects.toThrow(
      '[Campaign] Error to process campaign 700:'
    );
    expect(mockRedisClient.del).toHaveBeenCalledWith('send-push-campaign-page-processing:700:2');
  });

  it('getAccountConfig should support object configs', () => {
    expect(service.getAccountConfig({ language: 'pt-BR' }, 'language')).toBe('pt-BR');
  });

  it('getAccountConfig should return undefined when accountConfigs is undefined', () => {
    expect(service.getAccountConfig(undefined, 'language')).toBeUndefined();
  });

  it('addDefaultUTMs should support repeated query params', () => {
    service.addDefaultUTMs('https://example.com/path?tag=a&tag=b', account as never, 'campaign-2', 'web-push');

    expect(mockUtils.createQueryParams).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: ['a', 'b'],
      })
    );
  });

  it('logInfo should skip logging when LOG_LEVEL is not INFO or DEBUG', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env.LOG_LEVEL = 'WARN';

    expect(service.logInfo('msg', 'payload')).toBeUndefined();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('onApplicationShutdown should log campaign keys state', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    service.onApplicationShutdown('SIGTERM');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SHUTDOWN APP SIGTERM'));
  });

  it('processSingle should handle contacts without next pubName (no active devices)', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const sendPushMessage = {
      startedAt: 1,
      automationId: 200,
      automationName: 'auto',
      automationType: 'email',
      utmContent: 'content',
      utmCampaign: 'campaign',
      messageId: 'm-2',
      account,
      message,
      contact: {
        ...contact,
        contactDevices: [],
      },
      next: { pubName: '', data: null },
    };

    const result = await service.processSingle(sendPushMessage as never, '');

    expect(result).toEqual({
      status: true,
      message: expect.stringContaining('User without active devices'),
    });
    expect(mockEventPublisher.publish).not.toHaveBeenCalled();
  });

  it('processSingle should handle null contactDevices', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const sendPushMessage = {
      startedAt: 1,
      automationId: 200,
      automationName: 'auto',
      automationType: 'email',
      utmContent: 'content',
      utmCampaign: 'campaign',
      messageId: 'm-2',
      account,
      message,
      contact: {
        ...contact,
        contactDevices: undefined,
      },
      next: null,
    };

    const result = await service.processSingle(sendPushMessage as never, '');

    expect(result).toEqual({
      status: true,
      message: expect.stringContaining('User without active devices'),
    });
  });

  it('processSingle should use default language and timezone when not in accountConfigs', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const accountNoLang = {
      id: 2,
      accountConfigs: [],
      customFields: [],
    };

    const contactWithWebPush = {
      ...contact,
      contactDevices: [
        {
          id: 10,
          accountId: 1,
          contactId: 99,
          type: 'web-push',
          token: 'token-1',
          isUnsubscribed: false,
          isActive: true,
        },
      ],
    };

    const sendPushMessage = {
      startedAt: 1,
      automationId: 300,
      automationName: 'auto',
      automationType: 'email',
      utmContent: 'content',
      utmCampaign: 'campaign',
      messageId: 'm-3',
      account: accountNoLang,
      message: { ...message, type: 'web-push', url: undefined },
      contact: contactWithWebPush,
      next: { pubName: 'next-topic', data: nextData },
    };

    const result = await service.processSingle(sendPushMessage as never, '');

    expect(mockFirebaseProvider.sendFirebaseMessages).toHaveBeenCalled();
    expect(result).toEqual({ status: true, message: 'message sent to bms.triggers/trigger.process.' });
  });

  it('processSingle should handle empty messageUrl (domain empty)', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    mockUtils.getDomainFromUrl.mockReturnValue('');

    const contactWithWebPush = {
      ...contact,
      contactDevices: [
        {
          id: 10,
          accountId: 1,
          contactId: 99,
          type: 'web-push',
          token: 'token-1',
          isUnsubscribed: false,
          isActive: true,
        },
      ],
    };

    const sendPushMessage = {
      startedAt: 1,
      automationId: 400,
      automationName: 'auto',
      automationType: 'email',
      utmContent: 'content',
      utmCampaign: 'campaign',
      messageId: 'm-4',
      account,
      message: { ...message, type: 'web-push' },
      contact: contactWithWebPush,
      next: { pubName: '', data: null },
    };

    // addDefaultUTMs returns empty when no valid url
    jest.spyOn(service, 'addDefaultUTMs').mockReturnValue('');

    const result = await service.processSingle(sendPushMessage as never, '');

    expect(mockFirebaseProvider.sendFirebaseMessages).toHaveBeenCalled();
    expect(result).toEqual({ status: true, message: 'message sent to bms.triggers/trigger.process.' });
  });

  it('formattedPayload should include expiryPushInSeconds headers when set', () => {
    const msgWithExpiry = {
      ...message,
      expiryPushInSeconds: 3600,
      image: 'https://img.com/icon.png',
      sound: 'default',
      requireInteraction: false,
    };
    const device = {
      id: 10,
      accountId: 1,
      contactId: 99,
      type: 'web-push',
      token: 'token-1',
      isUnsubscribed: false,
      isActive: true,
    };

    const result = service.formattedPayload(
      device as never,
      msgWithExpiry as never,
      contact as never,
      account as never,
      { contactId: '99' },
      'https://example.com',
      'campaign-1',
      'en-US',
      'UTC'
    );

    expect(result.webpush?.headers?.TTL).toBe('3600');
    expect(result.android?.ttl).toBe(3600);
    expect(result.apns?.headers?.['apns-expiration']).toBeDefined();
    expect(result.android?.notification?.icon).toBe('https://img.com/icon.png');
    expect(result.android?.notification?.sound).toBe('default');
    expect(result.webpush?.notification?.requireInteraction).toBe(false);
  });

  it('formattedPayload should handle no expiryPushInSeconds, no image, no sound', () => {
    const msgMinimal = {
      ...message,
      expiryPushInSeconds: undefined,
      image: undefined,
      sound: undefined,
      requireInteraction: undefined,
    };
    const device = {
      id: 10,
      accountId: 1,
      contactId: 99,
      type: 'web-push',
      token: 'token-1',
      isUnsubscribed: false,
      isActive: true,
    };

    const result = service.formattedPayload(
      device as never,
      msgMinimal as never,
      contact as never,
      account as never,
      { contactId: '99' },
      'https://example.com',
      'campaign-1',
      'en-US',
      'UTC'
    );

    expect(result.webpush?.headers).toBeUndefined();
    expect(result.android?.ttl).toBeUndefined();
    expect(result.apns?.headers).toBeUndefined();
    expect(result.webpush?.notification?.icon).toBe('');
    expect(result.webpush?.notification?.requireInteraction).toBe(true);
  });

  it('process should handle contact without uuid and with default domain', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const campaignMessage = {
      account,
      campaign: { id: 800, name: 'campaign-name', type: 'simple' },
      contacts: [
        {
          ...contact,
          uuid: undefined,
          contactDevices: [
            {
              id: 10,
              accountId: 1,
              contactId: 99,
              type: 'web-push',
              token: 'token-1',
              isUnsubscribed: false,
              isActive: true,
            },
          ],
        },
      ],
      message: { ...message, url: undefined },
      page: 1,
      totalPages: 1,
      campaign_id: 800,
    };

    const result = await service.process(campaignMessage as never, 'campaign-key-default-domain');

    expect(mockFirebaseProvider.sendFirebaseMessages).toHaveBeenCalled();
    expect(result).toEqual({ status: 201, message: 'ok' });
  });

  it('process should handle account without default_domain and message without url', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const accountNoDomain = {
      id: 3,
      accountConfigs: [],
      customFields: [],
    };

    const campaignMessage = {
      account: accountNoDomain,
      campaign: { id: 900, name: 'campaign-name', type: 'simple' },
      contacts: [{ ...contact, contactDevices: [] }],
      message: { ...message, url: undefined },
      page: 1,
      totalPages: 1,
      campaign_id: 900,
    };

    const result = await service.process(campaignMessage as never, 'campaign-key-no-domain');

    // No devices so no firebase messages but still completes
    expect(mockFirebaseProvider.sendFirebaseMessages).toHaveBeenCalledWith([], expect.any(String), expect.any(String));
    expect(result).toEqual({ status: 201, message: 'ok' });
  });

  it('definedFirebaseService should return default when mobile-push but no firebase config', () => {
    const accountNoFirebase = {
      id: 4,
      accountConfigs: [],
    };

    const result = service.definedFirebaseService(accountNoFirebase as never, 'mobile-push');

    expect(result).toEqual({
      service: '{"project_id":"default"}',
      firebaseApp: 'default',
    });
  });

  it('sendTracker should publish tracker event', async () => {
    const campaignMessage = {
      campaign_id: 500,
      campaign: { id: 500, name: 'campaign-name' },
      message: { id: 55, subject: 'Test' },
      page: 1,
      totalPages: 1,
      campaign_test_ab_mode: true,
    };

    await service.sendTracker('SENT_PUSH_BATCH', campaignMessage as never, 10, { extra: 'data' });

    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      'bms.campaigns',
      'campaign.tracked',
      expect.objectContaining({
        campaign_id: 500,
        event: 'SENT_PUSH_BATCH',
        contacts_length: 10,
        data: { extra: 'data' },
        testabMode: true,
      })
    );
  });

  it('addDefaultUTMs should use mobile-push UTM values', () => {
    const url = 'https://example.com/path';
    service.addDefaultUTMs(url, account as never, 'campaign-1', 'mobile-push');

    expect(mockUtils.createQueryParams).toHaveBeenCalledWith(
      expect.objectContaining({
        utm_source: 'app-push',
        utm_medium: 'app',
      })
    );
  });

  it('addDefaultUTMs should fall back to accountDomain when messageUrl is empty', () => {
    service.addDefaultUTMs('', account as never, 'campaign-1');

    expect(mockUtils.createQueryParams).toHaveBeenCalledWith(
      expect.objectContaining({
        utm_source: 'push',
        utm_medium: 'web',
        utm_campaign: 'campaign-1',
      })
    );
  });

  it('logInfo should log when LOG_LEVEL is DEBUG', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env.LOG_LEVEL = 'DEBUG';

    service.logInfo('debug msg');

    expect(consoleSpy).toHaveBeenCalledWith('debug msg', '');
  });

  it('getAccountConfig should return value from array configs', () => {
    const configs = [{ accountId: 1, name: 'language', value: 'en-US', description: '' }];
    expect(service.getAccountConfig(configs, 'language')).toBe('en-US');
    expect(service.getAccountConfig(configs, 'missing')).toBeUndefined();
  });
});
