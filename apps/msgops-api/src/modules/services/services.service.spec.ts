import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { PubSubProvider } from '../../providers/pubsub.providers';
import { AccountsService } from '../accounts/accounts.service';
import { ContactsService } from '../contacts/contacts.service';
import { PoolsService } from '../pools/pools.service';
import { ClsService } from 'nestjs-cls';
import { HttpException, HttpStatus } from '@nestjs/common';
import { EmailPriority, SendEmailMessageDto, TransactionalMessage } from './services.dto';
import { AccountEntity } from 'src/entities/account.entity';
import { PoolEntity } from 'src/entities/pool.entity';
import { ContactEntity } from 'src/entities/contact.entity';
import { SendEmailMessageSchema } from './services.dto';
import { MessagesService } from '../messages/messages.service';
import { MessageEntity } from 'src/entities/message.entity';
import { MessageStatus } from '../messages/messages.interface';
import * as utils from '../../utils/utils.service';
import { AccountCacheService } from '../accounts/account-cache.service';

describe('ServicesService', () => {
  let service: ServicesService;
  let pubSubProvider: jest.Mocked<PubSubProvider>;
  let accountService: jest.Mocked<AccountsService>;
  let contactService: jest.Mocked<ContactsService>;
  let poolService: jest.Mocked<PoolsService>;
  let clsService: jest.Mocked<ClsService>;
  let messagesService: jest.Mocked<MessagesService>;

  const mockAccount: AccountEntity = {
    id: 1,
    name: 'Test Account',
    isActive: true,
    isInternal: true,
    groupId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    callbeforeupdate: null,
    configByName: null,
    computeAccountHash: null,
    userAccount: null,
  };

  const mockPool: PoolEntity = {
    id: 1,
    name: 'test-pool',
    poolName: 'test-pool',
    ip: ['127.0.0.1'],
    accountId: 1,
    sendingLimit: 1000,
    senderEmail: 'test@example.com',
    senderName: 'Test Sender',
    senderReplyTo: 'test-reply@example.com',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    callbeforeupdate: null,
  };

  const mockContactFromDb: ContactEntity = {
    id: 1,
    email: 'test@example.com',
    firstName: 'Test Contact',
    accountId: 1,
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    emailProvider: 'test-email-provider',
    lastName: 'Test Last Name',
    hashedEmail: 'hashed-email',
    phone: '1234567890',
    city: 'Test City',
    region: 'Test Region',
    country: 'Test Country',
    postal: '12345',
    ip: '127.0.0.1',
    latitude: 123.456,
    longitude: 78.91,
    createdAt: new Date(),
    updatedAt: new Date(),
    timezone: 'UTC',
    isActive: true,
    isUnsubscribed: false,
    unsubscribedAt: null,
    isBlocked: false,
    blockedAt: null,
    isValid: true,
    hasBounced: false,
    bounceType: null,
    bouncedAt: null,
    hasEmail: true,
    hasPhone: true,
    hasWebPush: false,
    hasMobilePush: false,
    lastOpen: null,
    lastOpenDate: null,
    lastClick: null,
    lastClickDate: null,
    lastSent: null,
    lastSentDate: null,
    lastAutomation: null,
    lastAutomationDate: null,
    score: 0,
    scoreForecast: 0,
    whatsapp: null,
    hasWhatsapp: false,
    whatsappLastSent: null,
    whatsappLastDelivered: null,
    whatsappLastOpen: null,
    whatsappLastClick: null,
    smsLastSent: null,
    smsLastDelivered: null,
    smsLastClick: null,
    createdAtDate: new Date(),
    fullName: 'Test Full Name',
    contactTag: null,
    setUserDetails: null,
    setUUID: null,
    setExtraFields: null,
    getMailBoxProvider: null,
    properties: {},
    maskedEmail: 'a***@gmail.com',
  };

  const mockEmailDto: SendEmailMessageDto = {
    contact: {
      email: 'test@example.com',
      firstName: 'Test',
    },
    message: {
      title: 'Test Email',
      name: 'test-name',
      subject: 'Test Subject',
      content: 'Test Content',
      previewText: 'Preview Text',
      from: {
        email: 'sender@example.com',
        firstName: 'Sender',
      },
      priority: EmailPriority.HIGH,
    },
  };

  beforeEach(async () => {
    const mockPubSubProvider = {
      sendAsyncMessage: jest.fn().mockImplementation(() => Promise.resolve('mocked-message-id')),
    };

    const mockAccountService = {
      findWithCleanConfigs: jest.fn(),
    };

    const mockContactService = {
      findByProperty: jest.fn().mockResolvedValue(mockContactFromDb),
    };

    const mockPoolService = {
      findOneBySenderEmail: jest.fn(),
      findOneByPool: jest.fn(),
    };

    const mockMessagesService = {
      findOneByname: jest.fn(),
    };

    const mockClsService = {
      get: jest.fn(),
    };

    const mockAccountCacheService = {
      invalidateAccountCache: jest.fn(),
      invalidateAccountCacheAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: PubSubProvider,
          useValue: mockPubSubProvider,
        },
        {
          provide: AccountsService,
          useValue: mockAccountService,
        },
        {
          provide: ContactsService,
          useValue: mockContactService,
        },
        {
          provide: PoolsService,
          useValue: mockPoolService,
        },
        {
          provide: ClsService,
          useValue: mockClsService,
        },
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
        {
          provide: AccountCacheService,
          useValue: mockAccountCacheService,
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    pubSubProvider = module.get(PubSubProvider);
    accountService = module.get(AccountsService);
    contactService = module.get(ContactsService);
    poolService = module.get(PoolsService);
    clsService = module.get(ClsService);
    messagesService = module.get(MessagesService);
    module.get(AccountCacheService);

    // Default mock implementations
    clsService.get.mockReturnValue('test-account-id');
    accountService.findWithCleanConfigs.mockResolvedValue(mockAccount);
    poolService.findOneByPool.mockResolvedValue(mockPool);
    poolService.findOneBySenderEmail.mockResolvedValue(mockPool);

    process.env.TOPIC_NAME_SEND_EMAIL = 'test-topic';
  });

  describe('sendEmail', () => {
    it('should successfully send an email', async () => {
      pubSubProvider.sendAsyncMessage.mockResolvedValue('mocked-message-id');

      const result = await service.sendEmail(mockEmailDto);

      expect(result).toBe('mocked-message-id');
      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
        'test-topic',
        expect.objectContaining({
          account: mockAccount,
          contact: expect.objectContaining({
            email: mockEmailDto.contact.email,
          }),
        }),
        expect.any(Object),
      );
    });

    it('should throw unauthorized exception when account not found', async () => {
      accountService.findWithCleanConfigs.mockResolvedValue(null);

      await expect(service.sendEmail(mockEmailDto)).rejects.toThrow(new HttpException('[Unauthorized] - Account not exists', HttpStatus.UNAUTHORIZED));
    });

    it('should throw bad request when sendAt is invalid date', async () => {
      const dtoWithInvalidDate: SendEmailMessageDto = {
        ...mockEmailDto,
        sendAt: 'invalid-date',
      };

      await expect(service.sendEmail(dtoWithInvalidDate)).rejects.toThrow(new HttpException('Invalid date format for sendAt', HttpStatus.BAD_REQUEST));
    });

    it('should throw bad request when sendAt is more than 72 hours in future', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 73);

      const dtoWithFutureDate = {
        ...mockEmailDto,
        sendAt: futureDate.getTime(),
      };

      await expect(service.sendEmail(dtoWithFutureDate)).rejects.toThrow(new HttpException('Send at must be in the future and within 72 hours from now', HttpStatus.BAD_REQUEST));
    });

    it('should throw bad request when pool not found for sender email', async () => {
      poolService.findOneBySenderEmail.mockResolvedValue(null);

      await expect(service.sendEmail(mockEmailDto)).rejects.toThrow(new HttpException('Sender not found for this email', HttpStatus.BAD_REQUEST));
    });

    it('should not check pool if ippool is provided in message', async () => {
      const dtoWithIpPool = {
        ...mockEmailDto,
        message: {
          ...mockEmailDto.message,
          ippool: 'test-pool',
        },
      };

      await service.sendEmail(dtoWithIpPool);

      expect(poolService.findOneBySenderEmail).not.toHaveBeenCalled();
    });

    it('should validate pool if provided', async () => {
      const dtoWithInvalidPool = {
        ...mockEmailDto,
        message: {
          ...mockEmailDto.message,
          ippool: 'invalid-pool',
        },
      };

      poolService.findOneByPool.mockResolvedValue(null);
      await expect(service.sendEmail(dtoWithInvalidPool)).rejects.toThrow(new HttpException('Pool not found', HttpStatus.BAD_REQUEST));
    });

    it('should include custom fields when provided', async () => {
      const dtoWithCustomFields = {
        ...mockEmailDto,
        contact: {
          ...mockEmailDto.contact,
          customFields: {
            field1: 'value1',
            field2: 'value2',
          },
        },
      };

      pubSubProvider.sendAsyncMessage.mockResolvedValue('mocked-message-id');

      await service.sendEmail(dtoWithCustomFields);

      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
        'test-topic',
        expect.objectContaining({
          contact: expect.objectContaining({
            customFields: dtoWithCustomFields.contact.customFields,
          }),
        }),
        expect.any(Object),
      );
    });
  });

  it('should include utmContent and utmCampaign when provided', async () => {
    const dtoWithUtm = {
      ...mockEmailDto,
      utmContent: 'test-content',
      utmCampaign: 'test-campaign',
    };

    pubSubProvider.sendAsyncMessage.mockResolvedValue('mocked-message-id');

    await service.sendEmail(dtoWithUtm);

    expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
      'test-topic',
      expect.objectContaining({
        utmContent: dtoWithUtm.utmContent,
        utmCampaign: dtoWithUtm.utmCampaign,
      }),
      expect.any(Object),
    );
  });

  it('should include automationName when provided', async () => {
    const dtoWithAutomationName = {
      ...mockEmailDto,
      automationName: 'test-automation',
    };

    pubSubProvider.sendAsyncMessage.mockResolvedValue('mocked-message-id');

    await service.sendEmail(dtoWithAutomationName);

    expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
      'test-topic',
      expect.objectContaining({
        automationName: dtoWithAutomationName.automationName,
      }),
      expect.any(Object),
    );
  });

  it('should load contact from database when set to loadContactFromDatabase and contact has email', async () => {
    const dtoWithLoadContactFromDatabase = {
      ...mockEmailDto,
      loadContactFromDatabase: true,
      contact: {
        email: 'test@example.com',
      },
    };

    pubSubProvider.sendAsyncMessage.mockResolvedValue('mocked-message-id');

    await service.sendEmail(dtoWithLoadContactFromDatabase);

    expect(contactService.findByProperty).toHaveBeenCalledWith({ email: dtoWithLoadContactFromDatabase.contact.email, isCompleted: true });

    expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
      'test-topic',
      expect.objectContaining({
        contact: expect.objectContaining({
          email: dtoWithLoadContactFromDatabase.contact.email,
        }),
      }),
      expect.any(Object),
    );
  });

  it('should load contact from database when set to loadContactFromDatabase and contact has uuid', async () => {
    const dtoWithLoadContactFromDatabase = {
      ...mockEmailDto,
      loadContactFromDatabase: true,
      contact: {
        uuid: '123e4567-e89b-12d3-a456-426614174000',
      },
    };

    pubSubProvider.sendAsyncMessage.mockResolvedValue('mocked-message-id');

    await service.sendEmail(dtoWithLoadContactFromDatabase);

    expect(contactService.findByProperty).toHaveBeenCalledWith({ uuid: dtoWithLoadContactFromDatabase.contact.uuid, isCompleted: true });

    expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
      'test-topic',
      expect.objectContaining({
        contact: expect.objectContaining({
          uuid: dtoWithLoadContactFromDatabase.contact.uuid,
        }),
      }),
      expect.any(Object),
    );
  });

  it('should load contact from database when set to loadContactFromDatabase and contact has id', async () => {
    const dtoWithLoadContactFromDatabase = {
      ...mockEmailDto,
      loadContactFromDatabase: true,
      contact: {
        id: 1,
      },
    };

    pubSubProvider.sendAsyncMessage.mockResolvedValue('mocked-message-id');

    await service.sendEmail(dtoWithLoadContactFromDatabase);

    expect(contactService.findByProperty).toHaveBeenCalledWith({ id: dtoWithLoadContactFromDatabase.contact.id, isCompleted: true });

    expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
      'test-topic',
      expect.objectContaining({
        contact: expect.objectContaining({
          id: dtoWithLoadContactFromDatabase.contact.id,
        }),
      }),
      expect.any(Object),
    );
  });

  describe('SendEmailMessageDto Validation', () => {
    it('should validate a complete and valid DTO', async () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          title: 'Test Email',
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeUndefined();
    });

    it('should require firstName when loadContactFromDatabase is missing', async () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          // firstName: 'Test',
        },
        message: {
          title: 'Test Email',
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);

      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('firstName');
    });

    it('should not require firstName when loadContactFromDatabase is true', async () => {
      const dto = {
        loadContactFromDatabase: true,
        contact: {
          email: 'test@example.com',
          // firstName is not required
        },
        message: {
          title: 'Test Email',
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
      };

      const validation = SendEmailMessageSchema.validate(dto);

      expect(validation.error).toBeUndefined();
    });

    it('should require at least one contact identifier (email, uuid, or id)', async () => {
      const dto = {
        loadContactFromDatabase: true,
        contact: {
          firstName: 'Test',
          // missing email, uuid, and id
        },
        message: {
          title: 'Test Email',
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('must contain at least one of [id, email, uuid]');
    });

    it('should validate email formats', async () => {
      const dto = {
        contact: {
          email: 'invalid-email',
          firstName: 'Test',
        },
        message: {
          title: 'Test Email',
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'invalid-sender-email',
            firstName: 'Sender',
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('email');
    });

    it('should validate sendAt as a valid number', async () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          title: 'Test Email',
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
        sendAt: 'invalid-timestamp',
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('sendAt');
    });

    it('should validate priority as a valid EmailPriority enum value', async () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          title: 'Test Email',
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
        priority: 'invalid-priority',
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('priority');
    });
  });

  describe('Timestamp Validation', () => {
    it('should accept sendAt as milliseconds timestamp', () => {
      const millisTimestamp = Date.now(); // current time in milliseconds
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
        sendAt: millisTimestamp,
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeUndefined();
    });

    it('should accept sendAt as seconds timestamp', () => {
      const secondsTimestamp = Math.floor(Date.now() / 1000); // current time in seconds
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
        sendAt: secondsTimestamp,
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeUndefined();
    });

    it('should convert milliseconds timestamp to seconds when sending email', async () => {
      const millisTimestamp = Date.now() + 2000;
      const expectedSecondsTimestamp = Math.floor(millisTimestamp / 1000);

      const dtoWithMillis = {
        ...mockEmailDto,
        sendAt: millisTimestamp,
      };

      await service.sendEmail(dtoWithMillis);

      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
        'test-topic',
        expect.objectContaining({
          sendAt: expectedSecondsTimestamp,
        }),
        expect.any(Object),
      );
    });

    it('should keep seconds timestamp as is when sending email', async () => {
      const secondsTimestamp = Math.floor(Date.now() / 1000);

      const dtoWithSeconds = {
        ...mockEmailDto,
        sendAt: secondsTimestamp,
      };

      await service.sendEmail(dtoWithSeconds);

      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
        'test-topic',
        expect.objectContaining({
          sendAt: secondsTimestamp,
        }),
        expect.any(Object),
      );
    });

    it('should handle timestamps near the 72-hour limit', async () => {
      const now = Date.now();
      const almost72Hours = new Date(now + 71 * 60 * 60 * 1000); // 71 hours in future

      const dto = {
        ...mockEmailDto,
        sendAt: almost72Hours.getTime(),
      };

      await service.sendEmail(dto);

      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
        'test-topic',
        expect.objectContaining({
          sendAt: Math.floor(almost72Hours.getTime() / 1000),
        }),
        expect.any(Object),
      );
    });

    it('should reject timestamps more than 72 hours in the future', async () => {
      const now = Date.now();
      const moreThan72Hours = new Date(now + 73 * 60 * 60 * 1000); // 73 hours in future

      const dto = {
        ...mockEmailDto,
        sendAt: moreThan72Hours.getTime(),
      };

      await expect(service.sendEmail(dto)).rejects.toThrow(new HttpException('Send at must be in the future and within 72 hours from now', HttpStatus.BAD_REQUEST));
    });

    it('should reject timestamps in the past', async () => {
      const pastTimestamp = Date.now() - 60 * 60 * 1000; // 1 hour in past

      const dto = {
        ...mockEmailDto,
        sendAt: pastTimestamp,
      };

      await expect(service.sendEmail(dto)).rejects.toThrow(new HttpException('Send at must be in the future and within 72 hours from now', HttpStatus.BAD_REQUEST));
    });
  });

  describe('Message Object Validation', () => {
    it('should validate when all required message fields are provided', () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          subject: 'Test Subject', // required
          content: 'Test Content', // required
          from: {
            // required
            email: 'sender@example.com', // required
            firstName: 'Sender', // required
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeUndefined();
    });

    it('should validate when only required message fields are provided', async () => {
      const dto = {
        ...mockEmailDto,
        message: {
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeUndefined();
    });

    it('should fail validation when subject is missing', () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          // subject is missing
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('"message.subject" is required');
    });

    it('should fail validation when content is missing', () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          subject: 'Test Subject',
          // content is missing
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('"message.content" is required');
    });

    it('should fail validation when from object is missing', () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          subject: 'Test Subject',
          content: 'Test Content',
          // from is missing
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('"message.from" is required');
    });

    it('should fail validation when from.email is missing', () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            // email is missing
            firstName: 'Sender',
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('"message.from.email" is required');
    });

    it('should fail validation when from.firstName is missing', () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            // firstName is missing
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('"message.from.firstName" is required');
    });

    it('should validate when optional message fields are provided', () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          id: 123, // optional
          title: 'Test Title', // optional
          name: 'Test Name', // optional
          ippool: 'test-pool', // optional
          previewText: 'Test Preview', // optional
          subject: 'Test Subject', // required
          replyTo: 'reply@example.com', // optional
          priority: EmailPriority.HIGH, // optional
          content: 'Test Content', // required
          location: {
            // optional
            bucketName: 'test-bucket',
            fileName: 'test-file.txt',
          },
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeUndefined();
    });

    it('should fail validation when from.email is invalid', () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'invalid-email', // invalid email format
            firstName: 'Sender',
          },
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('"message.from.email" must be a valid email');
    });

    it('should validate with valid priority enum value', () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
          priority: EmailPriority.HIGH,
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeUndefined();
    });

    it('should fail validation with invalid priority value', () => {
      const dto = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        message: {
          subject: 'Test Subject',
          content: 'Test Content',
          from: {
            email: 'sender@example.com',
            firstName: 'Sender',
          },
          priority: 'invalid-priority',
        },
      };

      const { error } = SendEmailMessageSchema.validate(dto);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('"message.priority"');
    });
  });

  describe('processTransactional', () => {
    const mockTransactionalPayload = {
      contact: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        customFields: {
          CHANGEBODY: 'test-content',
        },
      },
      name: 'test-transactional-message',
    };

    const mockMessage: MessageEntity = {
      id: 1,
      name: 'test-transactional-message',
      title: 'Test Message',
      subject: 'Test Subject',
      content: 'Test Content',
      accountId: 1,
      text: 'Test Content',
      fromMail: 'sender@example.com',
      fromName: 'Sender',
      isTested: false,
      version: 1,
      templateUrl: '',
      bucketName: '',
      fileName: '',
      content_json: '',
      replyTo: '',
      image: '',
      url: '',
      expiryPushInSeconds: 0,
      expiryPushFilter: '',
      notificationSound: '',
      status: MessageStatus.DRAFT,
      whatsappType: '',
      callToActionText: '',
      providerMessageId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      account: null,
      addName: null,
      callbeforeupdate: null,
      labelContent: [],
    };

    beforeEach(() => {
      messagesService.findOneByname.mockResolvedValue(mockMessage);
      accountService.findWithCleanConfigs.mockResolvedValue(mockAccount);
      pubSubProvider.sendAsyncMessage.mockResolvedValue('mocked-message-id');
    });

    it('should successfully process a transactional message', async () => {
      const result = await service.processTransactional(mockTransactionalPayload);

      expect(messagesService.findOneByname).toHaveBeenCalledWith('test-transactional-message');
      expect(accountService.findWithCleanConfigs).toHaveBeenCalled();
      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
        process.env.TOPIC_NAME_SEND_EMAIL,
        expect.objectContaining({
          account: mockAccount,
          contact: expect.objectContaining({
            email: mockTransactionalPayload.contact.email,
            firstName: mockTransactionalPayload.contact.firstName,
            lastName: mockTransactionalPayload.contact.lastName,
            customFields: mockTransactionalPayload.contact.customFields,
          }),
          message: expect.objectContaining({
            name: mockMessage.name,
            title: mockMessage.title,
            subject: mockMessage.subject,
            content: mockMessage.content,
            from: {
              email: mockMessage.fromMail,
              firstName: mockMessage.fromName,
            },
          }),
        }),
        expect.objectContaining({
          priority: 'transactional',
        }),
      );
      expect(result).toBe('mocked-message-id');
    });

    it('should throw error when message name is not provided', async () => {
      const invalidPayload = {
        contact: mockTransactionalPayload.contact,
        // name is missing
      };

      await expect(service.processTransactional(invalidPayload as TransactionalMessage)).rejects.toThrow(
        new HttpException(`Can't process without message name`, HttpStatus.UNPROCESSABLE_ENTITY),
      );
    });

    it('should throw error when contact email is not provided', async () => {
      const invalidPayload = {
        contact: {
          ...mockTransactionalPayload.contact,
          email: '',
        },
        name: mockTransactionalPayload.name,
      };

      await expect(service.processTransactional(invalidPayload as TransactionalMessage)).rejects.toThrow(
        new HttpException(`Can't process without contact email`, HttpStatus.UNPROCESSABLE_ENTITY),
      );
    });

    it('should return error when message is not found', async () => {
      messagesService.findOneByname.mockResolvedValue(null);

      const result = await service.processTransactional(mockTransactionalPayload);

      expect(result).toEqual({
        status: false,
        message: `[transactional] Could not find a transactional message with name: ${mockTransactionalPayload.name}`,
      });
    });

    it('should return error when account is not found', async () => {
      accountService.findWithCleanConfigs.mockResolvedValue(null);

      const result = await service.processTransactional(mockTransactionalPayload);

      expect(result).toEqual({
        status: false,
        message: `[transactional] Could not find a transactional message with name: ${mockTransactionalPayload.name}`,
      });
    });

    it('should handle custom fields in contact data', async () => {
      const payloadWithCustomFields = {
        ...mockTransactionalPayload,
        contact: {
          ...mockTransactionalPayload.contact,
          customFields: {
            FIELD1: 'value1',
            FIELD2: 'value2',
          },
        },
      };

      await service.processTransactional(payloadWithCustomFields);

      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
        process.env.TOPIC_NAME_SEND_EMAIL,
        expect.objectContaining({
          contact: expect.objectContaining({
            customFields: payloadWithCustomFields.contact.customFields,
          }),
        }),
        expect.any(Object),
      );
    });

    it('should handle missing optional contact fields', async () => {
      const minimalPayload = {
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
          // lastName and customFields are optional
        },
        name: 'test-transactional-message',
      };

      await service.processTransactional(minimalPayload);

      expect(pubSubProvider.sendAsyncMessage).toHaveBeenCalledWith(
        process.env.TOPIC_NAME_SEND_EMAIL,
        expect.objectContaining({
          contact: expect.objectContaining({
            email: minimalPayload.contact.email,
            firstName: minimalPayload.contact.firstName,
          }),
        }),
        expect.any(Object),
      );
    });

    it('should throw error when parseMessageToSendEmail fails', async () => {
      // Mock utils.service to throw an error
      jest.spyOn(utils, 'parseMessageToSendEmail').mockImplementation(() => {
        throw new Error('Parse error');
      });

      await expect(service.processTransactional(mockTransactionalPayload)).rejects.toBe('[transactional] Error parseLeadStateMessage: Parse error');
    });
  });
});
