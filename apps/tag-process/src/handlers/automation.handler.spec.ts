import { LeadMessage, Status, TriggerType } from '../interfaces';
import { PubSubProvider } from '../providers/pubsub.provider';
import { AutomationHandler } from './automation.handler';
import { MsgopsService } from '../msgops/msgops.service';
import { TrackerService } from '../tracker/tracker.service';
import {
  createLeadMessage,
  createContact,
  createAutomation,
  createTag,
  createContactAutomation,
  createAccount,
  createEventsTrigger,
} from '../__mocks__/test-fixtures';

describe('Handler: Automation', () => {
  let automationHandler: AutomationHandler;
  let msgopsService: jest.Mocked<MsgopsService>;
  let trackerService: jest.Mocked<TrackerService>;
  let pubSubProvider: jest.Mocked<PubSubProvider>;

  beforeEach(() => {
    msgopsService = {
      findContactById: jest.fn(),
      findContactByUuid: jest.fn(),
      getTagByName: jest.fn(),
      createContactTag: jest.fn(),
      getAutomationsByTag: jest.fn(),
      getAutomationsByPush: jest.fn(),
      getAutomationsByEvent: jest.fn(),
      getCampaignsByEvent: jest.fn(),
      getContactAutomations: jest.fn(),
      getFirstContactAutomations: jest.fn(),
      getAllContactAutomations: jest.fn(),
      createContactAutomations: jest.fn(),
      updateContactAutomations: jest.fn(),
      updateContact: jest.fn(),
      updateLead: jest.fn(),
      deleteContactTag: jest.fn(),
      findContactByIdConditional: jest.fn(),
      findLeadById: jest.fn(),
      queryEventsLogs: jest.fn(),
    } as any;
    pubSubProvider = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      sendMessageClickHouse: jest.fn().mockResolvedValue(undefined),
    } as any;
    trackerService = {
      logInfo: jest.fn(),
      send: jest.fn(),
    } as any;
    automationHandler = new AutomationHandler(msgopsService, pubSubProvider, trackerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Function: getAttributesClickHouse', () => {
    it('should return import location when isImport is true', () => {
      const leadMessage = { isImport: true } as LeadMessage;
      const result = automationHandler.getAttributesClickHouse(leadMessage);
      expect(result).toEqual({ location: 'import' });
    });

    it('should return automation location with accountChange when present', () => {
      const leadMessage = { accountChange: { id: 1 } } as LeadMessage;
      const result = automationHandler.getAttributesClickHouse(leadMessage);
      expect(result).toEqual({ location: 'automation', accountChange: { id: 1 } });
    });

    it('should return automation location by default', () => {
      const leadMessage = {} as LeadMessage;
      const result = automationHandler.getAttributesClickHouse(leadMessage);
      expect(result).toEqual({ location: 'automation' });
    });
  });

  describe('Function: processAutomationBetweenDate', () => {
    it('should return start and final dates for current_week', () => {
      const result = automationHandler.processAutomationBetweenDate(['current_week', '1']);
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('finalDate');
      expect(typeof result.startDate).toBe('string');
      expect(typeof result.finalDate).toBe('string');
    });

    it('should return start and final dates for last_week', () => {
      const result = automationHandler.processAutomationBetweenDate(['last_week', '1']);
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('finalDate');
    });

    it('should handle dayFilter 0 for current_week', () => {
      const result = automationHandler.processAutomationBetweenDate(['current_week', '0']);
      expect(result.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(result.finalDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should handle dayFilter 0 for last_week', () => {
      const result = automationHandler.processAutomationBetweenDate(['last_week', '0']);
      expect(result.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('Function: processConditionalBetweenDate', () => {
    it('should return start and final dates for current_week', () => {
      const result = automationHandler.processConditionalBetweenDate('current_week', 1);
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('finalDate');
    });

    it('should return start and final dates for last_week', () => {
      const result = automationHandler.processConditionalBetweenDate('last_week', 1);
      expect(result).toHaveProperty('startDate');
      expect(result).toHaveProperty('finalDate');
    });

    it('should handle dayFilter 0 for current_week', () => {
      const result = automationHandler.processConditionalBetweenDate('current_week', 0);
      expect(result.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should handle dayFilter 0 for last_week', () => {
      const result = automationHandler.processConditionalBetweenDate('last_week', 0);
      expect(result.startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('Function: addTagAndStartAutomation', () => {
    it('should return early when contact not found', async () => {
      const leadMessage = createLeadMessage();
      msgopsService.findContactById.mockResolvedValue(null);

      const result = await automationHandler.addTagAndStartAutomation(leadMessage);

      expect(result).toBeUndefined();
      expect(trackerService.logInfo).toHaveBeenCalledWith(expect.stringContaining('Contact not found'));
    });

    it('should return 200 when tag not found', async () => {
      const contact = createContact();
      const leadMessage = createLeadMessage({ tagName: 'missing-tag' });
      msgopsService.findContactById.mockResolvedValue(contact);
      msgopsService.getTagByName.mockResolvedValue(null);

      const result = await automationHandler.addTagAndStartAutomation(leadMessage);

      expect(result).toEqual({ status: 200 });
    });

    it('should create contact tag and send clickhouse message', async () => {
      const contact = createContact();
      const tag = createTag();
      const leadMessage = createLeadMessage();
      msgopsService.findContactById.mockResolvedValue(contact);
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.createContactTag.mockResolvedValue({} as any);
      msgopsService.getAutomationsByTag.mockResolvedValue([]);

      await automationHandler.addTagAndStartAutomation(leadMessage);

      expect(msgopsService.createContactTag).toHaveBeenCalledWith(contact.id, tag.id, tag.accountId);
      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalledWith(expect.objectContaining({ event: 'tag-in' }));
    });

    it('should return 200 when startAutomation is false', async () => {
      const contact = createContact();
      const tag = createTag();
      const leadMessage = createLeadMessage({ startAutomation: false });
      msgopsService.findContactById.mockResolvedValue(contact);
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.createContactTag.mockResolvedValue({} as any);

      const result = await automationHandler.addTagAndStartAutomation(leadMessage);

      expect(result).toEqual({ status: 200 });
    });

    it('should check push automations when tag has no automations', async () => {
      const contact = createContact();
      const tag = createTag();
      const leadMessage = createLeadMessage({ webPush: true });
      msgopsService.findContactById.mockResolvedValue(contact);
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.createContactTag.mockResolvedValue({} as any);
      msgopsService.getAutomationsByTag.mockResolvedValue([]);
      msgopsService.getAutomationsByPush.mockResolvedValue([]);

      await automationHandler.addTagAndStartAutomation(leadMessage);

      expect(msgopsService.getAutomationsByPush).toHaveBeenCalledWith(contact.accountId, 'web-push');
    });

    it('should check mobile-push automations', async () => {
      const contact = createContact();
      createTag();
      const leadMessage = createLeadMessage({ tagName: undefined, mobilePush: true });
      msgopsService.findContactById.mockResolvedValue(contact);
      msgopsService.getAutomationsByPush.mockResolvedValue([]);

      await automationHandler.addTagAndStartAutomation(leadMessage);

      expect(msgopsService.getAutomationsByPush).toHaveBeenCalledWith(contact.accountId, 'mobile-push');
    });

    it('should send AUDIENCE_NOT_FOUND tracker when no automations found', async () => {
      const contact = createContact();
      const tag = createTag();
      const leadMessage = createLeadMessage();
      msgopsService.findContactById.mockResolvedValue(contact);
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.createContactTag.mockResolvedValue({} as any);
      msgopsService.getAutomationsByTag.mockResolvedValue([]);

      await automationHandler.addTagAndStartAutomation(leadMessage);

      expect(trackerService.send).toHaveBeenCalled();
    });

    it('should throw when createContactTag fails', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const contact = createContact();
      const tag = createTag();
      const leadMessage = createLeadMessage();
      msgopsService.findContactById.mockResolvedValue(contact);
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.createContactTag.mockRejectedValue(new Error('db error'));

      await expect(automationHandler.addTagAndStartAutomation(leadMessage)).rejects.toBeDefined();
    });
  });

  describe('Function: startAutomation', () => {
    const dayjs = require('dayjs');

    it('should create new automation entry and send message', async () => {
      const automation = createAutomation({
        triggers: { settings: { applyFrequency: TriggerType.MULTIPLY, conditional: null } },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact });
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(msgopsService.createContactAutomations).toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.running }),
      );
      expect(pubSubProvider.sendMessage).toHaveBeenCalled();
    });

    it('should handle UNIQUE frequency - duplicate existing automation', async () => {
      const automation = createAutomation({
        triggers: { settings: { applyFrequency: TriggerType.UNIQUE, conditional: null } },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact });
      msgopsService.getFirstContactAutomations.mockResolvedValue(createContactAutomation());

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalledWith(
        expect.objectContaining({ event: `automation-${Status.duplicate}` }),
      );
    });

    it('should cancel running automation when re-entering with MULTIPLY', async () => {
      const automation = createAutomation({
        triggers: { settings: { applyFrequency: TriggerType.MULTIPLY, conditional: null } },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact });
      const runningAutomation = createContactAutomation({ status: 'running' });
      msgopsService.getContactAutomations.mockResolvedValue(runningAutomation);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContactAutomations.mockResolvedValue(undefined);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalledWith(
        expect.objectContaining({ event: `automation-${Status.canceled}` }),
      );
    });

    it('should handle MULTIPLY_PERIOD within time period (duplicate)', async () => {
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY_PERIOD,
            timePeriod: 60, // 60 minutes
            conditional: null,
          },
        },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact, startedAt: Date.now() });
      const recentAutomation = createContactAutomation({
        status: 'running',
        createdAt: new Date(), // just now
      });
      msgopsService.getContactAutomations.mockResolvedValue(recentAutomation);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [],
      } as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(msgopsService.createContactAutomations).toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.duplicate }),
      );
    });
  });

  describe('Function: cancelRunningAutomation', () => {
    it('should return 200 when tag not found', async () => {
      const leadMessage = createLeadMessage();
      msgopsService.getTagByName.mockResolvedValue(null);

      const result = await automationHandler.cancelRunningAutomation(leadMessage, true);

      expect(result).toEqual({ status: 200 });
    });

    it('should delete contact tag and send tag-out when removeTag is true', async () => {
      const tag = createTag();
      const leadMessage = createLeadMessage();
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.deleteContactTag.mockResolvedValue({} as any);
      msgopsService.getAutomationsByTag.mockResolvedValue([]);

      await automationHandler.cancelRunningAutomation(leadMessage, true);

      expect(msgopsService.deleteContactTag).toHaveBeenCalled();
      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalledWith(expect.objectContaining({ event: 'tag-out' }));
    });

    it('should not delete tag when removeTag is false', async () => {
      const tag = createTag();
      const automation = createAutomation();
      const leadMessage = createLeadMessage();
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.getAutomationsByTag.mockResolvedValue([automation]);
      msgopsService.getContactAutomations.mockResolvedValue(null);

      await automationHandler.cancelRunningAutomation(leadMessage, false);

      expect(msgopsService.deleteContactTag).not.toHaveBeenCalled();
    });

    it('should return automations when no automation found for tag', async () => {
      const tag = createTag();
      const leadMessage = createLeadMessage();
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.getAutomationsByTag.mockResolvedValue([]);

      await automationHandler.cancelRunningAutomation(leadMessage, false);

      expect(trackerService.logInfo).toHaveBeenCalledWith(expect.stringContaining('Automation not found'));
    });

    it('should cancel running automation and send clickhouse message', async () => {
      const tag = createTag();
      const automation = createAutomation();
      const runningAutomation = createContactAutomation({ status: 'running' });
      const leadMessage = createLeadMessage();
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.getAutomationsByTag.mockResolvedValue([automation]);
      msgopsService.getContactAutomations.mockResolvedValue(runningAutomation);
      msgopsService.updateContactAutomations.mockResolvedValue(undefined);

      await automationHandler.cancelRunningAutomation(leadMessage, false);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalledWith(
        expect.objectContaining({ event: `automation-${Status.canceled}` }),
      );
      expect(msgopsService.updateContactAutomations).toHaveBeenCalled();
    });

    it('should not cancel when no running automation found', async () => {
      const tag = createTag();
      const automation = createAutomation();
      const leadMessage = createLeadMessage();
      msgopsService.getTagByName.mockResolvedValue(tag);
      msgopsService.getAutomationsByTag.mockResolvedValue([automation]);
      msgopsService.getContactAutomations.mockResolvedValue(null);

      await automationHandler.cancelRunningAutomation(leadMessage, false);

      expect(msgopsService.updateContactAutomations).not.toHaveBeenCalled();
    });
  });

  describe('Function: eventsTrigger', () => {
    it('should return 200 when contact not found by uuid', async () => {
      const event = createEventsTrigger({ uuid: 'unknown-uuid', contactId: undefined });
      msgopsService.findContactByUuid.mockResolvedValue(null);

      const result = await automationHandler.eventsTrigger(event);

      expect(result).toEqual({ status: 200 });
    });

    it('should lookup contact by uuid and set contactId', async () => {
      const event = createEventsTrigger({ uuid: 'test-uuid', contactId: undefined });
      msgopsService.findContactByUuid.mockResolvedValue({ id: 100, email: 'a@t.com' });
      msgopsService.findContactById.mockResolvedValue(createContact());
      msgopsService.getAutomationsByEvent.mockResolvedValue([]);

      await automationHandler.eventsTrigger(event);

      expect(msgopsService.findContactById).toHaveBeenCalledWith(100, event.accountId);
    });

    it('should return 200 when contact not found by id', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const event = createEventsTrigger({ contactId: 999 });
      msgopsService.findContactById.mockResolvedValue(null);

      const result = await automationHandler.eventsTrigger(event);

      expect(result).toEqual({ status: 200 });
    });

    it('should return 200 when no automations found', async () => {
      const event = createEventsTrigger();
      msgopsService.findContactById.mockResolvedValue(createContact());
      msgopsService.getAutomationsByEvent.mockResolvedValue([]);

      const result = await automationHandler.eventsTrigger(event);

      expect(result).toEqual({ status: 200 });
    });

    it('should use getCampaignsByEvent when isTriggerCampaign is true', async () => {
      const event = createEventsTrigger({ isTriggerCampaign: true });
      msgopsService.findContactById.mockResolvedValue(createContact());
      msgopsService.getCampaignsByEvent.mockResolvedValue([]);

      await automationHandler.eventsTrigger(event);

      expect(msgopsService.getCampaignsByEvent).toHaveBeenCalled();
      expect(msgopsService.getAutomationsByEvent).not.toHaveBeenCalled();
    });

    it('should use eventId when messageId is not set', async () => {
      const event = createEventsTrigger({ messageId: undefined, eventId: 500 });
      msgopsService.findContactById.mockResolvedValue(createContact());
      msgopsService.getAutomationsByEvent.mockResolvedValue([]);

      await automationHandler.eventsTrigger(event);

      expect(msgopsService.getAutomationsByEvent).toHaveBeenCalledWith(expect.anything(), expect.anything(), 500);
    });

    it('should handle contactId as string "undefined"', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const event = createEventsTrigger({ contactId: 'undefined' as any });
      msgopsService.findContactById.mockResolvedValue(null);

      const result = await automationHandler.eventsTrigger(event);

      expect(result).toEqual({ status: 200 });
    });
  });

  describe('Function: updateLead', () => {
    it('should update lead when leadId is set and not from another automation', async () => {
      msgopsService.updateLead.mockResolvedValue({} as any);
      await automationHandler.updateLead(
        1,
        {
          automationId: 10,
          automationTitle: 'Test',
          automationStatus: 'running',
        },
        false,
      );
      expect(msgopsService.updateLead).toHaveBeenCalled();
    });

    it('should not update lead when leadId is 0', async () => {
      await automationHandler.updateLead(
        0,
        {
          automationId: 10,
          automationTitle: 'Test',
          automationStatus: 'running',
        },
        false,
      );
      expect(msgopsService.updateLead).not.toHaveBeenCalled();
    });

    it('should not update lead when isLeadFromAnotherAutomation is true', async () => {
      await automationHandler.updateLead(
        1,
        {
          automationId: 10,
          automationTitle: 'Test',
          automationStatus: 'running',
        },
        true,
      );
      expect(msgopsService.updateLead).not.toHaveBeenCalled();
    });
  });

  describe('Function: startAutomation - with conditionals', () => {
    const dayjs = require('dayjs');

    it('should return false when conditional evaluates to false', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [{ type: 'interation', event: 'last_open_date', conditional_interation: 'yes', time: '30' }],
          },
        },
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        last_open_date: null, // no open date -> will fail conditional
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      // Should not create a new running automation since conditional was false
      expect(msgopsService.createContactAutomations).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.running }),
      );
    });

    it('should proceed when no conditionals defined', async () => {
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: null,
          },
        },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact });
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(msgopsService.createContactAutomations).toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.running }),
      );
    });

    it('should proceed when conditionals array is empty', async () => {
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [],
          },
        },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact });
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(msgopsService.createContactAutomations).toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.running }),
      );
    });

    it('should handle completed automation status (not cancel running)', async () => {
      const automation = createAutomation({
        triggers: { settings: { applyFrequency: TriggerType.MULTIPLY, conditional: null } },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact });
      const completedAutomation = createContactAutomation({ status: 'completed' });
      msgopsService.getContactAutomations.mockResolvedValue(completedAutomation);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      // Should not cancel since status is completed, not running
      expect(msgopsService.updateContactAutomations).not.toHaveBeenCalled();
      // Should still create new running automation
      expect(msgopsService.createContactAutomations).toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.running }),
      );
    });

    it('should handle MULTIPLY_PERIOD outside time window (not duplicate)', async () => {
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY_PERIOD,
            timePeriod: 60,
            conditional: null,
          },
        },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact, startedAt: Date.now() });
      const oldAutomation = createContactAutomation({
        status: 'completed',
        createdAt: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
      });
      msgopsService.getContactAutomations.mockResolvedValue(oldAutomation);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(msgopsService.createContactAutomations).toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.running }),
      );
    });

    it('should handle error in updateContact/sendMessage', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: { settings: { applyFrequency: TriggerType.MULTIPLY, conditional: null } },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact });
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockRejectedValue(new Error('update failed'));

      await expect(automationHandler.startAutomation([automation], leadMessage, contact, dayjs)).rejects.toBeDefined();
    });

    it('should handle UNIQUE frequency with no existing automation (allow)', async () => {
      const automation = createAutomation({
        triggers: { settings: { applyFrequency: TriggerType.UNIQUE, conditional: null } },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact });
      msgopsService.getFirstContactAutomations.mockResolvedValue(null);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(msgopsService.createContactAutomations).toHaveBeenCalledWith(
        expect.objectContaining({ status: Status.running }),
      );
    });

    it('should evaluate interation conditional (yes, time=all)', async () => {
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [{ type: 'interation', event: 'last_open_date', conditional_interation: 'yes', time: 'all' }],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        last_open_date: '2024-01-01',
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'automation-trigger-qualified' }),
      );
    });

    it('should evaluate tag conditional', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [{ type: 'tag', tag_id: [1, 2], conditional_tag: 'in' }],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        tags: [1, 3],
        customFields: {},
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      // The conditional should pass (tag 1 is in the contact's tags)
      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should evaluate custom_field conditional with =', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'custom_field',
                custom_field_id: 5,
                conditional_custom_field: '=',
                custom_field_value: 'VIP',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        tags: [],
        customFields: { 5: 'VIP' },
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should evaluate user_field conditional for created_at_date with -', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'user_field',
                user_field_key: 'created_at_date',
                conditional_user_field: '-',
                user_field_value: '7',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        created_at_date: new Date().toISOString().split('T')[0],
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should evaluate user_field conditional for email_provider', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'user_field',
                user_field_key: 'email_provider',
                conditional_user_field: '=',
                user_field_value: 'Gmail',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        email_provider: 'Gmail',
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should evaluate user_field conditional for communication_channels', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'user_field',
                user_field_key: 'communication_channels',
                conditional_user_field: 'true',
                user_field_value: 'has_email',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        has_email: true,
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should evaluate custom_event conditional (in)', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'custom_event',
                event: { name: 'purchase' },
                conditional_event_type: 'in',
                conditional_event_filter: '>=',
                time: '30',
                time_type: 'days',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.queryEventsLogs.mockResolvedValue([{ id: 1 }]);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(msgopsService.queryEventsLogs).toHaveBeenCalled();
    });

    it('should evaluate multiple conditionals with AND logic', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              { type: 'interation', event: 'last_open_date', conditional_interation: 'yes', time: 'all' },
              {
                type: 'interation',
                event: 'last_click_date',
                conditional_interation: 'yes',
                time: 'all',
                conditional: 'and',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        last_open_date: '2024-01-01',
        last_click_date: '2024-01-01',
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'automation-trigger-qualified' }),
      );
    });

    it('should evaluate conditionals with OR logic', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              { type: 'interation', event: 'last_open_date', conditional_interation: 'yes', time: 'all' },
              {
                type: 'interation',
                event: 'last_click_date',
                conditional_interation: 'yes',
                time: 'all',
                conditional: 'or',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        last_open_date: '2024-01-01',
        last_click_date: null,
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should handle lead conditional', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              { type: 'lead', lead_field_key: 'source', conditional_lead_field: '=', lead_field_value: 'web' },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact, leadId: 1 });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.findLeadById.mockResolvedValue({ id: 1, source: 'web' } as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(msgopsService.findLeadById).toHaveBeenCalledWith(1);
    });

    it('should handle custom_field with iLike conditional', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'custom_field',
                custom_field_id: 5,
                conditional_custom_field: 'iLike',
                custom_field_value: 'gold',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        tags: [],
        customFields: { 5: 'gold-premium' },
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should handle custom_event with range time_type', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'custom_event',
                event: { name: 'purchase' },
                conditional_event_type: 'in',
                time_type: 'range',
                custom_event_date: '2024-01-01',
                custom_event_date_end: '2024-12-31',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.queryEventsLogs.mockResolvedValue([{ id: 1 }]);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(msgopsService.queryEventsLogs).toHaveBeenCalledWith(expect.stringContaining('BETWEEN'));
    });

    it('should handle custom_event with date time_type', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'custom_event',
                event: { name: 'purchase' },
                conditional_event_type: 'not in',
                time_type: 'date',
                custom_event_date: '2024-06-01',
                conditional_event_filter: '>=',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.queryEventsLogs.mockResolvedValue([]);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should handle custom_event with current_week time', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'custom_event',
                event: { name: 'purchase' },
                conditional_event_type: 'in',
                time: 'current_week',
                conditional_week_day_filter: 1,
                conditional_event_filter: '>=',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.queryEventsLogs.mockResolvedValue([{ id: 1 }]);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(msgopsService.queryEventsLogs).toHaveBeenCalledWith(expect.stringContaining('BETWEEN'));
    });

    it('should evaluate automation conditional with automationIds', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'automation',
                user_field_automation: [{ id: 10 }],
                conditional_user_field: '>',
                user_field_value: 7,
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        contactAutomations: [{ automationId: 10, createdAt: new Date() }],
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should handle user_field conditional for created_at_date with = operator', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'user_field',
                user_field_key: 'created_at_date',
                conditional_user_field: '=',
                user_field_value: '2024-01-01',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        created_at_date: new Date('2024-01-01').toISOString(),
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should handle custom_field with compare_fields filter', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [
              {
                type: 'custom_field',
                custom_field_id: 5,
                conditional_custom_field: '=',
                custom_field_value: 6,
                filter_custom_field: 'compare_fields',
              },
            ],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const conditionalContact = {
        id: contact.id,
        accountId: contact.accountId,
        uuid: contact.uuid,
        email: contact.email,
        tags: [],
        customFields: { 5: 'same_value', 6: 'same_value' },
        parseCustomFields: jest.fn(),
      };
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(conditionalContact as any);
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [{ id: 99, createdAt: new Date() }],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      expect(pubSubProvider.sendMessageClickHouse).toHaveBeenCalled();
    });

    it('should return false when contact not found in conditional', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const automation = createAutomation({
        triggers: {
          settings: {
            applyFrequency: TriggerType.MULTIPLY,
            conditional: [{ type: 'interation', event: 'last_open_date', conditional_interation: 'yes', time: 'all' }],
          },
        },
        account: createAccount({ accountConfigs: { time_zone: 'UTC' } as any }),
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact });
      msgopsService.findContactByIdConditional.mockResolvedValue(null);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      // Should not proceed to create automations
      expect(msgopsService.createContactAutomations).not.toHaveBeenCalled();
    });

    it('should handle automation with no verticalType', async () => {
      const automation = createAutomation({
        verticalType: null,
        triggers: { settings: { applyFrequency: TriggerType.MULTIPLY, conditional: null } },
      });
      const contact = createContact();
      const leadMessage = createLeadMessage({ contact });
      msgopsService.getContactAutomations.mockResolvedValue(null);
      msgopsService.createContactAutomations.mockResolvedValue({
        generatedMaps: [],
      } as any);
      msgopsService.updateContact.mockResolvedValue({} as any);

      await automationHandler.startAutomation([automation], leadMessage, contact, dayjs);

      // Should still call updateContact but without lastVerticalType
      expect(msgopsService.updateContact).toHaveBeenCalledWith(
        contact,
        expect.not.objectContaining({ lastVerticalType: expect.anything() }),
      );
    });
  });

  describe('Function: updateCancelAutomationRunning', () => {
    it('should call updateContactAutomations with canceled status', async () => {
      const automationRunning = createContactAutomation();
      const leadMessage = createLeadMessage();
      msgopsService.updateContactAutomations.mockResolvedValue(undefined);

      await automationHandler.updateCancelAutomationRunning(automationRunning, 10, 'Test', leadMessage);

      expect(msgopsService.updateContactAutomations).toHaveBeenCalledWith(
        automationRunning,
        expect.objectContaining({ status: Status.canceled }),
        leadMessage,
      );
    });
  });
});
