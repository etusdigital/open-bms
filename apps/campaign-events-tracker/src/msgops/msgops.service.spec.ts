import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MsgopsService } from './msgops.service';
import { CampaignEntity } from './entities/campaign.entity';
import { CampaignContactEntity } from './entities/campaign-contact.entity';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import { CampaignRecurrenceFrequency, CampaignsType, StatusCampaignEnum } from '../app.interfaces';

describe('MsgopsService', () => {
  let service: MsgopsService;

  const mockCampaignRepo = {
    findOneOrFail: jest.fn(),
    merge: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const mockCampaignContactRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      delete: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            execute: jest.fn().mockResolvedValue({ affected: 5 }),
          }),
        }),
      }),
    }),
  };

  const mockQueuePublisher = {
    addCampaignTrigger: jest.fn().mockResolvedValue('mock-job-id'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MsgopsService,
        { provide: getRepositoryToken(CampaignEntity), useValue: mockCampaignRepo },
        { provide: getRepositoryToken(CampaignContactEntity), useValue: mockCampaignContactRepo },
        { provide: QueuePublisher, useValue: mockQueuePublisher },
      ],
    }).compile();

    service = module.get<MsgopsService>(MsgopsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateStatus', () => {
    it('should merge campaign with dto when status is not COMPLETED', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.SENDING,
        type: CampaignsType.SIMPLE,
      } as CampaignEntity;
      mockCampaignRepo.findOneOrFail.mockResolvedValue(campaign);

      const dto = { status: StatusCampaignEnum.COMPLETED, sentContacts: 100, sentPercentage: 100 };
      await service.updateStatus(1, dto);

      expect(mockCampaignRepo.merge).toHaveBeenCalledWith(campaign, dto);
      expect(mockCampaignRepo.update).toHaveBeenCalled();
    });

    it('should not merge when campaign is already COMPLETED', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.SIMPLE,
      } as CampaignEntity;
      mockCampaignRepo.findOneOrFail.mockResolvedValue(campaign);

      await service.updateStatus(1, { status: StatusCampaignEnum.SENDING });

      expect(mockCampaignRepo.merge).not.toHaveBeenCalled();
    });

    it('should clear contacts and handle recurring campaign when status is COMPLETED', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 0,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 1,
          frequency: CampaignRecurrenceFrequency.daily,
          weekDays: [],
          hasExpiration: false,
          untilDate: null,
          untilSend: null,
        },
      } as CampaignEntity;
      mockCampaignRepo.findOneOrFail.mockResolvedValue(campaign);

      await service.updateStatus(1, { status: StatusCampaignEnum.SENDING });

      expect(mockCampaignContactRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should clear contacts for non-recurring completed campaign', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.SIMPLE,
      } as CampaignEntity;
      mockCampaignRepo.findOneOrFail.mockResolvedValue(campaign);

      await service.updateStatus(1, { status: StatusCampaignEnum.SENDING });

      expect(mockCampaignContactRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockCampaignRepo.update).toHaveBeenCalled();
    });
  });

  describe('clearCampaignsContacts', () => {
    it('should delete campaign contacts by campaign id', async () => {
      await service.clearCampaignsContacts(1);
      expect(mockCampaignContactRepo.createQueryBuilder).toHaveBeenCalledWith('campaigns_contacts');
    });
  });

  describe('setRecurringCampaign', () => {
    it('should increment recurrenceCount', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 0,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 1,
          frequency: CampaignRecurrenceFrequency.daily,
          weekDays: [],
          hasExpiration: false,
          untilDate: null,
          untilSend: null,
        },
      } as CampaignEntity;

      const result = await service.setRecurringCampaign(campaign);
      expect(result.recurrenceCount).toBe(1);
    });

    it('should set firstSentDate on first recurrence', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 0,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 1,
          frequency: CampaignRecurrenceFrequency.daily,
          weekDays: [],
          hasExpiration: false,
          untilDate: null,
          untilSend: null,
        },
      } as CampaignEntity;

      const result = await service.setRecurringCampaign(campaign);
      expect(result.recurrenceSettings.firstSentDate).toEqual(new Date('2026-03-01T10:00:00Z'));
    });

    it('should not set firstSentDate on subsequent recurrences', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 1,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 1,
          frequency: CampaignRecurrenceFrequency.daily,
          weekDays: [],
          hasExpiration: false,
          untilDate: null,
          untilSend: null,
          firstSentDate: new Date('2026-03-01T10:00:00Z'),
        },
      } as CampaignEntity;

      const result = await service.setRecurringCampaign(campaign);
      expect(result.recurrenceSettings.firstSentDate).toEqual(new Date('2026-03-01T10:00:00Z'));
    });

    it('should return campaign without rescheduling if untilSend limit is reached', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 2,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 1,
          frequency: CampaignRecurrenceFrequency.daily,
          weekDays: [],
          hasExpiration: false,
          untilDate: null,
          untilSend: 3,
        },
      } as CampaignEntity;

      const result = await service.setRecurringCampaign(campaign);
      expect(result.status).toBe(StatusCampaignEnum.COMPLETED);
      expect(mockQueuePublisher.addCampaignTrigger).not.toHaveBeenCalled();
    });

    it('should set daily recurrence and enqueue trigger job', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 0,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 2,
          frequency: CampaignRecurrenceFrequency.daily,
          weekDays: [],
          hasExpiration: false,
          untilDate: null,
          untilSend: null,
        },
      } as CampaignEntity;

      const result = await service.setRecurringCampaign(campaign);
      expect(result.status).toBe(StatusCampaignEnum.SCHEDULED);
      expect(mockQueuePublisher.addCampaignTrigger).toHaveBeenCalled();
    });

    it('should set monthly recurrence', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 0,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 1,
          frequency: CampaignRecurrenceFrequency.monthly,
          weekDays: [],
          hasExpiration: false,
          untilDate: null,
          untilSend: null,
        },
      } as CampaignEntity;

      const result = await service.setRecurringCampaign(campaign);
      expect(result.status).toBe(StatusCampaignEnum.SCHEDULED);
      expect(result.scheduleTo.getMonth()).toBe(3); // April (0-indexed)
    });

    it('should set weekly recurrence and enqueue trigger job', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 0,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 1,
          frequency: CampaignRecurrenceFrequency.weekly,
          weekDays: [1, 3, 5],
          hasExpiration: false,
          untilDate: null,
          untilSend: null,
        },
      } as CampaignEntity;

      const result = await service.setRecurringCampaign(campaign);
      expect(result.status).toBe(StatusCampaignEnum.SCHEDULED);
      expect(mockQueuePublisher.addCampaignTrigger).toHaveBeenCalled();
    });

    it('should mark as COMPLETED when next date exceeds untilDate', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 0,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 1,
          frequency: CampaignRecurrenceFrequency.daily,
          weekDays: [],
          hasExpiration: true,
          untilDate: new Date('2026-03-15T10:00:00Z'),
          untilSend: null,
          lastSentDate: new Date('2026-03-14T10:00:00Z'),
        },
      } as CampaignEntity;

      const result = await service.setRecurringCampaign(campaign);
      expect(result.status).toBe(StatusCampaignEnum.COMPLETED);
    });

    it('should set scheduleToCloudTaskId from queue job id', async () => {
      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 0,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 1,
          frequency: CampaignRecurrenceFrequency.daily,
          weekDays: [],
          hasExpiration: false,
          untilDate: null,
          untilSend: null,
        },
      } as CampaignEntity;

      const result = await service.setRecurringCampaign(campaign);
      expect(result.scheduleToCloudTaskId).toBe('mock-job-id');
    });

    it('should use empty string when addCampaignTrigger returns falsy', async () => {
      mockQueuePublisher.addCampaignTrigger.mockResolvedValueOnce('');

      const campaign = {
        id: 1,
        status: StatusCampaignEnum.COMPLETED,
        type: CampaignsType.RECURRING,
        scheduleTo: new Date('2026-03-15T10:00:00Z'),
        recurrenceCount: 0,
        recurrenceSettings: {
          date: new Date('2026-03-01T10:00:00Z'),
          interval: 1,
          frequency: CampaignRecurrenceFrequency.daily,
          weekDays: [],
          hasExpiration: false,
          untilDate: null,
          untilSend: null,
        },
      } as CampaignEntity;

      const result = await service.setRecurringCampaign(campaign);
      expect(result.scheduleToCloudTaskId).toBe('');
    });
  });

  describe('nextOccurrence', () => {
    it('should find next occurrence for weekly recurrence', () => {
      const currentScheduleTo = new Date('2026-03-15T10:00:00Z');
      const weekDays = [1, 3, 5]; // Mon, Wed, Fri
      const interval = 1;

      const result = service.nextOccurrence(currentScheduleTo, weekDays, interval);
      expect(result).toBeDefined();
      expect(weekDays).toContain(result.getDay());
    });

    it('should handle weekly recurrence with interval > 1', () => {
      const currentScheduleTo = new Date('2026-03-15T10:00:00Z');
      const weekDays = [1]; // Monday
      const interval = 2;

      const result = service.nextOccurrence(currentScheduleTo, weekDays, interval);
      expect(result).toBeDefined();
      expect(result.getDay()).toBe(1);
    });

    it('should find next occurrence when current day index is found', () => {
      const currentScheduleTo = new Date('2026-03-11T10:00:00Z');
      const weekDays = [3, 5]; // Wed, Fri
      const interval = 1;

      const result = service.nextOccurrence(currentScheduleTo, weekDays, interval);
      expect(result).toBeDefined();
    });

    it('should wrap around to next week when no more days this week', () => {
      const currentScheduleTo = new Date('2026-03-13T10:00:00Z');
      const weekDays = [1, 3]; // Mon, Wed
      const interval = 1;

      const result = service.nextOccurrence(currentScheduleTo, weekDays, interval);
      expect(result).toBeDefined();
    });
  });

  describe('isNextDateValid', () => {
    it('should return true when scheduleTo is before sendUntilDate', () => {
      const scheduleTo = new Date('2026-03-15T10:00:00Z');
      const sendUntilDate = new Date('2026-03-20T10:00:00Z');
      expect(service.isNextDateValid(scheduleTo, sendUntilDate)).toBe(true);
    });

    it('should return true when scheduleTo equals sendUntilDate', () => {
      const scheduleTo = new Date('2026-03-15T10:00:00Z');
      const sendUntilDate = new Date('2026-03-15T10:00:00Z');
      expect(service.isNextDateValid(scheduleTo, sendUntilDate)).toBe(true);
    });

    it('should return false when scheduleTo is after sendUntilDate', () => {
      const scheduleTo = new Date('2026-03-20T10:00:00Z');
      const sendUntilDate = new Date('2026-03-15T10:00:00Z');
      expect(service.isNextDateValid(scheduleTo, sendUntilDate)).toBe(false);
    });
  });
});
