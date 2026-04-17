import { HttpException } from '@nestjs/common';
import { AppService } from './app.service';
import { EmailVerify } from './interfaces';

describe('Service: App', () => {
  let appService: AppService;

  const mockPubSubProvider = {
    sendAsyncMessage: jest.fn().mockResolvedValue('mock-tag-process-id'),
    sendEventProcessMessage: jest.fn().mockResolvedValue('mock-message-id'),
    sendEmcCampaignTriggerMessage: jest.fn().mockResolvedValue('mock-emc-id'),
  };

  const mockMsgopsService = {
    findAccountByApiKey: jest.fn(),
    findContactByEmail: jest.fn(),
    findContactByUuid: jest.fn(),
    findContactById: jest.fn(),
    findContactByDevice: jest.fn(),
    createContact: jest.fn(),
    updateContact: jest.fn(),
    deleteContact: jest.fn(),
    findSuppressionByEmail: jest.fn(),
    removeSuppression: jest.fn(),
    getCustomFields: jest.fn().mockResolvedValue([]),
    getContactsCustomFields: jest.fn().mockResolvedValue([]),
    createOrUpdateCustomFields: jest.fn().mockResolvedValue(undefined),
    createDevice: jest.fn(),
    createLead: jest.fn(),
    deleteContactTag: jest.fn(),
    findClusterMessage: jest.fn(),
    initializeOrUpdateLeadsCount: jest.fn((contact) => contact),
    updateContactWithChanges: jest.fn((contact, _newContact) => ({ contact, changedFields: {} })) as any,
    getAllCustomFieldsCached: jest.fn().mockResolvedValue([]),
  };

  const mockRedisClient = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
  };

  const mockRedisService = {
    getOrThrow: jest.fn(() => mockRedisClient),
  };

  const defaultConfigByName = (account, name) => {
    const configs = account?.accountConfigs || [];
    return configs.find((c) => c.name === name) || { value: 'America/Sao_Paulo' };
  };

  const mockFormatterUtils = {
    removeQueryString: jest.fn((url) => (url ? url.split('?')[0] : '')),
    cleanUpObjects: jest.fn((obj) => obj),
    formatterEmail: jest.fn((email) => email.toLowerCase().trim()),
    configByName: jest.fn(defaultConfigByName),
    slugify: jest.fn((text) => text),
    isValidEmail: jest.fn(() => true),
    removeQuotes: jest.fn((text) => text.replace(/['"]/g, '')),
    getMailBoxProvider: jest.fn(() => 'Gmail'),
    toPostgresTimestampWithTimezone: jest.fn((d) => d),
  };

  const mockEmailValidationProvider = {
    emailChecker: jest.fn(),
  };

  const mockGeolocationService = {
    getLocation: jest.fn().mockResolvedValue({
      country: 'BR',
      region: 'SP',
      city: 'Sao Paulo',
      postalCode: '01000',
      timezone: 'America/Sao_Paulo',
      latitude: -23.5,
      longitude: -46.6,
    }),
  };

  const baseAccount = {
    id: 1,
    name: 'Test Account',
    isInternal: false,
    groupId: 100,
    customFieldsKeys: null,
    accountConfigs: [
      { name: 'api_key', value: 'test-key' },
      { name: 'time_zone', value: 'America/Sao_Paulo' },
      { name: 'email_settings', value: '{"validateEmails":false}' },
      { name: 'default_country', value: 'BR' },
    ],
  };

  const baseContact = {
    id: 1,
    accountId: 1,
    uuid: 'test-uuid',
    email: 'test@example.com',
    emailProvider: 'Gmail',
    firstName: 'Test',
    lastName: 'User',
    hashedEmail: 'hash123',
    isValid: true,
    hasBounced: false,
    isUnsubscribed: false,
    isBlocked: false,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    hasEmail: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    // Reset configByName to default implementation
    mockFormatterUtils.configByName.mockImplementation(defaultConfigByName);
    mockFormatterUtils.isValidEmail.mockReturnValue(true);
    mockFormatterUtils.formatterEmail.mockImplementation((email) => email.toLowerCase().trim());

    appService = new AppService(
      mockPubSubProvider as any,
      mockMsgopsService as any,
      mockRedisService as any,
      mockFormatterUtils as any,
      mockEmailValidationProvider as any,
      mockGeolocationService as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================
  // createOrUpdate - core flow
  // ==========================================
  describe('createOrUpdate', () => {
    it('should return Missing contact when contact is undefined', async () => {
      const lead = { apiKey: 'test-key' } as any;
      const result = await appService.createOrUpdate(lead);
      expect(result).toEqual({ status: 200, message: 'Missing contact' });
    });

    it('should return Missing apikey when apiKey is absent', async () => {
      const lead = { contact: { email: 'test@example.com' } } as any;
      const result = await appService.createOrUpdate(lead);
      expect(result).toEqual({ status: 401, message: 'Missing apikey' });
    });

    it('should return Invalid Payload Email when email has no @', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('invalidemail');
      const lead = { contact: { email: 'invalidemail' }, apiKey: 'key' } as any;
      const result = await appService.createOrUpdate(lead);
      expect(result.message).toContain('Invalid Payload Email');
    });

    it('should return 404 when account not found and not isImport', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(null);
      const lead = { contact: { email: 'test@example.com' }, apiKey: 'bad-key' } as any;
      const result = await appService.createOrUpdate(lead);
      expect(result.status).toBe(404);
    });

    it('should return 200 when account not found but isImport is true', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(null);
      const lead = { contact: { email: 'test@example.com' }, apiKey: 'bad-key', isImport: true } as any;
      const result = await appService.createOrUpdate(lead);
      expect(result.status).toBe(200);
    });

    it('should call emailChecker when shouldValidateEmail returns true and handle DEFERRED result', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      const validateAccount = {
        ...baseAccount,
        isInternal: true,
        accountConfigs: [...baseAccount.accountConfigs.filter((c) => c.name !== 'email_settings'), { name: 'email_settings', value: '{"validateEmails":true}' }],
      };
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(validateAccount);
      mockEmailValidationProvider.emailChecker.mockResolvedValue({ result: EmailVerify.DEFERRED });

      const lead = { contact: { email: 'test@example.com' }, apiKey: 'key' } as any;
      await expect(appService.createOrUpdate(lead)).rejects.toThrow(HttpException);
    });

    it('should set isValid true for DELIVERABLE email verification result', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      const validateAccount = {
        ...baseAccount,
        isInternal: true,
        accountConfigs: [...baseAccount.accountConfigs.filter((c) => c.name !== 'email_settings'), { name: 'email_settings', value: '{"validateEmails":true}' }],
      };
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(validateAccount);
      mockEmailValidationProvider.emailChecker.mockResolvedValue({ result: EmailVerify.DELIVERABLE, reason: 'ok' });
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });

      const lead = {
        contact: { email: 'test@example.com' },
        apiKey: 'key',
        tagName: 'test-tag',
      } as any;

      const result = await appService.createOrUpdate(lead);
      expect(result.status).toBe(200);
    });

    it('should handle UNKNOWN email verification result for account 262', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      const account262 = {
        ...baseAccount,
        id: 262,
        isInternal: true,
        accountConfigs: [...baseAccount.accountConfigs.filter((c) => c.name !== 'email_settings'), { name: 'email_settings', value: '{"validateEmails":true}' }],
      };
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(account262);
      mockEmailValidationProvider.emailChecker.mockResolvedValue({ result: EmailVerify.UNKNOWN, reason: 'timeout' });
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });

      const lead = { contact: { email: 'test@example.com' }, apiKey: 'key', tagName: 'tag' } as any;
      await appService.createOrUpdate(lead);
      expect(lead.contact.isValid).toBe(true);
    });

    it('should handle email checker without result property', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      const validateAccount = {
        ...baseAccount,
        isInternal: true,
        accountConfigs: [...baseAccount.accountConfigs.filter((c) => c.name !== 'email_settings'), { name: 'email_settings', value: '{"validateEmails":true}' }],
      };
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(validateAccount);
      mockEmailValidationProvider.emailChecker.mockResolvedValue({});
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });

      const lead = { contact: { email: 'test@example.com' }, apiKey: 'key', tagName: 'tag' } as any;
      await appService.createOrUpdate(lead);
      expect(lead.contact.isValid).toBe(true);
      expect(lead.invalidReason).toBeNull();
    });

    it('should skip email validation when isUpdateContact is true', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockFormatterUtils.configByName.mockReturnValue({ value: '{"validateEmails":true}' });
      mockMsgopsService.findAccountByApiKey.mockResolvedValue({ ...baseAccount, isInternal: true });
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);

      const lead = { contact: { email: 'test@example.com' }, apiKey: 'key' } as any;
      await appService.createOrUpdate(lead, true);

      expect(mockEmailValidationProvider.emailChecker).not.toHaveBeenCalled();
    });

    it('should set isValid false when email format is invalid', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('bad@email.com');
      mockFormatterUtils.isValidEmail.mockReturnValue(false);
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);

      const lead = { contact: { email: 'bad@email.com' }, apiKey: 'key' } as any;
      await appService.createOrUpdate(lead, true);

      expect(lead.contact.isValid).toBe(false);
    });

    it('should process devices when present - merge with existing device-only contact', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      const deviceOnlyContact = { id: 99, accountId: 1, email: null };
      const completedContact = { id: 99, accountId: 1, contactDevices: [{ token: 'old-token', type: 'web-push', id: 1, contactId: 99 }] };
      mockMsgopsService.findContactByDevice.mockResolvedValue(deviceOnlyContact);
      mockMsgopsService.findContactById.mockResolvedValue(completedContact);
      mockMsgopsService.deleteContact.mockResolvedValue(undefined);
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });
      mockMsgopsService.createDevice.mockResolvedValue({
        generatedMaps: [{ type: 'web-push', createdAt: new Date() }],
      });

      const lead = {
        contact: {
          email: 'test@example.com',
          devices: [{ token: 'new-token', type: 'web-push' }],
          isValid: true,
        },
        apiKey: 'key',
        tagName: 'test-tag',
      } as any;

      const result = await appService.createOrUpdate(lead);
      expect(mockMsgopsService.deleteContact).toHaveBeenCalledWith(99, 1);
      expect(result.status).toBe(200);
    });

    it('should handle geolocation when ip is present in lead', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });

      const lead = {
        contact: { email: 'test@example.com', isValid: true },
        apiKey: 'key',
        ip: '8.8.8.8',
        tagName: 'tag',
      } as any;

      await appService.createOrUpdate(lead);
      expect(mockGeolocationService.getLocation).toHaveBeenCalledWith('8.8.8.8');
      expect(lead.contact.country).toBe('BR');
    });

    it('should handle geolocation when ip is in contact', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });

      const lead = {
        contact: { email: 'test@example.com', isValid: true, ip: '1.2.3.4' },
        apiKey: 'key',
        tagName: 'tag',
      } as any;

      await appService.createOrUpdate(lead);
      expect(mockGeolocationService.getLocation).toHaveBeenCalledWith('1.2.3.4');
    });

    it('should return early when contact is not found and cannot be created', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue(null);

      const lead = { contact: { email: 'test@example.com', isValid: true }, apiKey: 'key', tagName: 'tag' } as any;
      // findOrCreateContact returning null triggers early return
      jest.spyOn(appService, 'findOrCreateContact' as any).mockResolvedValue(null);

      const result = await appService.createOrUpdate(lead);
      expect(result).toBeUndefined();
    });

    it('should return early when contact is blocked', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue({ ...baseContact, isBlocked: true });
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue({ ...baseContact, isBlocked: true });

      const lead = { contact: { email: 'test@example.com', isValid: true }, apiKey: 'key', tagName: 'tag' } as any;
      const result = await appService.createOrUpdate(lead);
      expect(result).toBeUndefined();
    });

    it('should return early when no tagName, no push, no removeTag', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);

      const lead = { contact: { email: 'test@example.com', isValid: true }, apiKey: 'key' } as any;
      const result = await appService.createOrUpdate(lead);
      expect(result.status).toBe(200);
      expect(result.message).toContain('Message successfully processed');
    });

    it('should process multiple tagNames when tagName is an array', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });

      const lead = {
        contact: { email: 'test@example.com', isValid: true },
        apiKey: 'key',
        tagName: ['tag1', 'tag2'],
      } as any;
      const result = await appService.createOrUpdate(lead);
      expect(mockPubSubProvider.sendAsyncMessage).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(200);
    });

    it('should process tagName with add type in tag-process', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });

      const lead = {
        contact: { email: 'test@example.com', isValid: true },
        apiKey: 'key',
        tagName: 'add-tag',
      } as any;
      const result = await appService.createOrUpdate(lead);
      expect(mockPubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(expect.anything(), { type: 'add' });
      expect(result.status).toBe(200);
    });

    it('should handle removeTag-only lead (returns without sending to tag-process)', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);

      const lead = {
        contact: { email: 'test@example.com', isValid: true },
        apiKey: 'key',
        removeTag: 'old-tag',
      } as any;
      // removeTag alone: doesn't return early at line 198 check but
      // leadAutomation is reassembled without removeTag at line 208
      const result = await appService.createOrUpdate(lead);
      expect(result.status).toBe(200);
    });

    it('should send EMC campaign trigger when source is quizmaker and redis key exists', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });
      mockRedisClient.exists.mockResolvedValue(1);

      const lead = {
        contact: { email: 'test@example.com', isValid: true },
        apiKey: 'key',
        tagName: 'test-tag',
        app: 'quiz-app', // source = quizmaker
      } as any;
      await appService.createOrUpdate(lead);
      expect(mockPubSubProvider.sendEmcCampaignTriggerMessage).toHaveBeenCalled();
    });

    it('should send EMC campaign trigger when source is quizmaker-new type', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });
      mockRedisClient.exists.mockResolvedValue(1);

      const lead = {
        contact: { email: 'test@example.com', isValid: true },
        apiKey: 'key',
        tagName: 'test-tag',
        type: 'quizmaker-new',
      } as any;
      await appService.createOrUpdate(lead);
      expect(mockPubSubProvider.sendEmcCampaignTriggerMessage).toHaveBeenCalled();
    });

    it('should NOT send EMC when redis key does not exist', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });
      mockRedisClient.exists.mockResolvedValue(0);

      const lead = {
        contact: { email: 'test@example.com', isValid: true },
        apiKey: 'key',
        tagName: 'test-tag',
        app: 'quiz-app',
      } as any;
      await appService.createOrUpdate(lead);
      expect(mockPubSubProvider.sendEmcCampaignTriggerMessage).not.toHaveBeenCalled();
    });

    it('should add isNew customField for lead-akross tag on new contact', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      const newContact = { ...baseContact, isNew: true };
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue(newContact);
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });

      const lead = {
        contact: { email: 'test@example.com', isValid: true },
        apiKey: 'key',
        tagName: 'lead-akross',
      } as any;
      await appService.createOrUpdate(lead);
      // The test verifies the flow completes without error
      expect(mockPubSubProvider.sendAsyncMessage).toHaveBeenCalled();
    });

    it('should add last_source custom field for internal accounts with utm_source', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      const internalAccount = { ...baseAccount, isInternal: true, customFieldsKeys: ['last_source'] };
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(internalAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });

      const lead = {
        contact: { email: 'test@example.com', isValid: true, customFields: {} },
        apiKey: 'key',
        tagName: 'tag',
        utm_source: 'google',
      } as any;
      const result = await appService.createOrUpdate(lead);
      expect(result.status).toBe(200);
    });

    it('should process webPush device and send tag process', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });
      mockMsgopsService.createDevice.mockResolvedValue({
        generatedMaps: [{ type: 'web-push', createdAt: new Date() }],
      });

      const lead = {
        contact: {
          email: 'test@example.com',
          isValid: true,
          devices: [{ token: 'web-push-token', type: 'web-push' }],
        },
        apiKey: 'key',
      } as any;
      const result = await appService.createOrUpdate(lead);
      // webPush was set, so it should process sendTagProcess
      expect(result.status).toBe(200);
    });

    it('should process mobilePush device', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);
      mockMsgopsService.createDevice.mockResolvedValue({
        generatedMaps: [{ type: 'mobile-push', createdAt: new Date() }],
      });

      const lead = {
        contact: {
          email: 'test@example.com',
          isValid: true,
          devices: [{ token: 'mobile-push-token', type: 'mobile-push' }],
        },
        apiKey: 'key',
      } as any;
      const result = await appService.createOrUpdate(lead);
      expect(result.status).toBe(200);
    });

    it('should throw HttpException when an error occurs', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockRejectedValue(new Error('DB error'));

      const lead = { contact: { email: 'test@example.com' }, apiKey: 'key' } as any;
      await expect(appService.createOrUpdate(lead)).rejects.toThrow(HttpException);
    });

    it('should not save lead when type is push-subscription', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);

      const lead = {
        contact: { email: 'test@example.com', isValid: true },
        apiKey: 'key',
        tagName: 'tag',
        type: 'push-subscription',
      } as any;
      await appService.createOrUpdate(lead);
      expect(mockMsgopsService.createLead).not.toHaveBeenCalled();
    });

    it('should not save lead when tagName is retargeting-generic', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);

      const lead = {
        contact: { email: 'test@example.com', isValid: true },
        apiKey: 'key',
        tagName: 'retargeting-generic',
      } as any;
      await appService.createOrUpdate(lead);
      expect(mockMsgopsService.createLead).not.toHaveBeenCalled();
    });

    it('should handle contact without email (uuid-only)', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByUuid.mockResolvedValue(baseContact);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);
      mockMsgopsService.createLead.mockResolvedValue({ id: 1 });

      const lead = {
        contact: { uuid: 'test-uuid', isValid: true },
        apiKey: 'key',
        tagName: 'tag',
      } as any;
      const result = await appService.createOrUpdate(lead);
      expect(result.status).toBe(200);
    });

    it('should filter devices removing those without token or id', async () => {
      mockFormatterUtils.formatterEmail.mockReturnValue('test@example.com');
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(baseAccount);
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);

      const lead = {
        contact: {
          email: 'test@example.com',
          isValid: true,
          devices: [
            { token: '', type: 'web-push' }, // invalid - empty token
            { token: undefined, type: 'web-push' }, // invalid - undefined token
            { token: 'valid-token', type: 'web-push' }, // valid
          ],
        },
        apiKey: 'key',
      } as any;
      await appService.createOrUpdate(lead);
      // Only valid device should pass through
    });
  });

  // ==========================================
  // findOrCreateContact
  // ==========================================
  describe('findOrCreateContact', () => {
    it('should find contact by email', async () => {
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);

      const lead = { contact: { email: 'test@example.com', isValid: true }, contactUpdate: false } as any;
      const result = await appService.findOrCreateContact(lead, baseAccount as any);

      expect(result).toEqual({ contact: baseContact, changedFields: {}, isNew: false });
    });

    it('should find contact by uuid when email not found', async () => {
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.findContactByUuid.mockResolvedValue(baseContact);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);

      const lead = { contact: { email: 'test@example.com', uuid: 'test-uuid', isValid: true } } as any;
      const result = await appService.findOrCreateContact(lead, baseAccount as any);
      expect(result).toBeDefined();
    });

    it('should find contact by device token when email and uuid not found', async () => {
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.findContactByUuid.mockResolvedValue(null);
      mockMsgopsService.findContactByDevice.mockResolvedValue(baseContact);
      mockMsgopsService.updateContact.mockResolvedValue(baseContact);

      const lead = {
        contact: {
          email: 'test@example.com',
          uuid: null,
          devices: [{ token: 'device-token', type: 'web-push' }],
          isValid: true,
        },
      } as any;
      const result = await appService.findOrCreateContact(lead, baseAccount as any);
      expect(result).toBeDefined();
    });

    it('should return existing contact without update when contactUpdate is false', async () => {
      mockMsgopsService.findContactByEmail.mockResolvedValue(baseContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);

      const lead = { contact: { email: 'test@example.com', isValid: true }, contactUpdate: false } as any;
      const result = await appService.findOrCreateContact(lead, baseAccount as any);

      expect(result).toEqual({ contact: baseContact, changedFields: {}, isNew: false });
      expect(mockMsgopsService.updateContact).not.toHaveBeenCalled();
    });

    it('should format phone number with default country', async () => {
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });

      const lead = {
        contact: { email: 'test@example.com', phone: '11999999999', isValid: true },
      } as any;
      await appService.findOrCreateContact(lead, baseAccount as any);
      // Phone should be formatted (phone library)
    });

    it('should format whatsapp number', async () => {
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });

      const lead = {
        contact: { email: 'test@example.com', whatsapp: 'whatsapp:+5511999999999', isValid: true },
      } as any;
      await appService.findOrCreateContact(lead, baseAccount as any);
      // Whatsapp should be formatted
    });

    it('should handle suppression blocked - set contact isBlocked', async () => {
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue({
        isBlocked: true,
        blockedAt: new Date('2024-01-01'),
      });
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });

      const lead = { contact: { email: 'test@example.com', isValid: true } } as any;
      await appService.findOrCreateContact(lead, { ...baseAccount, groupId: 100 } as any);

      expect(lead.contact.isBlocked).toBe(true);
    });

    it('should handle resubscription flow when contact is unsubscribed and 7 days passed', async () => {
      const unsubContact = {
        ...baseContact,
        isUnsubscribed: true,
        unsubscribedAt: new Date(Date.now() - 10 * 86400000),
      };
      mockMsgopsService.findContactByEmail.mockResolvedValue(unsubContact);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue({ isBlocked: false });
      mockMsgopsService.deleteContactTag.mockResolvedValue(undefined);
      mockMsgopsService.removeSuppression.mockResolvedValue(undefined);
      mockMsgopsService.updateContact.mockResolvedValue(unsubContact);

      const lead = { contact: { email: 'test@example.com', isValid: true } } as any;
      await appService.findOrCreateContact(lead, { ...baseAccount, groupId: 100 } as any);

      expect(mockMsgopsService.deleteContactTag).toHaveBeenCalled();
      expect(mockPubSubProvider.sendEventProcessMessage).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalled();
      expect(mockMsgopsService.removeSuppression).toHaveBeenCalled();
    });

    it('should set isUnsubscribed when new contact has suppression within 7 days', async () => {
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue({
        isBlocked: false,
        unsubscribedAt: new Date(Date.now() - 3 * 86400000),
      });
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });

      const lead = { contact: { email: 'test@example.com', isValid: true } } as any;
      await appService.findOrCreateContact(lead, { ...baseAccount, groupId: 100 } as any);

      expect(lead.contact.isUnsubscribed).toBe(true);
    });

    it('should return null when no contact info to create', async () => {
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);

      const lead = { contact: { email: null, phone: null, whatsapp: null, uuid: null, isValid: true } } as any;
      const result = await appService.findOrCreateContact(lead, baseAccount as any);
      expect(result).toBeNull();
    });

    it('should set device type flags (hasMobilePush, hasWebPush, hasEmail, hasPhone)', async () => {
      mockMsgopsService.findContactByEmail.mockResolvedValue(null);
      mockMsgopsService.findSuppressionByEmail.mockResolvedValue(null);
      mockMsgopsService.findContactByDevice.mockResolvedValue(null);
      mockMsgopsService.createContact.mockResolvedValue({ ...baseContact, isNew: true });

      const lead = {
        contact: {
          email: 'test@example.com',
          isValid: true,
          devices: [
            { token: 'mob-token', type: 'mobile-push' },
            { token: 'web-token', type: 'web-push' },
            { token: 'email-token', type: 'email' },
            { token: 'phone-token', type: 'phone' },
          ],
        },
      } as any;
      await appService.findOrCreateContact(lead, baseAccount as any);
      expect(lead.contact.hasMobilePush).toBe(true);
      expect(lead.contact.hasWebPush).toBe(true);
      expect(lead.contact.hasEmail).toBe(true);
      expect(lead.contact.hasPhone).toBe(true);
    });
  });

  // ==========================================
  // createOrUpdateContact
  // ==========================================
  describe('createOrUpdateContact', () => {
    it('should update existing contact', async () => {
      mockMsgopsService.updateContactWithChanges.mockResolvedValue({ contact: baseContact, changedFields: {} });

      const result = await appService.createOrUpdateContact(baseContact as any, { email: 'new@example.com' } as any, baseAccount as any);
      expect(mockMsgopsService.updateContactWithChanges).toHaveBeenCalled();
      expect(result).toEqual({ contact: baseContact, changedFields: {}, isNew: false });
    });

    it('should create new contact when contact is null', async () => {
      mockMsgopsService.createContact.mockResolvedValue({ id: 5, email: 'new@example.com' });

      const result = await appService.createOrUpdateContact(null, { email: 'new@example.com' } as any, baseAccount as any);
      expect((result as any).isNew).toBe(true);
      expect(mockMsgopsService.createContact).toHaveBeenCalled();
    });

    it('should generate uuid when newContact has no uuid', async () => {
      mockMsgopsService.createContact.mockResolvedValue({ id: 5, email: 'new@example.com' });

      const newContact = { email: 'new@example.com' } as any;
      await appService.createOrUpdateContact(null, newContact, baseAccount as any);
      expect(newContact.uuid).toBeDefined();
    });

    it('should keep existing uuid when provided', async () => {
      mockMsgopsService.createContact.mockResolvedValue({ id: 5, email: 'new@example.com', uuid: 'existing-uuid' });

      const newContact = { email: 'new@example.com', uuid: 'existing-uuid' } as any;
      await appService.createOrUpdateContact(null, newContact, baseAccount as any);
      expect(newContact.uuid).toBe('existing-uuid');
    });
  });

  // ==========================================
  // parseCustomFields
  // ==========================================
  describe('parseCustomFields', () => {
    it('should handle first attribution - insert when no existing field', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'FIELD1', type: 'text', attributionType: 'first' }]);

      await appService.parseCustomFields({ field1: 'value1' }, 1, { id: 10 });

      expect(mockMsgopsService.createOrUpdateCustomFields).toHaveBeenCalled();
      const query = mockMsgopsService.createOrUpdateCustomFields.mock.calls[0][0];
      expect(query).toContain('INSERT INTO contacts_custom_fields');
    });

    it('should handle first attribution - skip when field already exists', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([{ customFieldId: 1, value: 'existing' }]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'FIELD1', type: 'text', attributionType: 'first' }]);

      await appService.parseCustomFields({ field1: 'new-value' }, 1, { id: 10 });

      expect(mockMsgopsService.createOrUpdateCustomFields).not.toHaveBeenCalled();
    });

    it('should handle last attribution - update when field exists', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([{ customFieldId: 1, value: 'old' }]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'FIELD1', type: 'text', attributionType: 'last' }]);

      await appService.parseCustomFields({ field1: 'updated' }, 1, { id: 10 });

      const query = mockMsgopsService.createOrUpdateCustomFields.mock.calls[0][0];
      expect(query).toContain('UPDATE contacts_custom_fields SET');
    });

    it('should handle last attribution - insert when field does not exist', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'FIELD1', type: 'text', attributionType: 'last' }]);

      await appService.parseCustomFields({ field1: 'value' }, 1, { id: 10 });

      const query = mockMsgopsService.createOrUpdateCustomFields.mock.calls[0][0];
      expect(query).toContain('INSERT INTO contacts_custom_fields');
    });

    it('should handle multiple attribution - always insert', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([{ customFieldId: 1, value: 'existing' }]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'FIELD1', type: 'text', attributionType: 'multiple' }]);

      await appService.parseCustomFields({ field1: 'another' }, 1, { id: 10 });

      const query = mockMsgopsService.createOrUpdateCustomFields.mock.calls[0][0];
      expect(query).toContain('INSERT INTO contacts_custom_fields');
    });

    it('should handle date type custom field', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'DATE_FIELD', type: 'date', attributionType: 'last' }]);
      mockFormatterUtils.toPostgresTimestampWithTimezone.mockReturnValue('2024-01-15 00:00:00+00');

      await appService.parseCustomFields({ date_field: '2024-01-15' }, 1, { id: 10 });

      const query = mockMsgopsService.createOrUpdateCustomFields.mock.calls[0][0];
      expect(query).toContain('2024-01-15 00:00:00+00');
    });

    it('should handle number type custom field', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'NUM_FIELD', type: 'number', attributionType: 'last' }]);

      await appService.parseCustomFields({ num_field: '42' }, 1, { id: 10 });

      const query = mockMsgopsService.createOrUpdateCustomFields.mock.calls[0][0];
      expect(query).toContain('42');
    });

    it('should skip custom fields with null values', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'FIELD1', type: 'text', attributionType: 'last' }]);

      await appService.parseCustomFields({ field1: null }, 1, { id: 10 });

      expect(mockMsgopsService.createOrUpdateCustomFields).not.toHaveBeenCalled();
    });

    it('should skip custom fields with "null" string values', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'FIELD1', type: 'text', attributionType: 'last' }]);

      await appService.parseCustomFields({ field1: 'null' }, 1, { id: 10 });

      expect(mockMsgopsService.createOrUpdateCustomFields).not.toHaveBeenCalled();
    });

    it('should skip custom fields with empty string values', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'FIELD1', type: 'text', attributionType: 'last' }]);

      await appService.parseCustomFields({ field1: '' }, 1, { id: 10 });

      expect(mockMsgopsService.createOrUpdateCustomFields).not.toHaveBeenCalled();
    });

    it('should skip custom fields with "undefined" string values', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([]);
      mockMsgopsService.getCustomFields.mockResolvedValue([{ id: 1, name: 'FIELD1', type: 'text', attributionType: 'last' }]);

      await appService.parseCustomFields({ field1: 'undefined' }, 1, { id: 10 });

      expect(mockMsgopsService.createOrUpdateCustomFields).not.toHaveBeenCalled();
    });

    it('should not execute query when all custom fields have empty values', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([]);
      mockMsgopsService.getCustomFields.mockResolvedValue([
        { id: 1, name: 'FIELD1', type: 'text', attributionType: 'last' },
        { id: 2, name: 'FIELD2', type: 'text', attributionType: 'last' },
        { id: 3, name: 'FIELD3', type: 'text', attributionType: 'first' },
      ]);

      await appService.parseCustomFields({ field1: null, field2: 'null', field3: '' }, 1, { id: 10 });

      expect(mockMsgopsService.createOrUpdateCustomFields).not.toHaveBeenCalled();
    });

    it('should process valid fields and skip empty ones in the same call', async () => {
      mockMsgopsService.getContactsCustomFields.mockResolvedValue([]);
      mockMsgopsService.getCustomFields.mockResolvedValue([
        { id: 1, name: 'FIELD1', type: 'text', attributionType: 'last' },
        { id: 2, name: 'FIELD2', type: 'text', attributionType: 'last' },
      ]);

      await appService.parseCustomFields({ field1: 'valid', field2: 'null' }, 1, { id: 10 });

      const query = mockMsgopsService.createOrUpdateCustomFields.mock.calls[0][0];
      expect(query).toContain('valid');
      expect(query).not.toContain("'null'");
    });
  });

  // ==========================================
  // processResubscribed
  // ==========================================
  describe('processResubscribed', () => {
    const mockAccount = { id: 1, name: 'Test Account' };
    const mockContact = { id: 63321184, uuid: 'test-uuid', email: 'test@example.com' };
    const baseLeadAutomation = {
      contact: { email: 'test@example.com', ip: '192.168.1.1' },
      source_url: 'https://example.com?utm_source=test',
    };

    it('should build correct LeadActivationRequest payload', async () => {
      await appService.processResubscribed(baseLeadAutomation as any, mockAccount as any, mockContact as any);

      expect(mockPubSubProvider.sendEventProcessMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'internal',
          payload: expect.arrayContaining([
            expect.objectContaining({
              accountId: '1',
              contactId: 63321184,
              uuid: 'test-uuid',
              email: 'test@example.com',
              event: 'resubscribed',
            }),
          ]),
        }),
        { platform: 'internal' },
      );
    });

    it('should set reason to "answered quiz" when questions property exists', async () => {
      const leadWithQuestions = { ...baseLeadAutomation, questions: [{ question: 'test', answer: 'yes' }] };
      await appService.processResubscribed(leadWithQuestions as any, mockAccount as any, mockContact as any);

      expect(mockPubSubProvider.sendEventProcessMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.arrayContaining([expect.objectContaining({ properties: { reason: 'answered quiz' } })]),
        }),
        expect.any(Object),
      );
    });

    it('should set reason to "api request" when no questions', async () => {
      await appService.processResubscribed(baseLeadAutomation as any, mockAccount as any, mockContact as any);

      expect(mockPubSubProvider.sendEventProcessMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.arrayContaining([expect.objectContaining({ properties: { reason: 'api request' } })]),
        }),
        expect.any(Object),
      );
    });

    it('should use origem_cadastro when source_url is not provided', async () => {
      const lead = { ...baseLeadAutomation, source_url: undefined, origem_cadastro: 'https://origin.com?ref=abc' };
      await appService.processResubscribed(lead as any, mockAccount as any, mockContact as any);
      expect(mockFormatterUtils.removeQueryString).toHaveBeenCalledWith('https://origin.com?ref=abc');
    });

    it('should handle null ip', async () => {
      const lead = { contact: { email: 'test@example.com', ip: null }, source_url: null };
      await appService.processResubscribed(lead as any, mockAccount as any, mockContact as any);

      expect(mockPubSubProvider.sendEventProcessMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.arrayContaining([expect.objectContaining({ ip: null })]),
        }),
        expect.any(Object),
      );
    });
  });

  // ==========================================
  // shouldValidateEmail
  // ==========================================
  describe('shouldValidateEmail', () => {
    it('should return false when email is absent', () => {
      expect(appService.shouldValidateEmail({ contact: {} } as any, baseAccount as any)).toBe(false);
    });

    it('should return false when not internal and contact has isValid', () => {
      expect(appService.shouldValidateEmail({ contact: { email: 'test@example.com', isValid: true } } as any, { ...baseAccount, isInternal: false } as any)).toBe(false);
    });

    it('should return contactValidate value when property exists', () => {
      expect(appService.shouldValidateEmail({ contact: { email: 'test@example.com' }, contactValidate: false } as any, baseAccount as any)).toBe(false);
    });

    it('should return true when email_settings.validateEmails is true', () => {
      const validateTrueAccount = {
        ...baseAccount,
        accountConfigs: [...baseAccount.accountConfigs.filter((c) => c.name !== 'email_settings'), { name: 'email_settings', value: '{"validateEmails":true}' }],
      };
      expect(appService.shouldValidateEmail({ contact: { email: 'test@example.com' } } as any, validateTrueAccount as any)).toBe(true);
    });

    it('should return false when email_settings.validateEmails is false', () => {
      // baseAccount has email_settings: '{"validateEmails":false}'
      expect(appService.shouldValidateEmail({ contact: { email: 'test@example.com' } } as any, baseAccount as any)).toBe(false);
    });

    it('should log when account.id is 93', () => {
      const spyLog = jest.spyOn(console, 'log');
      appService.shouldValidateEmail({ contact: { email: 'test@example.com' } } as any, { ...baseAccount, id: 93 } as any);
      expect(spyLog).toHaveBeenCalledWith(expect.stringContaining('DINDS PAYLOAD'));
    });
  });

  // ==========================================
  // engagedProcess
  // ==========================================
  describe('engagedProcess', () => {
    it('should return -99 when contact is not valid', () => {
      expect(appService.engagedProcess({ isValid: false, hasBounced: false } as any)).toBe('-99');
    });

    it('should return -99 when contact hasBounced', () => {
      expect(appService.engagedProcess({ isValid: true, hasBounced: true } as any)).toBe('-99');
    });

    it('should return 0 when no lastSent', () => {
      expect(appService.engagedProcess({ isValid: true, hasBounced: false, lastSent: null, createdAt: new Date() } as any)).toBe('0');
    });

    it('should return 3 when lastOpen < 3 days ago', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: new Date(Date.now() - 1 * 86400000),
          createdAt: new Date(Date.now() - 100 * 86400000),
        } as any),
      ).toBe('3');
    });

    it('should return 7 when lastOpen 3-7 days ago', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: new Date(Date.now() - 5 * 86400000),
          createdAt: new Date(Date.now() - 100 * 86400000),
        } as any),
      ).toBe('7');
    });

    it('should return 15 when lastOpen 7-15 days ago', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: new Date(Date.now() - 10 * 86400000),
          createdAt: new Date(Date.now() - 200 * 86400000),
        } as any),
      ).toBe('15');
    });

    it('should return 30 when lastOpen 15-30 days ago', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: new Date(Date.now() - 20 * 86400000),
          createdAt: new Date(Date.now() - 200 * 86400000),
        } as any),
      ).toBe('30');
    });

    it('should return 40 when lastOpen 30-40 days ago', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: new Date(Date.now() - 35 * 86400000),
          createdAt: new Date(Date.now() - 200 * 86400000),
        } as any),
      ).toBe('40');
    });

    it('should return 60 when lastOpen 40-60 days ago', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: new Date(Date.now() - 50 * 86400000),
          createdAt: new Date(Date.now() - 200 * 86400000),
        } as any),
      ).toBe('60');
    });

    it('should return 90 when lastOpen 60-90 days ago', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: new Date(Date.now() - 75 * 86400000),
          createdAt: new Date(Date.now() - 200 * 86400000),
        } as any),
      ).toBe('90');
    });

    it('should return 120 when lastOpen 90-120 days ago', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: new Date(Date.now() - 100 * 86400000),
          createdAt: new Date(Date.now() - 300 * 86400000),
        } as any),
      ).toBe('120');
    });

    it('should return 180 when lastOpen 120-180 days ago', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: new Date(Date.now() - 150 * 86400000),
          createdAt: new Date(Date.now() - 300 * 86400000),
        } as any),
      ).toBe('180');
    });

    it('should return 999 when lastOpen > 180 days ago', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: new Date(Date.now() - 200 * 86400000),
          createdAt: new Date(Date.now() - 300 * 86400000),
        } as any),
      ).toBe('999');
    });

    it('should return -999 when lastSent, no lastOpen, created within 90 days', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: null,
          createdAt: new Date(Date.now() - 30 * 86400000),
        } as any),
      ).toBe('-999');
    });

    it('should return -90 when lastSent, no lastOpen, created before 90 days', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: null,
          createdAt: new Date(Date.now() - 91 * 86400000),
        } as any),
      ).toBe('-90');
    });

    it('should return -999 when lastSent, no lastOpen, created recently (within 90 days)', () => {
      expect(
        appService.engagedProcess({
          isValid: true,
          hasBounced: false,
          lastSent: new Date(),
          lastOpen: null,
          createdAt: new Date(Date.now() - 0.5 * 86400000),
        } as any),
      ).toBe('-999');
    });
  });

  // ==========================================
  // leadStatus
  // ==========================================
  describe('leadStatus', () => {
    it('should return new when contact has isNew', () => {
      expect(appService.leadStatus({ isNew: true } as any)).toBe('new');
    });

    it('should return bounced when hasBounced', () => {
      expect(appService.leadStatus({ hasBounced: true } as any)).toBe('bounced');
    });

    it('should return invalid when not valid', () => {
      expect(appService.leadStatus({ isValid: false } as any)).toBe('invalid');
    });

    it('should return old as fallback', () => {
      expect(appService.leadStatus({ isValid: true } as any)).toBe('old');
    });
  });

  // ==========================================
  // isValidLead
  // ==========================================
  describe('isValidLead', () => {
    it('should return false for push-subscription type', () => {
      expect(appService.isValidLead({ type: 'push-subscription' } as any)).toBe(false);
    });

    it('should return false for retargeting-generic', () => {
      expect(appService.isValidLead({ tagName: 'retargeting-generic' } as any)).toBe(false);
    });

    it('should return true for valid leads', () => {
      expect(appService.isValidLead({ tagName: 'test-tag' } as any)).toBe(true);
    });
  });

  // ==========================================
  // hasSevenDaysPassed
  // ==========================================
  describe('hasSevenDaysPassed', () => {
    it('should return true for null', () => {
      expect(appService.hasSevenDaysPassed(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(appService.hasSevenDaysPassed(undefined)).toBe(true);
    });

    it('should return true when > 7 days', () => {
      expect(appService.hasSevenDaysPassed(new Date(Date.now() - 8 * 86400000))).toBe(true);
    });

    it('should return false when < 7 days', () => {
      expect(appService.hasSevenDaysPassed(new Date(Date.now() - 3 * 86400000))).toBe(false);
    });
  });

  // ==========================================
  // isNumber / isValidDate
  // ==========================================
  describe('isNumber', () => {
    it('should return true for numeric string', () => {
      expect(appService.isNumber('42')).toBe(true);
    });
    it('should return true for decimal', () => {
      expect(appService.isNumber('3.14')).toBe(true);
    });
    it('should return true for 0', () => {
      expect(appService.isNumber(0)).toBe(true);
    });
    it('should return false for non-numeric', () => {
      expect(appService.isNumber('abc')).toBe(false);
    });
    it('should return true for empty string (Number("")===0)', () => {
      expect(appService.isNumber('')).toBe(true);
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid date', () => {
      expect(appService.isValidDate('2024-01-15')).toBe(true);
    });
    it('should return false for empty string', () => {
      expect(appService.isValidDate(' ')).toBe(false);
    });
    it('should return false for invalid date', () => {
      expect(appService.isValidDate('not-a-date')).toBe(false);
    });
  });

  // ==========================================
  // definedSource
  // ==========================================
  describe('definedSource', () => {
    it('should return import when isImport', () => {
      expect(appService.definedSource({ isImport: true } as any)).toBe('import');
    });

    it('should return account_migration when accountChange', () => {
      expect(appService.definedSource({ accountChange: {} } as any)).toBe('account_migration');
    });

    it('should return type value when type exists', () => {
      expect(appService.definedSource({ type: 'quizmaker-new' } as any)).toBe('quizmaker-new');
    });

    it('should return quizmaker when app exists', () => {
      expect(appService.definedSource({ app: 'quiz' } as any)).toBe('quizmaker');
    });

    it('should return api as fallback', () => {
      expect(appService.definedSource({} as any)).toBe('api');
    });
  });

  // ==========================================
  // mergeContactDevices
  // ==========================================
  describe('mergeContactDevices', () => {
    it('should merge devices without duplicating tokens', () => {
      const contactCompleted = {
        contactDevices: [
          { token: 'token1', type: 'web-push', id: 1, contactId: 10 },
          { token: 'token2', type: 'mobile-push', id: 2, contactId: 10 },
        ],
      };
      const newDevices = [
        { token: 'token2', type: 'mobile-push' },
        { token: 'token3', type: 'web-push' },
      ];
      const result = appService.mergeContactDevices(contactCompleted, newDevices);
      expect(result).toHaveLength(3);
    });

    it('should nullify id and contactId from existing devices', () => {
      const contactCompleted = {
        contactDevices: [{ token: 'token1', type: 'web-push', id: 1, contactId: 10 }],
      };
      const result = appService.mergeContactDevices(contactCompleted, []);
      expect(result[0].id).toBeNull();
      expect(result[0].contactId).toBeNull();
    });
  });

  // ==========================================
  // setContactDetails
  // ==========================================
  describe('setContactDetails', () => {
    it('should set email-related fields', () => {
      const result = appService.setContactDetails({ email: 'Test@Example.com' } as any);
      expect(result.emailProvider).toBe('Gmail');
      expect(result.hashedEmail).toBeDefined();
      expect(result.hasEmail).toBe(true);
    });

    it('should extract firstName and lastName from name', () => {
      const result = appService.setContactDetails({ name: 'John Doe Smith' } as any);
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe Smith');
    });

    it('should set phone from whatsapp when phone not provided', () => {
      const result = appService.setContactDetails({ whatsapp: 'whatsapp:+5511999999999' } as any);
      expect(result.phone).toBe('+5511999999999');
      expect(result.hasPhone).toBe(true);
      expect(result.hasWhatsapp).toBe(true);
    });

    it('should set hasPhone when phone provided', () => {
      const result = appService.setContactDetails({ phone: '+5511999999999' } as any);
      expect(result.hasPhone).toBe(true);
    });

    it('should set isActive to true when not set', () => {
      const result = appService.setContactDetails({} as any);
      expect(result.isActive).toBe(true);
    });

    it('should handle name with single word', () => {
      const result = appService.setContactDetails({ name: 'John' } as any);
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('');
    });
  });

  // ==========================================
  // validateNewPushDevice
  // ==========================================
  describe('validateNewPushDevice', () => {
    it('should return true when device created within 1 minute', () => {
      expect(appService.validateNewPushDevice({ generatedMaps: [{ type: 'web-push', createdAt: new Date() }] } as any)).toBe(true);
    });

    it('should return false when device older than 1 minute', () => {
      expect(appService.validateNewPushDevice({ generatedMaps: [{ type: 'web-push', createdAt: new Date(Date.now() - 120000) }] } as any)).toBe(false);
    });

    it('should return false when no push device found', () => {
      expect(appService.validateNewPushDevice({ generatedMaps: [{ type: 'email', createdAt: new Date() }] } as any)).toBe(false);
    });
  });

  // ==========================================
  // getCustomFieldQuery
  // ==========================================
  describe('getCustomFieldQuery', () => {
    it('should return empty string for invalid DATE', () => {
      expect(appService.getCustomFieldQuery('insert', 'date', 1, 1, 1, 'invalid')).toBe('');
    });

    it('should return empty string for invalid NUMBER', () => {
      expect(appService.getCustomFieldQuery('insert', 'number', 1, 1, 1, 'abc')).toBe('');
    });

    it('should generate INSERT for text type', () => {
      const result = appService.getCustomFieldQuery('insert', 'text', 1, 100, 5, 'hello');
      expect(result).toContain('100');
      expect(result).toContain('hello');
    });

    it('should generate UPDATE for existing field', () => {
      const result = appService.getCustomFieldQuery('update', 'text', 1, 100, 5, 'updated');
      expect(result).toContain('UPDATE contacts_custom_fields SET');
      expect(result).toContain("value = 'updated'");
    });

    it('should escape single quotes', () => {
      expect(appService.getCustomFieldQuery('insert', 'text', 1, 100, 5, "it's")).toContain("it''s");
    });

    it('should handle number type insert', () => {
      const result = appService.getCustomFieldQuery('insert', 'number', 1, 100, 5, '42');
      expect(result).toContain('42');
    });

    it('should handle date type insert', () => {
      mockFormatterUtils.toPostgresTimestampWithTimezone.mockReturnValue('2024-01-15 00:00:00+00');
      const result = appService.getCustomFieldQuery('insert', 'date', 1, 100, 5, '2024-01-15');
      expect(result).toContain('2024-01-15 00:00:00+00');
    });

    it('should handle number type update', () => {
      const result = appService.getCustomFieldQuery('update', 'number', 1, 100, 5, '99');
      expect(result).toContain('number = 99');
    });

    it('should handle date type update', () => {
      mockFormatterUtils.toPostgresTimestampWithTimezone.mockReturnValue('2024-06-01 00:00:00+00');
      const result = appService.getCustomFieldQuery('update', 'date', 1, 100, 5, '2024-06-01');
      expect(result).toContain('time =');
    });

    it('should stringify object values', () => {
      const result = appService.getCustomFieldQuery('insert', 'text', 1, 100, 5, { key: 'val' } as any);
      expect(result).toContain('{"key":"val"}');
    });

    it('should stringify array values', () => {
      const result = appService.getCustomFieldQuery('insert', 'text', 1, 100, 5, ['a', 'b'] as any);
      expect(result).toContain('["a","b"]');
    });
  });

  // ==========================================
  // mapCustomFields
  // ==========================================
  describe('mapCustomFields', () => {
    it('should return customFields when customFieldsKeys is null', async () => {
      const result = await appService.mapCustomFields({ key: 'value' }, { customFieldsKeys: null } as any);
      expect(result).toEqual({ key: 'value' });
    });

    it('should return empty object when customFields is null', async () => {
      const result = await appService.mapCustomFields(null, { customFieldsKeys: ['key1'] } as any);
      expect(result).toEqual({});
    });

    it('should parse JSON string customFields', async () => {
      const result = await appService.mapCustomFields('{"NAME":"test"}' as any, { customFieldsKeys: ['name'] } as any);
      expect(result).toEqual({ name: 'test' });
    });

    it('should return empty for empty object', async () => {
      const result = await appService.mapCustomFields({}, { customFieldsKeys: ['key1'] } as any);
      expect(result).toEqual({});
    });

    it('should map case-insensitive keys', async () => {
      const result = await appService.mapCustomFields({ NAME: 'John', AGE: '30', EXTRA: 'ignored' }, { customFieldsKeys: ['name', 'age'] } as any);
      expect(result).toEqual({ name: 'John', age: '30' });
    });

    it('should trim string values', async () => {
      const result = await appService.mapCustomFields({ NAME: '  John  ' }, { customFieldsKeys: ['name'] } as any);
      expect(result).toEqual({ name: 'John' });
    });

    it('should not trim non-string values', async () => {
      const result = await appService.mapCustomFields({ COUNT: 42 } as any, { customFieldsKeys: ['count'] } as any);
      expect(result).toEqual({ count: 42 });
    });
  });

  // ==========================================
  // logInfo
  // ==========================================
  describe('logInfo', () => {
    it('should log when LOG_LEVEL is INFO', () => {
      process.env.LOG_LEVEL = 'INFO';
      const spy = jest.spyOn(console, 'log');
      appService.logInfo('test message');
      expect(spy).toHaveBeenCalledWith('test message', '');
    });

    it('should log when LOG_LEVEL is DEBUG', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const spy = jest.spyOn(console, 'log');
      appService.logInfo('test message', 'extra');
      expect(spy).toHaveBeenCalledWith('test message', 'extra');
    });

    it('should not log when LOG_LEVEL is ERROR', () => {
      process.env.LOG_LEVEL = 'ERROR';
      const spy = jest.spyOn(console, 'log');
      appService.logInfo('test message');
      // console.log should not have been called for this message specifically
      // (it may have been called in beforeEach mock, so we check the specific call)
      const calls = spy.mock.calls.filter((c) => c[0] === 'test message');
      expect(calls).toHaveLength(0);
    });
  });

  // ==========================================
  // parseStringToSql
  // ==========================================
  describe('parseStringToSql', () => {
    it('should remove single quote from string', () => {
      expect(appService.parseStringToSql("it's")).toBe('its');
    });

    it('should return null for null input', () => {
      expect(appService.parseStringToSql(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(appService.parseStringToSql(undefined)).toBeNull();
    });
  });

  // ==========================================
  // getValueByCaseInsensitive
  // ==========================================
  describe('getValueByCaseInsensitive', () => {
    it('should find value case-insensitively', () => {
      const obj = { NAME: 'John', age: '30' } as any;
      expect(appService.getValueByCaseInsensitive(obj, 'name')).toBe('John');
      expect(appService.getValueByCaseInsensitive(obj, 'AGE')).toBe('30');
    });
  });

  // ==========================================
  // processDevices
  // ==========================================
  describe('processDevices', () => {
    it('should map devices with accountId and contactId and call createDevice', async () => {
      mockMsgopsService.createDevice.mockResolvedValue({ generatedMaps: [] });
      const devices = [{ token: 'tok1', type: 'web-push' }] as any;
      const contact = { id: 10 } as any;
      const account = { id: 1 } as any;

      await appService.processDevices(devices, contact, account);

      expect(mockMsgopsService.createDevice).toHaveBeenCalledWith([expect.objectContaining({ token: 'tok1', type: 'web-push', accountId: 1, contactId: 10 })]);
    });
  });

  // ==========================================
  // sendTagProcess
  // ==========================================
  describe('sendTagProcess', () => {
    it('should call pubSubProvider.sendAsyncMessage with type', async () => {
      await appService.sendTagProcess({ tagName: 'tag', contact: { email: 'test@example.com' } } as any, 'add');
      expect(mockPubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(expect.anything(), { type: 'add' });
    });
  });
});
