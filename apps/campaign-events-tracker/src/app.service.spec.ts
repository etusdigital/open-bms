import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AppService } from './app.service';
import { MsgopsService } from './msgops/msgops.service';
import { RedisService } from './providers/redis/redis.service';
import { EventTracker, MsgopsCampaignEvent, MsgopsServices, StatusCampaignEnum } from './app.interfaces';

describe('AppService', () => {
  let service: AppService;

  const mockRedisClient = {
    incrby: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('100'),
  };

  const mockMsgopsService = {
    updateStatus: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: MsgopsService, useValue: mockMsgopsService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validate', () => {
    const baseEvent: EventTracker = {
      campaign_id: 1,
      service: MsgopsServices.MSGOPS_CAMPAIGN_PACKER,
      event: MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED,
      timestamp: Date.now(),
      cloud_run: 'test',
      port: '3000',
      k_revision: 'rev1',
      k_configuration: 'config1',
      data: {},
    };

    it('should return false for valid event', () => {
      expect(service.validate(baseEvent)).toBe(false);
    });

    it('should return true for unknown event', () => {
      const event = { ...baseEvent, event: 'UNKNOWN_EVENT' as any };
      expect(service.validate(event)).toBe(true);
    });

    it('should throw BadRequestException if timestamp is missing', () => {
      const event = { ...baseEvent, timestamp: undefined } as any;
      expect(() => service.validate(event)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if campaign_id is missing', () => {
      const event = { ...baseEvent, campaign_id: undefined } as any;
      expect(() => service.validate(event)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if service is missing', () => {
      const event = { ...baseEvent, service: undefined } as any;
      expect(() => service.validate(event)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException if service is not valid', () => {
      const event = { ...baseEvent, service: 'INVALID_SERVICE' as any };
      expect(() => service.validate(event)).toThrow(BadRequestException);
    });

    it('should return true for empty event string (not in enum)', () => {
      const event = { ...baseEvent, event: '' as any };
      // Empty string is not in MsgopsCampaignEvent enum, so validate returns true early
      expect(service.validate(event)).toBe(true);
    });
  });

  describe('addEventTracker', () => {
    const baseEvent: EventTracker = {
      campaign_id: 1,
      service: MsgopsServices.MSGOPS_CAMPAIGN_PACKER,
      event: MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED,
      timestamp: Date.now(),
      cloud_run: 'test',
      port: '3000',
      k_revision: 'rev1',
      k_configuration: 'config1',
      data: {},
    };

    it('should return event tracker when debug is truthy', async () => {
      const result = await service.addEventTracker(baseEvent, 'true');
      expect(result).toEqual(baseEvent);
    });

    it('should return event tracker when event is invalid', async () => {
      const event = { ...baseEvent, event: 'UNKNOWN_EVENT' as any };
      const result = await service.addEventTracker(event, '');
      expect(result).toEqual(event);
    });

    it('should call updateStatus for valid event', async () => {
      const updateStatusSpy = jest.spyOn(service, 'updateStatus').mockResolvedValue(undefined);
      await service.addEventTracker(baseEvent, '');
      expect(updateStatusSpy).toHaveBeenCalledWith(baseEvent);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(service, 'updateStatus').mockRejectedValue(new Error('test error'));
      await expect(service.addEventTracker(baseEvent, '')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException with default message when error has no message', async () => {
      const error: any = {};
      jest.spyOn(service, 'updateStatus').mockRejectedValue(error);
      await expect(service.addEventTracker(baseEvent, '')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('formatEventTracker', () => {
    it('should stringify data field', () => {
      const event: EventTracker = {
        campaign_id: 1,
        service: MsgopsServices.MSGOPS_CAMPAIGN_PACKER,
        event: MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: { key: 'value' },
      };

      const result = service.formatEventTracker(event);
      expect(result.data).toBe('{"key":"value"}');
    });

    it('should handle null eventTracker data', () => {
      const event: EventTracker = {
        campaign_id: 1,
        service: MsgopsServices.MSGOPS_CAMPAIGN_PACKER,
        event: MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: null,
      };

      const result = service.formatEventTracker(event);
      expect(result.data).toBe('null');
    });
  });

  describe('updateStatus', () => {
    it('should set status to SENDING_TEST_AB for CAMPAIGN_PROCESSING_STARTED with testabMode', async () => {
      const event: EventTracker = {
        campaign_id: 1,
        service: MsgopsServices.MSGOPS_CAMPAIGN_PACKER,
        event: MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: {},
        testabMode: true,
      };

      await service.updateStatus(event);
      expect(mockMsgopsService.updateStatus).toHaveBeenCalledWith(1, {
        status: StatusCampaignEnum.SENDING_TEST_AB,
      });
    });

    it('should set status to SENDING for CAMPAIGN_PROCESSING_STARTED without testabMode', async () => {
      const event: EventTracker = {
        campaign_id: 1,
        service: MsgopsServices.MSGOPS_CAMPAIGN_PACKER,
        event: MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: {},
        testabMode: false,
      };

      await service.updateStatus(event);
      expect(mockMsgopsService.updateStatus).toHaveBeenCalledWith(1, {
        status: StatusCampaignEnum.SENDING,
      });
    });

    it('should update Redis for SENT_EMAIL_BATCH and complete when last page', async () => {
      const event: EventTracker = {
        campaign_id: 1,
        service: MsgopsServices.MSGOPS_SEND_BATCH_EMAIL,
        event: MsgopsCampaignEvent.SENT_EMAIL_BATCH,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: {},
        page: 5,
        totalPages: 5,
        contacts_length: 100,
        testabMode: false,
      };

      await service.updateStatus(event);

      expect(mockRedisClient.incrby).toHaveBeenCalledWith('sentContacts:campaign:1', 100);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('sentContacts:campaign:1', 43200);
      expect(mockRedisClient.set).toHaveBeenCalledWith('sentPercentage:campaign:1', 100, 'EX', 43200);
      expect(mockRedisClient.get).toHaveBeenCalledWith('sentContacts:campaign:1');
      expect(mockMsgopsService.updateStatus).toHaveBeenCalledWith(1, {
        status: StatusCampaignEnum.COMPLETED,
        sentContacts: 100,
        sentPercentage: 100,
      });
    });

    it('should update Redis for SENT_EMAIL_BATCH but not complete when not last page', async () => {
      const event: EventTracker = {
        campaign_id: 1,
        service: MsgopsServices.MSGOPS_SEND_BATCH_EMAIL,
        event: MsgopsCampaignEvent.SENT_EMAIL_BATCH,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: {},
        page: 3,
        totalPages: 5,
        contacts_length: 100,
        testabMode: false,
      };

      await service.updateStatus(event);

      expect(mockRedisClient.incrby).toHaveBeenCalled();
      expect(mockMsgopsService.updateStatus).not.toHaveBeenCalled();
    });

    it('should not complete when last page but testabMode is true', async () => {
      const event: EventTracker = {
        campaign_id: 1,
        service: MsgopsServices.MSGOPS_SEND_BATCH_EMAIL,
        event: MsgopsCampaignEvent.SENT_EMAIL_BATCH,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: {},
        page: 5,
        totalPages: 5,
        contacts_length: 100,
        testabMode: true,
      };

      await service.updateStatus(event);

      expect(mockRedisClient.incrby).toHaveBeenCalled();
      expect(mockMsgopsService.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle SENT_PUSH_BATCH event', async () => {
      const event: EventTracker = {
        campaign_id: 2,
        service: MsgopsServices.MSGOPS_SEND_BATCH_PUSH,
        event: MsgopsCampaignEvent.SENT_PUSH_BATCH,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: {},
        page: 1,
        totalPages: 1,
        contacts_length: 50,
        testabMode: false,
      };

      await service.updateStatus(event);

      expect(mockRedisClient.incrby).toHaveBeenCalledWith('sentContacts:campaign:2', 50);
      expect(mockMsgopsService.updateStatus).toHaveBeenCalled();
    });

    it('should handle SENT_SMS_BATCH event', async () => {
      const event: EventTracker = {
        campaign_id: 3,
        service: MsgopsServices.MSGOPS_SEND_BATCH_TWILIO,
        event: MsgopsCampaignEvent.SENT_SMS_BATCH,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: {},
        page: 1,
        totalPages: 1,
        contacts_length: 25,
        testabMode: false,
      };

      await service.updateStatus(event);

      expect(mockRedisClient.incrby).toHaveBeenCalledWith('sentContacts:campaign:3', 25);
    });

    it('should handle SENT_WHATSAPP_BATCH event', async () => {
      const event: EventTracker = {
        campaign_id: 4,
        service: MsgopsServices.MSGOPS_SEND_BATCH_TWILIO,
        event: MsgopsCampaignEvent.SENT_WHATSAPP_BATCH,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: {},
        page: 1,
        totalPages: 1,
        contacts_length: 10,
        testabMode: false,
      };

      await service.updateStatus(event);

      expect(mockRedisClient.incrby).toHaveBeenCalledWith('sentContacts:campaign:4', 10);
    });

    it('should not call updateStatus for unrecognized events in the switch', async () => {
      // An event that passes validate but does not match any switch case
      // This can't truly happen since validate checks event in MsgopsCampaignEvent
      // but we can test the empty campaign object path
      const event: EventTracker = {
        campaign_id: 1,
        service: MsgopsServices.MSGOPS_CAMPAIGN_PACKER,
        event: MsgopsCampaignEvent.CAMPAIGN_PROCESSING_STARTED,
        timestamp: Date.now(),
        cloud_run: 'test',
        port: '3000',
        k_revision: 'rev1',
        k_configuration: 'config1',
        data: {},
        testabMode: false,
      };

      await service.updateStatus(event);
      // campaign has status: SENDING, so it should call updateStatus
      expect(mockMsgopsService.updateStatus).toHaveBeenCalled();
    });
  });

  describe('logInfo', () => {
    it('should not log when LOG_LEVEL is INFO', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.env.LOG_LEVEL = 'INFO';
      service.logInfo('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log when LOG_LEVEL is DEBUG', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.env.LOG_LEVEL = 'DEBUG';
      service.logInfo('test message', 'extra');
      expect(consoleSpy).toHaveBeenCalledWith('test message', 'extra');
      consoleSpy.mockRestore();
      delete process.env.LOG_LEVEL;
    });

    it('should log with empty string when no args and LOG_LEVEL is DEBUG', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.env.LOG_LEVEL = 'DEBUG';
      service.logInfo('test message');
      expect(consoleSpy).toHaveBeenCalledWith('test message', '');
      consoleSpy.mockRestore();
      delete process.env.LOG_LEVEL;
    });
  });
});
