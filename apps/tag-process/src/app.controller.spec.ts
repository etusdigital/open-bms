import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FormatterUtils } from './utils/formatter.utils';
import { PubSubMessage, SegmentToClickHouse, EventsTrigger, EventsTarget } from './interfaces';
import { createLeadMessage, createTagBatch } from './__mocks__/test-fixtures';

describe('AppController', () => {
  let controller: AppController;
  let appService: jest.Mocked<AppService>;
  let formatterUtils: jest.Mocked<FormatterUtils>;

  beforeEach(() => {
    appService = {
      addTag: jest.fn().mockResolvedValue({ status: 200, message: 'ok' }),
      removeTag: jest.fn().mockResolvedValue({ status: 200, message: 'ok' }),
      automationCancel: jest.fn().mockResolvedValue({ status: 200, message: 'ok' }),
      processContactsBatch: jest.fn().mockResolvedValue({ status: 200, message: 'ok' }),
      processTagBatch: jest.fn().mockResolvedValue({ status: 200, message: 'ok' }),
      processCompleted: jest.fn().mockResolvedValue({ status: 200, message: 'ok' }),
      processSegment: jest.fn().mockResolvedValue({ status: 200, message: 'ok' }),
      processSegmentToClickHouse: jest.fn().mockResolvedValue(undefined),
      processEventTrigger: jest.fn().mockResolvedValue({ status: 200 }),
      targetAchieved: jest.fn().mockResolvedValue(undefined),
    } as any;

    formatterUtils = {
      parseLead: jest.fn(),
      parseBatch: jest.fn(),
    } as any;

    controller = new AppController(appService, formatterUtils);
  });

  describe('addTag', () => {
    it('should call appService.addTag with LeadMessage directly', async () => {
      const leadMessage = createLeadMessage();
      const result = await controller.addTag(leadMessage);
      expect(appService.addTag).toHaveBeenCalledWith(leadMessage);
      expect(result).toEqual({ status: 200, message: 'ok' });
    });

    it('should parse PubSubMessage and call appService.addTag', async () => {
      const parsed = createLeadMessage();
      formatterUtils.parseLead.mockReturnValue(parsed);
      const pubsubMsg: PubSubMessage = {
        subscription: 'sub-1',
        message: {
          data: 'base64data',
          messageId: '123',
          message_id: '123',
          publishTime: '2024-01-01',
          publish_time: '2024-01-01',
          attributes: {},
        },
      };

      await controller.addTag(pubsubMsg);
      expect(formatterUtils.parseLead).toHaveBeenCalledWith(pubsubMsg);
      expect(appService.addTag).toHaveBeenCalledWith(parsed);
    });

    it('should rethrow errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const leadMessage = createLeadMessage();
      appService.addTag.mockRejectedValue(new Error('fail'));
      await expect(controller.addTag(leadMessage)).rejects.toThrow('fail');
    });
  });

  describe('removeTag', () => {
    it('should call appService.removeTag with LeadMessage directly', async () => {
      const leadMessage = createLeadMessage();
      await controller.removeTag(leadMessage);
      expect(appService.removeTag).toHaveBeenCalledWith(leadMessage);
    });

    it('should parse PubSubMessage for removeTag', async () => {
      const parsed = createLeadMessage();
      formatterUtils.parseLead.mockReturnValue(parsed);
      const pubsubMsg: PubSubMessage = {
        subscription: 'sub-1',
        message: { data: 'base64', messageId: '1', message_id: '1', publishTime: '', publish_time: '', attributes: {} },
      };
      await controller.removeTag(pubsubMsg);
      expect(formatterUtils.parseLead).toHaveBeenCalledWith(pubsubMsg);
    });

    it('should rethrow errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      appService.removeTag.mockRejectedValue(new Error('fail'));
      await expect(controller.removeTag(createLeadMessage())).rejects.toThrow('fail');
    });
  });

  describe('cancel', () => {
    it('should call appService.automationCancel with LeadMessage', async () => {
      const leadMessage = createLeadMessage();
      await controller.cancel(leadMessage);
      expect(appService.automationCancel).toHaveBeenCalledWith(leadMessage);
    });

    it('should parse PubSubMessage for cancel', async () => {
      const parsed = createLeadMessage();
      formatterUtils.parseLead.mockReturnValue(parsed);
      const pubsubMsg: PubSubMessage = {
        subscription: 'sub-1',
        message: { data: 'base64', messageId: '1', message_id: '1', publishTime: '', publish_time: '', attributes: {} },
      };
      await controller.cancel(pubsubMsg);
      expect(appService.automationCancel).toHaveBeenCalledWith(parsed);
    });

    it('should rethrow errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      appService.automationCancel.mockRejectedValue(new Error('fail'));
      await expect(controller.cancel(createLeadMessage())).rejects.toThrow('fail');
    });
  });

  describe('processContactsBatch', () => {
    it('should call appService.processContactsBatch with TagBatch', async () => {
      const batch = createTagBatch();
      await controller.processContactsBatch(batch);
      expect(appService.processContactsBatch).toHaveBeenCalledWith(batch);
    });

    it('should parse PubSubMessage for processContactsBatch', async () => {
      const parsed = createTagBatch();
      formatterUtils.parseBatch.mockReturnValue(parsed);
      const pubsubMsg: PubSubMessage = {
        subscription: 'sub-1',
        message: { data: 'base64', messageId: '1', message_id: '1', publishTime: '', publish_time: '', attributes: {} },
      };
      await controller.processContactsBatch(pubsubMsg);
      expect(formatterUtils.parseBatch).toHaveBeenCalledWith(pubsubMsg);
    });

    it('should rethrow errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      appService.processContactsBatch.mockRejectedValue(new Error('fail'));
      await expect(controller.processContactsBatch(createTagBatch())).rejects.toThrow('fail');
    });
  });

  describe('processTagBatch', () => {
    it('should call appService.processTagBatch with TagBatch', async () => {
      const batch = createTagBatch();
      await controller.processTagBatch(batch);
      expect(appService.processTagBatch).toHaveBeenCalledWith(batch);
    });

    it('should parse PubSubMessage for processTagBatch', async () => {
      const parsed = createTagBatch();
      formatterUtils.parseBatch.mockReturnValue(parsed);
      const pubsubMsg: PubSubMessage = {
        subscription: 'sub-1',
        message: { data: 'base64', messageId: '1', message_id: '1', publishTime: '', publish_time: '', attributes: {} },
      };
      await controller.processTagBatch(pubsubMsg);
      expect(formatterUtils.parseBatch).toHaveBeenCalledWith(pubsubMsg);
    });

    it('should rethrow errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      appService.processTagBatch.mockRejectedValue(new Error('fail'));
      await expect(controller.processTagBatch(createTagBatch())).rejects.toThrow('fail');
    });
  });

  describe('processCompleted', () => {
    it('should call appService.processCompleted with LeadMessage', async () => {
      const leadMessage = createLeadMessage();
      await controller.processCompleted(leadMessage);
      expect(appService.processCompleted).toHaveBeenCalledWith(leadMessage);
    });

    it('should parse PubSubMessage for processCompleted', async () => {
      const parsed = createLeadMessage();
      formatterUtils.parseLead.mockReturnValue(parsed);
      const pubsubMsg: PubSubMessage = {
        subscription: 'sub-1',
        message: { data: 'base64', messageId: '1', message_id: '1', publishTime: '', publish_time: '', attributes: {} },
      };
      await controller.processCompleted(pubsubMsg);
      expect(appService.processCompleted).toHaveBeenCalledWith(parsed);
    });

    it('should rethrow errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      appService.processCompleted.mockRejectedValue(new Error('fail'));
      await expect(controller.processCompleted(createLeadMessage())).rejects.toThrow('fail');
    });
  });

  describe('processSegment', () => {
    it('should call appService.processSegment with id and params', async () => {
      await controller.processSegment(100, { is_campaign: true });
      expect(appService.processSegment).toHaveBeenCalledWith(100, true);
    });
  });

  describe('processSegmentClickHouse', () => {
    it('should call appService.processSegmentToClickHouse with data directly', async () => {
      const data: SegmentToClickHouse = {
        type: 'segment-in',
        tagId: 100,
        tagName: 'test',
        accountId: 1,
        contacts: [{ contact_id: 1 }],
      };
      await controller.processSegmentClickHouse(data);
      expect(appService.processSegmentToClickHouse).toHaveBeenCalledWith(data);
    });

    it('should rethrow errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      appService.processSegmentToClickHouse.mockRejectedValue(new Error('fail'));
      const data: SegmentToClickHouse = {
        type: 'segment-in',
        tagId: 100,
        tagName: 'test',
        accountId: 1,
        contacts: [],
      };
      await expect(controller.processSegmentClickHouse(data)).rejects.toThrow('fail');
    });
  });

  describe('eventsTrigger', () => {
    it('should call appService.processEventTrigger with event data', async () => {
      const event: EventsTrigger = { accountId: 1, contactId: 100, messageId: 200, event: 'open' };
      await controller.eventsTrigger(event);
      expect(appService.processEventTrigger).toHaveBeenCalledWith(event);
    });

    it('should rethrow errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      appService.processEventTrigger.mockRejectedValue(new Error('fail'));
      const event: EventsTrigger = { accountId: 1 };
      await expect(controller.eventsTrigger(event)).rejects.toThrow('fail');
    });
  });

  describe('targetAchieved', () => {
    it('should call appService.targetAchieved with event data', async () => {
      const event: EventsTarget = { accountId: 1, contactId: 100, automationId: 10 };
      await controller.targetAchieved(event);
      expect(appService.targetAchieved).toHaveBeenCalledWith(event);
    });

    it('should rethrow errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      appService.targetAchieved.mockRejectedValue(new Error('fail'));
      const event: EventsTarget = { accountId: 1, contactId: 100, automationId: 10 };
      await expect(controller.targetAchieved(event)).rejects.toThrow('fail');
    });
  });
});
