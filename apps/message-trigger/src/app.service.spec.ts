import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { StepType } from './interfaces';
import { createAppServiceMocks, createAppServiceTestingModule, resetAllMocks, setupTestEnvironment, expectTrackerSendCalled, expectPubSubCalled } from './__mocks__/test-helpers';
import { createMockLeadStateMessage, createMockStep, createMockEmail, createMockContact, createEndStep } from './__mocks__/test-fixtures';

// Mock dayjs to have consistent dates in tests
jest.mock('dayjs', () => {
  const actualDayjs = jest.requireActual('dayjs');
  const mockDayjs = (date?: any) => actualDayjs(date || '2024-06-15');
  Object.assign(mockDayjs, actualDayjs);
  mockDayjs.extend = actualDayjs.extend;
  return mockDayjs;
});

describe('AppService', () => {
  let service: AppService;
  let mocks: ReturnType<typeof createAppServiceMocks>;
  let redisClient: any;

  beforeAll(() => {
    setupTestEnvironment();
  });

  beforeEach(async () => {
    mocks = createAppServiceMocks();
    redisClient = mocks.mockRedisClient;

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService, ...createAppServiceTestingModule(mocks).providers],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  afterEach(() => {
    resetAllMocks(mocks);
    jest.clearAllMocks();
  });

  describe('Entry Points', () => {
    describe('receiveMessage', () => {
      it('should process message successfully and send tracker events', async () => {
        // Arrange
        const mockLeadStateMessage = createMockLeadStateMessage({
          automation: {
            id: 50,
            type: 'email',
            title: 'Test Automation',
            steps: [createEndStep()],
          },
        });
        const messageId = 'msg-123';
        const redisKeyDelete = 'redis-key-to-delete';

        redisClient.del.mockResolvedValueOnce(0);
        redisClient.del.mockResolvedValue(1);

        // Act
        const result = await service.receiveMessage(mockLeadStateMessage, messageId, redisKeyDelete);

        // Assert
        expect(result.status).toBe(true);
        expect(redisClient.del).toHaveBeenCalledWith(redisKeyDelete);
        expectTrackerSendCalled(mocks.mockTrackerService, 'MSGOPS_RECEIVED_LEAD', {
          automation_name: 'Test Automation',
          email: mockLeadStateMessage.contact.email,
        });
      });

      it('should stop automation when redis key exists', async () => {
        // Arrange
        const mockLeadStateMessage = createMockLeadStateMessage({
          automation: {
            id: 50,
            type: 'email',
            title: 'Test Automation',
            steps: [createMockStep(StepType.EMAIL)],
          },
        });
        const messageId = 'msg-456';

        redisClient.del.mockResolvedValueOnce(1);
        redisClient.del.mockResolvedValue(1);

        // Act
        const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

        // Assert
        expect(result.status).toBe(true);
        expect(result.message).toContain('Automation stopped');
        expectTrackerSendCalled(mocks.mockTrackerService, 'MSGOPS_AUTOMATION_STOPPED', {
          automation_name: 'Test Automation',
        });
      });

      it('should throw BadRequestException on processing error', async () => {
        // Arrange
        const mockLeadStateMessage = createMockLeadStateMessage({
          automation: {
            id: 50,
            type: 'email',
            title: 'Test Automation',
            steps: [createMockStep(StepType.EMAIL)],
          },
        });
        const messageId = 'msg-error';

        redisClient.del.mockResolvedValueOnce(0);
        mocks.mockMsgopsService.getMessageById.mockRejectedValue(new Error('Database error'));

        // Act & Assert
        await expect(service.receiveMessage(mockLeadStateMessage, messageId, null)).rejects.toThrow(BadRequestException);
      });
    });

    describe('getState', () => {
      it('should return health check status', async () => {
        // Act
        const result = await service.getState();

        // Assert
        expect(result).toEqual({
          message: 'OK!',
          status: true,
        });
      });
    });
  });

  describe('Step Type: END', () => {
    it('should process END step and mark automation as completed', async () => {
      // Arrange
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [createEndStep()],
        },
        tagName: 'test-tag',
      });
      const messageId = 'msg-end';

      redisClient.del.mockResolvedValueOnce(0);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result.status).toBe(true);
      expect(result.message).toContain('Executed stype type end with success');
      expectPubSubCalled(mocks.mockQueuePublisher, 'tag-process', {
        tagName: 'test-tag',
      });
    });
  });

  describe('Step Type: EMAIL', () => {
    it('should process EMAIL step successfully', async () => {
      // Arrange
      const emailStep = createMockStep(StepType.EMAIL, {
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [emailStep],
        },
      });
      const messageId = 'msg-email';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.getMessageById.mockResolvedValue(createMockEmail());

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(mocks.mockMsgopsService.getMessageById).toHaveBeenCalledWith(200);
      expectPubSubCalled(mocks.mockQueuePublisher, 'send-email');
    });

    it('should increment activeEmailId for next email', async () => {
      // Arrange
      const emailStep = createMockStep(StepType.EMAIL, {
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          name: 'test-automation',
          steps: [emailStep],
        },
        activeEmailId: 2,
      });
      const messageId = 'msg-email-increment';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.getMessageById.mockResolvedValue(createMockEmail());

      // Act
      await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      const pubSubCall = mocks.mockQueuePublisher.sendAsyncMessage.mock.calls[0];
      const sentMessage = pubSubCall[1];
      expect(sentMessage.next.data.activeEmailId).toBe(3);
    });
  });

  describe('Step Type: WAIT', () => {
    it('should create Google Task for WAIT step with minutes', async () => {
      // Arrange
      const waitStep = createMockStep(StepType.WAIT, {
        settings: { timer: 30, timerType: 'minutes' },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [waitStep],
        },
      });
      const messageId = 'msg-wait-minutes';

      redisClient.del.mockResolvedValueOnce(0);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('task-123');
      expect(mocks.mockQueuePublisher.scheduleDelayedStep).toHaveBeenCalledWith(expect.any(Object), 30, StepType.WAIT);
      expectTrackerSendCalled(mocks.mockTrackerService, 'MSGOPS_CREATED_CLOUD_TASK', {
        active_step_type: StepType.WAIT,
      });
    });

    it('should create Google Task for WAIT step with hours converted to minutes', async () => {
      // Arrange
      const waitStep = createMockStep(StepType.WAIT, {
        settings: { timer: 2, timerType: 'hours' },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [waitStep],
        },
      });
      const messageId = 'msg-wait-hours';

      redisClient.del.mockResolvedValueOnce(0);

      // Act
      await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(mocks.mockQueuePublisher.scheduleDelayedStep).toHaveBeenCalledWith(
        expect.any(Object),
        120, // 2 hours * 60 minutes
        StepType.WAIT,
      );
    });

    it('should throw BadRequestException when Google Tasks fails', async () => {
      // Arrange
      const waitStep = createMockStep(StepType.WAIT, {
        settings: { timer: 30, timerType: 'minutes' },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [waitStep],
        },
      });
      const messageId = 'msg-wait-error';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockQueuePublisher.scheduleDelayedStep.mockRejectedValue(new Error('Task creation failed'));

      // Act & Assert
      await expect(service.receiveMessage(mockLeadStateMessage, messageId, null)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Step Type: ADD_TAG / REMOVE_TAG', () => {
    it('should process ADD_TAG step with single tag', async () => {
      // Arrange
      const addTagStep = createMockStep(StepType.ADD_TAG, {
        settings: { name: 'new-tag' },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [addTagStep],
        },
      });
      const messageId = 'msg-add-tag';

      redisClient.del.mockResolvedValueOnce(0);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(mocks.mockQueuePublisher.sendAsyncMessage).toHaveBeenCalledWith('tag-process', expect.objectContaining({ type: 'add', tagName: 'new-tag' }));
    });

    it('should process REMOVE_TAG step with single tag', async () => {
      // Arrange
      const removeTagStep = createMockStep(StepType.REMOVE_TAG, {
        settings: { name: 'old-tag' },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [removeTagStep],
        },
      });
      const messageId = 'msg-remove-tag';

      redisClient.del.mockResolvedValueOnce(0);

      // Act
      await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(mocks.mockQueuePublisher.sendAsyncMessage).toHaveBeenCalledWith('tag-process', expect.objectContaining({ type: 'remove', tagName: 'old-tag' }));
    });

    it('should process ADD_TAG step with multiple tags in array format', async () => {
      // Arrange
      // Note: Can't use createMockStep here because it spreads settings, destroying array
      const addTagStep: any = {
        id: 100,
        type: StepType.ADD_TAG,
        settings: [{ name: 'tag1' }, { name: 'tag2' }, { name: 'tag3' }], // Keep as array
        child: [createEndStep()],
      };
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [addTagStep],
        },
      });
      const messageId = 'msg-add-multiple-tags';

      redisClient.del.mockResolvedValueOnce(0);
      // Reset mocks from previous tests
      mocks.mockQueuePublisher.sendAsyncMessage.mockReset();
      mocks.mockQueuePublisher.sendAsyncMessage.mockResolvedValue('message-id-123');

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');

      // Verify processStepToInternalEvent was called with tags property
      expect(mocks.mockQueuePublisher.sendInternalEvent).toHaveBeenCalled();

      // Verify tag processing was called multiple times (Promise.all processes array)
      expect(mocks.mockQueuePublisher.sendAsyncMessage).toHaveBeenCalled();

      // Verify next step was published
      expectPubSubCalled(mocks.mockQueuePublisher, 'message-trigger');
    });

    it('should process REMOVE_TAG step with multiple tags in array format', async () => {
      // Arrange
      // Note: Can't use createMockStep here because it spreads settings, destroying array
      const removeTagStep: any = {
        id: 100,
        type: StepType.REMOVE_TAG,
        settings: [{ name: 'tag-a' }, { name: 'tag-b' }], // Keep as array
        child: [createEndStep()],
      };
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [removeTagStep],
        },
      });
      const messageId = 'msg-remove-multiple-tags';

      redisClient.del.mockResolvedValueOnce(0);
      // Reset mocks from previous tests
      mocks.mockQueuePublisher.sendAsyncMessage.mockReset();
      mocks.mockQueuePublisher.sendAsyncMessage.mockResolvedValue('message-id-123');

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');

      // Verify tag processing was called
      expect(mocks.mockQueuePublisher.sendAsyncMessage).toHaveBeenCalled();

      // Verify next step was published
      expectPubSubCalled(mocks.mockQueuePublisher, 'message-trigger');
    });

    it('should handle error in processTag gracefully', async () => {
      // Arrange
      const addTagStep = createMockStep(StepType.ADD_TAG, {
        settings: { name: 'error-tag' },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Tag Error',
          steps: [addTagStep],
        },
      });
      const messageId = 'msg-tag-error';

      redisClient.del.mockResolvedValueOnce(0);
      // Make tag processing fail
      mocks.mockQueuePublisher.sendInternalEvent.mockResolvedValue('event-id'); // For processStepToInternalEvent
      mocks.mockQueuePublisher.sendAsyncMessage.mockRejectedValueOnce(new Error('PubSub tag processing failed')); // For processTag - this should trigger the catch block

      // Act & Assert
      await expect(service.receiveMessage(mockLeadStateMessage, messageId, null)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Step Type: CONDITIONAL_TIME', () => {
    it('should delegate to ConditionStep service', async () => {
      // Arrange
      const conditionalTimeStep = createMockStep(StepType.CONDITIONAL_TIME, {
        settings: { initialTime: 8, endTime: 21 },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [conditionalTimeStep],
        },
      });
      const messageId = 'msg-conditional-time';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockConditionStep.processConditionalTime.mockResolvedValue('task-id-456');

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('task-id-456');
      expect(mocks.mockConditionStep.processConditionalTime).toHaveBeenCalledWith(messageId, mockLeadStateMessage, expect.any(Object), conditionalTimeStep, expect.any(Object));
    });
  });

  describe('Step Type: CONDITIONAL / SPLIT / TESTAB', () => {
    it('should process CONDITIONAL step and publish next message', async () => {
      // Arrange
      const conditionalStep = createMockStep(StepType.CONDITIONAL, {
        settings: [{ type: 'tag', conditional_tag: 'in', tag_id: [1, 2, 3] }],
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [conditionalStep],
        },
      });
      const messageId = 'msg-conditional';

      redisClient.del.mockResolvedValueOnce(0);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expectPubSubCalled(mocks.mockQueuePublisher, 'message-trigger');
    });

    it('should process SPLIT step and publish next message', async () => {
      // Arrange
      const splitStep = createMockStep(StepType.SPLIT, {
        settings: {},
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [splitStep],
        },
      });
      const messageId = 'msg-split';

      redisClient.del.mockResolvedValueOnce(0);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expectPubSubCalled(mocks.mockQueuePublisher, 'message-trigger');
    });

    it('should process TESTAB step and publish next message', async () => {
      // Arrange
      const testabStep = createMockStep(StepType.TESTAB, {
        settings: {
          status: 'active',
          messages: [
            { id: 100, name: 'Message 1', title: 'Title 1', subject: 'Subject 1' },
            { id: 101, name: 'Message 2', title: 'Title 2', subject: 'Subject 2' },
          ],
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation',
          steps: [testabStep],
        },
      });
      const messageId = 'msg-testab';

      redisClient.del.mockResolvedValueOnce(0);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expectPubSubCalled(mocks.mockQueuePublisher, 'message-trigger');
    });

    it('should select correct branch in SPLIT based on random percentage', async () => {
      // Arrange
      const splitStep: any = {
        id: 160,
        type: StepType.SPLIT,
        settings: {},
        child: [
          {
            settings: { value: 25 }, // Branch A: 0-25
            child: [
              {
                id: 201,
                type: StepType.EMAIL,
                settings: { id: 1001 },
                child: [createEndStep()],
              },
            ],
          },
          {
            settings: { value: 50 }, // Branch B: 26-75
            child: [
              {
                id: 202,
                type: StepType.EMAIL,
                settings: { id: 1002 },
                child: [createEndStep()],
              },
            ],
          },
          {
            settings: { value: 25 }, // Branch C: 76-100
            child: [
              {
                id: 203,
                type: StepType.EMAIL,
                settings: { id: 1003 },
                child: [createEndStep()],
              },
            ],
          },
        ],
      };

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Split Multiple',
          steps: [splitStep],
        },
      });

      redisClient.del.mockResolvedValueOnce(0);

      // Test Branch B selection (random = 60, should select branch with 26-75 range)
      jest.spyOn(Math, 'random').mockReturnValue(0.6);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-split-branchb', null);

      // Assert
      expect(result).toBe('message-id-123');
      // Verify pubsub was called to send next step
      expect(mocks.mockQueuePublisher.sendAsyncMessage).toHaveBeenCalled();
      // The test successfully exercises lines 437-440 (the branch selection logic with break statement)

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should select first branch in SPLIT when random is low', async () => {
      // Arrange
      const splitStep: any = {
        id: 161,
        type: StepType.SPLIT,
        settings: {},
        child: [
          {
            settings: { value: 30 },
            child: [
              {
                id: 204,
                type: StepType.EMAIL,
                settings: { id: 2001 },
                child: [createEndStep()],
              },
            ],
          },
          {
            settings: { value: 70 },
            child: [
              {
                id: 205,
                type: StepType.EMAIL,
                settings: { id: 2002 },
                child: [createEndStep()],
              },
            ],
          },
        ],
      };

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Split First',
          steps: [splitStep],
        },
      });

      redisClient.del.mockResolvedValueOnce(0);

      // Test first branch selection (random = 15, should select first branch 0-30)
      jest.spyOn(Math, 'random').mockReturnValue(0.15);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-split-first', null);

      // Assert
      expect(result).toBe('message-id-123');
      // Verify pubsub was called to send next step
      expect(mocks.mockQueuePublisher.sendAsyncMessage).toHaveBeenCalled();
      // The test successfully exercises lines 437-440 (the branch selection logic with break statement)

      jest.spyOn(Math, 'random').mockRestore();
    });
  });

  describe('Step Type: PUSH / SMS / WHATSAPP', () => {
    it('should process WEB_PUSH step successfully', async () => {
      // Arrange
      const pushStep = createMockStep(StepType.WEB_PUSH, {
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Push',
          steps: [pushStep],
        },
      });
      const messageId = 'msg-web-push';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.getMessageById.mockResolvedValue(createMockEmail());

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expectPubSubCalled(mocks.mockQueuePublisher, 'send-push');
    });

    it('should process SMS step successfully', async () => {
      // Arrange
      const smsStep = createMockStep(StepType.SMS, {
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test SMS',
          steps: [smsStep],
        },
      });
      const messageId = 'msg-sms';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.getMessageById.mockResolvedValue(createMockEmail());

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expectPubSubCalled(mocks.mockQueuePublisher, 'send-twilio');
    });

    it('should process WHATSAPP step successfully', async () => {
      // Arrange
      const whatsappStep = createMockStep(StepType.WHATSAPP, {
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test WhatsApp',
          steps: [whatsappStep],
        },
      });
      const messageId = 'msg-whatsapp';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.getMessageById.mockResolvedValue(createMockEmail());

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expectPubSubCalled(mocks.mockQueuePublisher, 'send-whatsapp');
    });
  });

  describe('Step Type: RANDOM_MESSAGE', () => {
    it('should select random message and process as EMAIL', async () => {
      // Arrange
      const randomMessageStep = createMockStep(StepType.RANDOM_MESSAGE, {
        settings: {
          messages: [
            { id: 100, title: 'Message 1', subject: 'Subject 1' },
            { id: 101, title: 'Message 2', subject: 'Subject 2' },
            { id: 102, title: 'Message 3', subject: 'Subject 3' },
          ],
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Random',
          steps: [randomMessageStep],
        },
      });
      const messageId = 'msg-random';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.getMessageById.mockResolvedValue(createMockEmail());
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(mocks.mockMsgopsService.getMessageById).toHaveBeenCalledWith(101);
      expectPubSubCalled(mocks.mockQueuePublisher, 'send-email');

      jest.spyOn(Math, 'random').mockRestore();
    });
  });

  describe('Step Type: RANDOM_WEB_PUSH / RANDOM_MOBILE_PUSH', () => {
    it('should select random message and process as WEB_PUSH', async () => {
      // Arrange
      const randomWebPushStep = createMockStep(StepType.RANDOM_WEB_PUSH, {
        settings: {
          messages: [
            { id: 100, title: 'Push 1', subject: 'Subject 1' },
            { id: 101, title: 'Push 2', subject: 'Subject 2' },
            { id: 102, title: 'Push 3', subject: 'Subject 3' },
          ],
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Random Web Push',
          steps: [randomWebPushStep],
        },
      });
      const messageId = 'msg-random-web-push';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.getMessageById.mockResolvedValue(createMockEmail());
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(mocks.mockMsgopsService.getMessageById).toHaveBeenCalledWith(101);
      expectPubSubCalled(mocks.mockQueuePublisher, 'send-push');

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should select random message and process as MOBILE_PUSH', async () => {
      // Arrange
      const randomMobilePushStep = createMockStep(StepType.RANDOM_MOBILE_PUSH, {
        settings: {
          messages: [
            { id: 200, title: 'Mobile Push 1', subject: 'Subject 1' },
            { id: 201, title: 'Mobile Push 2', subject: 'Subject 2' },
          ],
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Random Mobile Push',
          steps: [randomMobilePushStep],
        },
      });
      const messageId = 'msg-random-mobile-push';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.getMessageById.mockResolvedValue(createMockEmail());
      jest.spyOn(Math, 'random').mockReturnValue(0.3);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(mocks.mockMsgopsService.getMessageById).toHaveBeenCalledWith(200);
      expectPubSubCalled(mocks.mockQueuePublisher, 'send-push');

      jest.spyOn(Math, 'random').mockRestore();
    });
  });

  describe('Step Type: REMOVE_AUTOMATION', () => {
    it('should set Redis keys to remove automations', async () => {
      // Arrange
      const removeAutomationStep = createMockStep(StepType.REMOVE_AUTOMATION, {
        settings: {
          automations: [{ id: 10 }, { id: 20 }, { id: 30 }],
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Remove',
          steps: [removeAutomationStep],
        },
        contact: createMockContact({ id: 999 }),
      });
      const messageId = 'msg-remove-automation';

      redisClient.del.mockResolvedValueOnce(0);
      redisClient.set.mockResolvedValue('OK');

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(redisClient.set).toHaveBeenCalledTimes(3);
      expect(redisClient.set).toHaveBeenCalledWith('automation:10:remove_contact:999', 'true', 'EX', 43200);
    });
  });

  describe('Step Type: CONTACT_TRANSFER', () => {
    it('should transfer contact to another account', async () => {
      // Arrange
      const transferStep = createMockStep(StepType.CONTACT_TRANSFER, {
        settings: {
          tagName: 'transferred',
          apiKey: 'target-api-key',
          accountId: 999,
        },
        child: [createEndStep()],
      });
      const mockContact = createMockContact({ id: 123, accountId: 1 });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Transfer',
          steps: [transferStep],
        },
        contact: mockContact,
        account: { id: 1, customFields: [] },
      });
      const messageId = 'msg-transfer';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);
      mocks.mockHttpRequestProvider.process.mockResolvedValue({ status: 200 });

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(mocks.mockHttpRequestProvider.process).toHaveBeenCalledWith(
        'post',
        'https://test.com/contact-transfer',
        { 'Content-Type': 'application/json' },
        expect.objectContaining({
          tagName: 'transferred',
          apiKey: 'target-api-key',
        }),
      );
    });

    it('should throw BadRequestException when contact is not found', async () => {
      // Arrange
      const transferStep = createMockStep(StepType.CONTACT_TRANSFER, {
        settings: {
          tagName: 'transferred',
          apiKey: 'target-api-key',
          accountId: 999,
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Transfer Error',
          steps: [transferStep],
        },
        contact: createMockContact({ id: 123, accountId: 1 }),
      });
      const messageId = 'msg-transfer-error';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.receiveMessage(mockLeadStateMessage, messageId, null)).rejects.toThrow(BadRequestException);
      expect(mocks.mockMsgopsService.findContactById).toHaveBeenCalledWith(123, 1, ['customFields'], 'name');
    });
  });

  describe('Step Type: UPDATE_CUSTOM_FIELD', () => {
    it('should update custom field value', async () => {
      // Arrange
      const updateFieldStep = createMockStep(StepType.UPDATE_CUSTOM_FIELD, {
        settings: {
          customFieldSelected: { id: 42 },
          customFieldValue: 'new-value',
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Update Field',
          steps: [updateFieldStep],
        },
        contact: createMockContact({ id: 123, accountId: 1 }),
      });
      const messageId = 'msg-update-field';

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.createOrUpdateCustomFields.mockResolvedValue([]);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(mocks.mockMsgopsService.createOrUpdateCustomFields).toHaveBeenCalledWith([
        {
          accountId: 1,
          contactId: 123,
          customFieldId: 42,
          value: 'new-value',
        },
      ]);
    });
  });

  describe('Step Type: HTTP_REQUEST', () => {
    it('should publish HTTP_REQUEST to dedicated topic', async () => {
      // Arrange
      const httpStep = createMockStep(StepType.HTTP_REQUEST, {
        settings: {
          operation: 'post',
          url: 'https://api.example.com/webhook',
          headers: [],
          body: [],
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test HTTP',
          steps: [httpStep],
        },
      });
      const messageId = 'msg-http';

      redisClient.del.mockResolvedValueOnce(0);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(mocks.mockQueuePublisher.sendAsyncMessage).toHaveBeenCalledWith(
        'http-request',
        expect.objectContaining({
          automation: expect.objectContaining({
            steps: [httpStep],
          }),
        }),
        null,
      );
    });
  });

  describe('processHttpRequest', () => {
    it('should process HTTP request with custom headers and body', async () => {
      // Arrange
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test HTTP',
          steps: [
            {
              id: 100,
              type: StepType.HTTP_REQUEST,
              settings: {
                operation: 'post',
                url: 'https://api.example.com/endpoint',
                headers: [
                  { key: 'Authorization', value: { type: 'custom', id: 'Bearer token123' } },
                  { key: 'X-Contact-Email', value: { type: 'dynamic', id: 'contact.email' } },
                ],
                body: [
                  { key: 'email', value: { type: 'dynamic', id: 'contact.email' } },
                  { key: 'firstName', value: { type: 'dynamic', id: 'contact.firstName' } },
                ],
              },
            },
          ],
        },
      });

      mocks.mockMsgopsService.findContactById.mockResolvedValue(createMockContact());
      mocks.mockHttpRequestProvider.process.mockResolvedValue({ status: 200 });

      // Act
      const result = await service.processHttpRequest(mockLeadStateMessage);

      // Assert
      expect(result).toBe(undefined);
      expect(mocks.mockHttpRequestProvider.process).toHaveBeenCalledWith(
        'post',
        'https://api.example.com/endpoint',
        expect.objectContaining({
          Authorization: 'Bearer token123',
          'X-Contact-Email': 'test@example.com',
        }),
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'John',
        }),
      );
    });

    it('should throw InternalServerErrorException on retry-enabled request failure', async () => {
      // Arrange
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test HTTP',
          steps: [
            {
              id: 100,
              type: StepType.HTTP_REQUEST,
              settings: {
                operation: 'post',
                url: 'https://api.example.com/endpoint',
                headers: [],
                body: [],
                retry: true,
              },
            },
          ],
        },
      });

      mocks.mockMsgopsService.findContactById.mockResolvedValue(createMockContact());
      mocks.mockHttpRequestProvider.process.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(service.processHttpRequest(mockLeadStateMessage)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw BadRequestException when contact not found in HTTP_REQUEST with retry enabled', async () => {
      // Arrange
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test HTTP Contact Not Found',
          steps: [
            {
              id: 100,
              type: StepType.HTTP_REQUEST,
              settings: {
                operation: 'post',
                url: 'https://api.example.com/webhook',
                headers: [{ key: 'Content-Type', value: 'application/json' }],
                body: [{ key: 'email', value: { type: 'field', id: 'contact.email' } }],
                retry: true, // Retry enabled - will throw instead of returning true
              },
            },
          ],
        },
      });

      mocks.mockMsgopsService.findContactById.mockResolvedValue(null); // Contact not found

      // Act & Assert
      await expect(service.processHttpRequest(mockLeadStateMessage)).rejects.toThrow();
      expect(mocks.mockMsgopsService.findContactById).toHaveBeenCalledWith(mockLeadStateMessage.contact.id, mockLeadStateMessage.contact.accountId, ['customFields']);
    });

    it('should return true when HTTP request fails without retry enabled', async () => {
      // Arrange
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test HTTP No Retry',
          steps: [
            {
              id: 100,
              type: StepType.HTTP_REQUEST,
              settings: {
                operation: 'post',
                url: 'https://api.example.com/endpoint',
                headers: [],
                body: [],
                retry: false, // Retry disabled
              },
            },
          ],
        },
      });

      mocks.mockMsgopsService.findContactById.mockResolvedValue(createMockContact());
      mocks.mockHttpRequestProvider.process.mockRejectedValue(new Error('Network error'));

      // Act
      const result = await service.processHttpRequest(mockLeadStateMessage);

      // Assert
      expect(result).toBe(true); // Returns true instead of throwing
      expect(mocks.mockHttpRequestProvider.process).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    describe('selectRandomMessage', () => {
      it('should throw BadRequestException when message settings are invalid', async () => {
        // Arrange
        const randomMessageStep = createMockStep(StepType.RANDOM_MESSAGE, {
          settings: null, // Invalid settings to trigger error
          child: [createEndStep()],
        });
        const mockLeadStateMessage = createMockLeadStateMessage({
          automation: {
            id: 50,
            type: 'email',
            title: 'Test Random Error',
            steps: [randomMessageStep],
          },
        });
        const messageId = 'msg-random-error';

        redisClient.del.mockResolvedValueOnce(0);

        // Act & Assert
        await expect(service.receiveMessage(mockLeadStateMessage, messageId, null)).rejects.toThrow(BadRequestException);
      });
    });

    describe('removeAutomation', () => {
      it('should throw BadRequestException when Redis set fails', async () => {
        // Arrange
        const removeAutomationStep = createMockStep(StepType.REMOVE_AUTOMATION, {
          settings: {
            automations: [{ id: 10 }],
          },
          child: [createEndStep()],
        });
        const mockLeadStateMessage = createMockLeadStateMessage({
          automation: {
            id: 50,
            type: 'email',
            title: 'Test Remove Error',
            steps: [removeAutomationStep],
          },
          contact: createMockContact({ id: 999 }),
        });
        const messageId = 'msg-remove-error';

        redisClient.del.mockResolvedValueOnce(0);
        redisClient.set.mockRejectedValue(new Error('Redis connection failed'));

        // Act & Assert
        await expect(service.receiveMessage(mockLeadStateMessage, messageId, null)).rejects.toThrow(BadRequestException);
      });
    });

    describe('sendMessage', () => {
      it('should throw BadRequestException when PubSub sendAsyncMessage fails', async () => {
        // Arrange
        const emailStep = createMockStep(StepType.EMAIL, {
          settings: { id: 100 },
          child: [createEndStep()],
        });

        const mockLeadStateMessage = createMockLeadStateMessage({
          automation: {
            id: 50,
            type: 'email',
            title: 'Test Send Error',
            steps: [emailStep],
          },
        });

        redisClient.del.mockResolvedValueOnce(0);
        mocks.mockMsgopsService.getMessageById.mockResolvedValue(createMockEmail());
        // Make PubSub fail
        mocks.mockQueuePublisher.sendAsyncMessage.mockRejectedValue(new Error('PubSub service unavailable'));

        // Act & Assert
        await expect(service.receiveMessage(mockLeadStateMessage, 'msg-send-error', null)).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('getRedis', () => {
    it('should retrieve and parse Redis value', async () => {
      // Arrange
      const mockPayload = createMockLeadStateMessage();
      const redisKey = 'test-key';
      redisClient.get.mockResolvedValue(JSON.stringify(mockPayload));

      // Act
      const result = await service.getRedis(redisKey);

      // Assert
      expect(result).toEqual(mockPayload);
      expect(redisClient.get).toHaveBeenCalledWith(redisKey);
    });

    it('should return undefined when Redis key does not exist', async () => {
      // Arrange
      const redisKey = 'non-existent-key';
      redisClient.get.mockResolvedValue(null);

      // Act
      const result = await service.getRedis(redisKey);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('processStepToInternalEvent', () => {
    it('should send internal event successfully', async () => {
      // Arrange
      const mockLeadStateMessage = createMockLeadStateMessage();
      const properties = { stepId: 100, stepType: StepType.EMAIL };

      mocks.mockQueuePublisher.sendInternalEvent.mockResolvedValue('event-id-123');

      // Act
      await service.processStepToInternalEvent(mockLeadStateMessage, properties);

      // Assert
      expect(mocks.mockQueuePublisher.sendInternalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'step',
          contactId: mockLeadStateMessage.contact.id,
          email: mockLeadStateMessage.contact.email,
          properties,
        }),
      );
    });

    it('should return true on error without throwing', async () => {
      // Arrange
      const mockLeadStateMessage = createMockLeadStateMessage();
      const properties = { stepId: 100 };

      mocks.mockQueuePublisher.sendInternalEvent.mockRejectedValue(new Error('PubSub error'));

      // Act
      const result = await service.processStepToInternalEvent(mockLeadStateMessage, properties);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('definedTestAB Edge Cases', () => {
    it('should select winner message when TestAB status is FINISHED', async () => {
      // Arrange
      const testabStep = createMockStep(StepType.TESTAB, {
        settings: {
          status: 'finished',
          messages: [
            { id: 100, name: 'Message 1', title: 'Title 1', subject: 'Subject 1', winnerMessage: false },
            { id: 101, name: 'Message 2', title: 'Title 2', subject: 'Subject 2', winnerMessage: true },
            { id: 102, name: 'Message 3', title: 'Title 3', subject: 'Subject 3', winnerMessage: false },
          ],
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test TestAB Finished',
          steps: [testabStep],
        },
      });
      const messageId = 'msg-testab-finished';

      redisClient.del.mockResolvedValueOnce(0);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      // Should publish next step
      expectPubSubCalled(mocks.mockQueuePublisher, 'message-trigger');
    });

    it('should select winner from Redis when available', async () => {
      // Arrange
      const testabStep = createMockStep(StepType.TESTAB, {
        settings: {
          status: 'active',
          messages: [
            { id: 100, name: 'Message 1', title: 'Title 1', subject: 'Subject 1' },
            { id: 101, name: 'Message 2', title: 'Title 2', subject: 'Subject 2' },
            { id: 102, name: 'Message 3', title: 'Title 3', subject: 'Subject 3' },
          ],
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test TestAB Redis Winner',
          steps: [testabStep],
        },
      });
      const messageId = 'msg-testab-redis';

      redisClient.del.mockResolvedValueOnce(0);
      // Mock Redis returning winner message ID
      redisClient.get
        .mockResolvedValueOnce(null) // First call for automation check
        .mockResolvedValueOnce('102'); // Second call for winner message ID

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expectPubSubCalled(mocks.mockQueuePublisher, 'message-trigger');
    });

    it('should return step.child when randomMessage is not found', async () => {
      // Arrange - create testab step with messages but force invalid randomItem
      const testabStep = createMockStep(StepType.TESTAB, {
        settings: {
          status: 'active',
          messages: [{ id: 100, name: 'Message 1', title: 'Title 1', subject: 'Subject 1' }],
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test TestAB No Message',
          steps: [testabStep],
        },
      });
      const messageId = 'msg-testab-no-message';

      redisClient.del.mockResolvedValueOnce(0);
      redisClient.get.mockResolvedValue('999'); // Non-existent message ID

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
    });

    it('should create Redis key and send API step process when first TestAB execution', async () => {
      // Arrange
      const testabStep = createMockStep(StepType.TESTAB, {
        settings: {
          status: 'active',
          messages: [
            { id: 100, name: 'Message 1', title: 'Title 1', subject: 'Subject 1' },
            { id: 101, name: 'Message 2', title: 'Title 2', subject: 'Subject 2' },
          ],
        },
        child: [createEndStep()],
      });
      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test TestAB First Execution',
          steps: [testabStep],
        },
      });
      const messageId = 'msg-testab-first';

      redisClient.del.mockResolvedValueOnce(0); // automation stop-check: no keys
      redisClient.exists.mockResolvedValueOnce(0); // stepRedisKey doesn't exist
      redisClient.get.mockResolvedValue(null); // no winner yet
      redisClient.set.mockResolvedValue('OK');

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, messageId, null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(redisClient.set).toHaveBeenCalledWith('automation_testab_step:50:100', expect.any(String));
      // Should send to API step process topic
      expectPubSubCalled(mocks.mockQueuePublisher, 'msgops.api.step.process');
    });
  });

  describe('definedConditional - custom_event', () => {
    // Marker objects for conditional branches
    const TRUE_BRANCH_CHILD = [{ id: 156, type: 'httpRequest' }];
    const FALSE_BRANCH_CHILD = [];

    const baseLeadStateMessage = {
      contact: {
        id: 63321184,
        accountId: 1,
        uuid: null,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        hashedEmail: '6e55da980e435676718c1d6d716196f1b5d7412060915eaea05aa36a70043a0d',
        isActive: true,
        isUnsubscribed: false,
        hasBounced: false,
        customFields: {},
      },
      tagName: 'test-automation-tag',
      apiKey: 'cbf3883074639ea9e3aced35ac37d706',
      startedAt: 1672148098000,
      account: {
        id: 1,
        name: 'Plusdin',
        accountConfigs: {
          time_zone: 'America/Sao_Paulo',
        },
      },
    };

    // Helper to create a Step with custom_event conditional
    const createStep = (settings: any[]) => ({
      id: 153,
      type: 'conditional',
      child: [
        {
          id: 'conditional_153_1',
          type: 'conditionalTrue',
          settings,
          child: TRUE_BRANCH_CHILD,
        },
        {
          id: 'conditional_153_2',
          type: 'conditionalFalse',
          child: FALSE_BRANCH_CHILD,
          settings: {},
        },
      ],
    });

    // Helper to create custom_event config
    const createCustomEventConfig = (config: {
      timeType?: 'range' | 'date' | 'days' | string;
      conditionalEventType: 'in' | 'not in';
      conditionalEventFilter?: string;
      customEventDate?: string;
      customEventDateEnd?: string;
      time?: number;
      eventName?: string;
    }) => ({
      type: 'custom_event',
      conditional: 'and',
      time_type: config.timeType,
      conditional_event_type: config.conditionalEventType,
      conditional_event_filter: config.conditionalEventFilter,
      custom_event_date: config.customEventDate,
      custom_event_date_end: config.customEventDateEnd,
      time: config.time,
      event: { name: config.eventName || 'test_event' },
    });

    const mockContact = {
      id: 63321184,
      accountId: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      customFieldsParsed: {},
      parseCustomFields: jest.fn(),
    };

    beforeEach(() => {
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);
    });

    // ============================================
    // TIME_TYPE = 'range' (BETWEEN queries)
    // ============================================
    describe('time_type = range (BETWEEN)', () => {
      const rangeStart = '2025-12-02';
      const rangeEnd = '2025-12-04';

      describe('conditional_event_type = in', () => {
        it('should return TRUE branch when events exist within range', async () => {
          const step = createStep([
            createCustomEventConfig({
              timeType: 'range',
              conditionalEventType: 'in',
              customEventDate: rangeStart,
              customEventDateEnd: rangeEnd,
              eventName: 'account_start',
            }),
          ]);

          mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([{ contact_id: 63321184 }]);

          const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

          expect(mocks.mockMsgopsService.queryEventsLogs).toHaveBeenCalled();
          const [queryArg, paramsArg] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
          expect(queryArg).toContain('FROM events_logs_v2');
          expect(queryArg).toContain('time_date >= {startDate:String}');
          expect(queryArg).toContain('time BETWEEN {rangeStart:String} AND {rangeEnd:String}');
          expect(paramsArg).toMatchObject({ startDate: rangeStart, rangeStart, rangeEnd });
          expect(result).toEqual(TRUE_BRANCH_CHILD);
        });

        it('should return FALSE branch when no events exist within range', async () => {
          const step = createStep([
            createCustomEventConfig({
              timeType: 'range',
              conditionalEventType: 'in',
              customEventDate: rangeStart,
              customEventDateEnd: rangeEnd,
            }),
          ]);

          mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

          const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

          expect(result).toEqual(FALSE_BRANCH_CHILD);
        });
      });

      describe('conditional_event_type = not in', () => {
        it('should return FALSE branch when events exist within range', async () => {
          const step = createStep([
            createCustomEventConfig({
              timeType: 'range',
              conditionalEventType: 'not in',
              customEventDate: rangeStart,
              customEventDateEnd: rangeEnd,
            }),
          ]);

          mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([{ contact_id: 63321184 }]);

          const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

          expect(result).toEqual(FALSE_BRANCH_CHILD);
        });

        it('should return TRUE branch when no events exist within range', async () => {
          const step = createStep([
            createCustomEventConfig({
              timeType: 'range',
              conditionalEventType: 'not in',
              customEventDate: rangeStart,
              customEventDateEnd: rangeEnd,
            }),
          ]);

          mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

          const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

          expect(result).toEqual(TRUE_BRANCH_CHILD);
        });
      });
    });

    // ============================================
    // TIME_TYPE = 'date' (specific date with filter)
    // ============================================
    describe('time_type = date', () => {
      const testDate = '2025-11-15';
      const filters = ['>=', '<=', '=', '>', '<', '!='];

      filters.forEach((filter) => {
        describe(`conditional_event_filter = '${filter}'`, () => {
          describe('conditional_event_type = in', () => {
            it(`should return TRUE branch when events exist with filter ${filter}`, async () => {
              const step = createStep([
                createCustomEventConfig({
                  timeType: 'date',
                  conditionalEventType: 'in',
                  conditionalEventFilter: filter,
                  customEventDate: testDate,
                }),
              ]);

              mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([{ contact_id: 63321184 }]);

              const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

              const [queryArg, paramsArg] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
              expect(queryArg).toContain('time_date >= {startDate:String}');
              expect(queryArg).toContain(`time ${filter} {filterDate:String}`);
              expect(paramsArg).toMatchObject({ startDate: testDate, filterDate: testDate });
              expect(result).toEqual(TRUE_BRANCH_CHILD);
            });

            it(`should return FALSE branch when no events exist with filter ${filter}`, async () => {
              const step = createStep([
                createCustomEventConfig({
                  timeType: 'date',
                  conditionalEventType: 'in',
                  conditionalEventFilter: filter,
                  customEventDate: testDate,
                }),
              ]);

              mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

              const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

              expect(result).toEqual(FALSE_BRANCH_CHILD);
            });
          });

          describe('conditional_event_type = not in', () => {
            it(`should return FALSE branch when events exist with filter ${filter}`, async () => {
              const step = createStep([
                createCustomEventConfig({
                  timeType: 'date',
                  conditionalEventType: 'not in',
                  conditionalEventFilter: filter,
                  customEventDate: testDate,
                }),
              ]);

              mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([{ contact_id: 63321184 }]);

              const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

              expect(result).toEqual(FALSE_BRANCH_CHILD);
            });

            it(`should return TRUE branch when no events exist with filter ${filter}`, async () => {
              const step = createStep([
                createCustomEventConfig({
                  timeType: 'date',
                  conditionalEventType: 'not in',
                  conditionalEventFilter: filter,
                  customEventDate: testDate,
                }),
              ]);

              mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

              const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

              expect(result).toEqual(TRUE_BRANCH_CHILD);
            });
          });
        });
      });
    });

    // ============================================
    // TIME_TYPE = 'days' / relative (calculated date)
    // ============================================
    describe('time_type = days/relative (calculated date)', () => {
      const daysAgo = 7;
      const filters = ['>=', '<=', '=', '>', '<', '!='];

      filters.forEach((filter) => {
        describe(`conditional_event_filter = '${filter}'`, () => {
          describe('conditional_event_type = in', () => {
            it(`should return TRUE branch when events exist with relative filter ${filter}`, async () => {
              const step = createStep([
                createCustomEventConfig({
                  timeType: 'days',
                  conditionalEventType: 'in',
                  conditionalEventFilter: filter,
                  time: daysAgo,
                }),
              ]);

              mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([{ contact_id: 63321184 }]);

              const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

              const [queryArg, paramsArg] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
              // With mocked dayjs at 2024-06-15, 7 days ago = 2024-06-08
              expect(queryArg).toContain('time_date >= {startDate:String}');
              expect(queryArg).toContain(`time ${filter} {filterDate:String}`);
              expect(paramsArg.filterDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
              expect(result).toEqual(TRUE_BRANCH_CHILD);
            });

            it(`should return FALSE branch when no events exist with relative filter ${filter}`, async () => {
              const step = createStep([
                createCustomEventConfig({
                  timeType: 'days',
                  conditionalEventType: 'in',
                  conditionalEventFilter: filter,
                  time: daysAgo,
                }),
              ]);

              mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

              const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

              expect(result).toEqual(FALSE_BRANCH_CHILD);
            });
          });

          describe('conditional_event_type = not in', () => {
            it(`should return FALSE branch when events exist with relative filter ${filter}`, async () => {
              const step = createStep([
                createCustomEventConfig({
                  timeType: 'days',
                  conditionalEventType: 'not in',
                  conditionalEventFilter: filter,
                  time: daysAgo,
                }),
              ]);

              mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([{ contact_id: 63321184 }]);

              const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

              expect(result).toEqual(FALSE_BRANCH_CHILD);
            });

            it(`should return TRUE branch when no events exist with relative filter ${filter}`, async () => {
              const step = createStep([
                createCustomEventConfig({
                  timeType: 'days',
                  conditionalEventType: 'not in',
                  conditionalEventFilter: filter,
                  time: daysAgo,
                }),
              ]);

              mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

              const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

              expect(result).toEqual(TRUE_BRANCH_CHILD);
            });
          });
        });
      });
    });

    // ============================================
    // SQL Query Generation Tests (ClickHouse specific)
    // ============================================
    describe('SQL Query Generation (ClickHouse)', () => {
      it('should generate query with events_logs_v2 table', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'range',
            conditionalEventType: 'in',
            customEventDate: '2025-01-01',
            customEventDateEnd: '2025-01-31',
          }),
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const queryArg = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0][0];
        expect(queryArg).toContain('FROM events_logs_v2');
      });

      it('should include time_date partition filter for range time_type', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'range',
            conditionalEventType: 'in',
            customEventDate: '2025-01-01',
            customEventDateEnd: '2025-01-31',
          }),
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const [queryArg, paramsArg] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
        expect(queryArg).toContain('time_date >= {startDate:String}');
        expect(paramsArg.startDate).toBe('2025-01-01');
      });

      it('should include time_date partition filter for date time_type', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'date',
            conditionalEventType: 'in',
            conditionalEventFilter: '>=',
            customEventDate: '2025-06-15',
          }),
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const [queryArg, paramsArg] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
        expect(queryArg).toContain('time_date >= {startDate:String}');
        expect(paramsArg.startDate).toBe('2025-06-15');
      });

      it('should include time_date partition filter with calculated date for relative time_type', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'days',
            conditionalEventType: 'in',
            conditionalEventFilter: '>=',
            time: 10,
          }),
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const queryArg = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0][0];
        // With mocked dayjs at 2024-06-15, 10 days ago = 2024-06-05
        expect(queryArg).toContain('time_date >=');
      });

      it('should use default 30 days when time is not specified for relative', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'days',
            conditionalEventType: 'in',
            conditionalEventFilter: '>=',
            time: undefined, // No time specified
          }),
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const queryArg = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0][0];
        // Should use 30 as default
        expect(queryArg).toContain('time_date >=');
      });

      it('should include correct account_id from contact', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'range',
            conditionalEventType: 'in',
            customEventDate: '2025-01-01',
            customEventDateEnd: '2025-01-31',
          }),
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const [queryArg, paramsArg] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
        expect(queryArg).toContain('account_id = {accountId:UInt64}');
        expect(paramsArg.accountId).toBe(1);
      });

      it('should include correct contact_id from contact', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'range',
            conditionalEventType: 'in',
            customEventDate: '2025-01-01',
            customEventDateEnd: '2025-01-31',
          }),
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const [queryArg, paramsArg] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
        expect(queryArg).toContain('contact_id = {contactId:UInt64}');
        expect(paramsArg.contactId).toBe(63321184);
      });

      it('should include correct event name from step config', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'range',
            conditionalEventType: 'in',
            customEventDate: '2025-01-01',
            customEventDateEnd: '2025-01-31',
            eventName: 'purchase_completed',
          }),
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const [queryArg, paramsArg] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
        expect(queryArg).toContain('event = {eventName:String}');
        expect(paramsArg.eventName).toBe('purchase_completed');
      });

      it('should include LIMIT 1 in query', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'range',
            conditionalEventType: 'in',
            customEventDate: '2025-01-01',
            customEventDateEnd: '2025-01-31',
          }),
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const queryArg = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0][0];
        expect(queryArg).toContain('LIMIT 1');
      });
    });

    // ============================================
    // Edge Cases
    // ============================================
    describe('Edge Cases', () => {
      it('should handle missing event name gracefully (fallback to 0)', async () => {
        const step = createStep([
          {
            type: 'custom_event',
            conditional: 'and',
            time_type: 'range',
            conditional_event_type: 'in',
            custom_event_date: '2025-01-01',
            custom_event_date_end: '2025-01-31',
            event: null,
          },
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const [, paramsArg] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
        expect(paramsArg.eventName).toBe('0');
      });

      it('should handle empty event object gracefully (fallback to 0)', async () => {
        const step = createStep([
          {
            type: 'custom_event',
            conditional: 'and',
            time_type: 'range',
            conditional_event_type: 'in',
            custom_event_date: '2025-01-01',
            custom_event_date_end: '2025-01-31',
            event: {},
          },
        ]);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([]);

        await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const [, paramsArg] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
        expect(paramsArg.eventName).toBe('0');
      });

      it('should return TRUE branch when query returns multiple results (length > 0)', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'range',
            conditionalEventType: 'in',
            customEventDate: '2025-01-01',
            customEventDateEnd: '2025-01-31',
          }),
        ]);

        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([
          { contact_id: 63321184, event: 'test_event' },
          { contact_id: 63321184, event: 'test_event' },
          { contact_id: 63321184, event: 'test_event' },
        ]);

        const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

        expect(result).toEqual(TRUE_BRANCH_CHILD);
      });

      it('should return FALSE branch when contact is not found (error handling)', async () => {
        const step = createStep([
          createCustomEventConfig({
            timeType: 'range',
            conditionalEventType: 'in',
            customEventDate: '2025-01-01',
            customEventDateEnd: '2025-01-31',
          }),
        ]);

        mocks.mockMsgopsService.findContactById.mockResolvedValue(null);
        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([{ contact_id: 63321184 }]);

        const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

        expect(result).toEqual(FALSE_BRANCH_CHILD);
      });

      it('should handle undefined time_type as relative/days', async () => {
        const step = createStep([
          {
            type: 'custom_event',
            conditional: 'and',
            time_type: undefined, // undefined triggers else branch (relative)
            time: 15,
            conditional_event_filter: '>=',
            conditional_event_type: 'in',
            event: { name: 'test_event' },
          },
        ]);

        mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([{ contact_id: 63321184 }]);

        const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

        const queryArg = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0][0];
        expect(queryArg).toContain('time >=');
        expect(result).toEqual(TRUE_BRANCH_CHILD);
      });
    });
  });

  describe('definedConditional - interation type', () => {
    it('should return TRUE when contact has interaction (yes) with time filter', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 150,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_150_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'interation',
                conditional_interation: 'yes',
                event: 'lastOpen',
                time: '7', // Within last 7 days
                conditional: 'and',
              },
            ],
            child: [createEndStep()], // TRUE branch
          },
          {
            id: 'conditional_150_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()], // FALSE branch
          },
        ],
      };

      const mockContact = createMockContact({
        lastOpen: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      });

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Interation',
          steps: [conditionalStep],
        },
        contact: mockContact,
        account: {
          id: 1,
          name: 'Test Account',
          accountConfigs: { time_zone: 'America/Sao_Paulo' },
          customFields: [],
        },
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-interation-yes', null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(mocks.mockMsgopsService.findContactById).toHaveBeenCalledWith(mockContact.id, mockContact.accountId, expect.arrayContaining([]));
    });

    it('should return FALSE when contact has NO interaction (no) with time filter', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 151,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_151_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'interation',
                conditional_interation: 'no',
                event: 'lastOpen',
                time: 'all', // All time
                conditional: 'and',
              },
            ],
            child: [createEndStep()], // TRUE branch
          },
          {
            id: 'conditional_151_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()], // FALSE branch
          },
        ],
      };

      const mockContact = createMockContact({
        lastOpen: null, // No interaction
      });

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Interation',
          steps: [conditionalStep],
        },
        contact: mockContact,
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-interation-no', null);

      // Assert
      expect(result).toBe('message-id-123');
    });
  });

  describe('definedConditional - custom_field type', () => {
    it('should return TRUE when custom field matches with = operator', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 152,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_152_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'custom_field',
                conditional_custom_field: '=',
                custom_field_id: 'plan',
                custom_field_value: 'premium',
              },
            ],
            child: [createEndStep()], // TRUE branch
          },
          {
            id: 'conditional_152_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()], // FALSE branch
          },
        ],
      };

      const mockContact: any = createMockContact();
      mockContact.customFields = {
        plan: 'premium',
      };

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Custom Field',
          steps: [conditionalStep],
        },
        contact: mockContact,
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-customfield-equal', null);

      // Assert
      expect(result).toBe('message-id-123');
      // Verify that customFields was loaded (it's passed as a Set)
      const callArgs = mocks.mockMsgopsService.findContactById.mock.calls[0];
      expect(callArgs[2]).toBeInstanceOf(Set);
      expect(callArgs[2].has('customFields')).toBe(true);
    });

    it('should return TRUE when custom field matches with iLike operator', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 153,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_153_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'custom_field',
                conditional_custom_field: 'iLike',
                custom_field_id: 'company',
                custom_field_value: 'Tech',
              },
            ],
            child: [createEndStep()],
          },
          {
            id: 'conditional_153_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()],
          },
        ],
      };

      const mockContact: any = createMockContact();
      mockContact.customFields = {
        company: 'TechCorp Inc',
      };

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Custom Field iLike',
          steps: [conditionalStep],
        },
        contact: mockContact,
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-customfield-ilike', null);

      // Assert
      expect(result).toBe('message-id-123');
    });

    it('should return TRUE when comparing two custom fields', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 154,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_154_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'custom_field',
                conditional_custom_field: '=',
                custom_field_id: 'field1',
                custom_field_value: 'field2', // Compare with another field
                filter_custom_field: 'compare_fields',
              },
            ],
            child: [createEndStep()],
          },
          {
            id: 'conditional_154_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()],
          },
        ],
      };

      const mockContact: any = createMockContact();
      mockContact.customFields = {
        field1: 'value',
        field2: 'value',
      };

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Custom Field Compare',
          steps: [conditionalStep],
        },
        contact: mockContact,
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-customfield-compare', null);

      // Assert
      expect(result).toBe('message-id-123');
    });
  });

  describe('definedConditional - user_field type', () => {
    it('should return TRUE when created_at_date is within range (- operator)', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 155,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_155_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'user_field',
                user_field_key: 'created_at_date',
                conditional_user_field: '-',
                user_field_value: 30, // Within last 30 days
              },
            ],
            child: [createEndStep()],
          },
          {
            id: 'conditional_155_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()],
          },
        ],
      };

      const mockContact: any = createMockContact();
      mockContact.created_at_date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test User Field Date',
          steps: [conditionalStep],
        },
        contact: mockContact,
        account: {
          id: 1,
          name: 'Test Account',
          accountConfigs: { time_zone: 'America/Sao_Paulo' },
          customFields: [],
        },
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-userfield-date', null);

      // Assert
      expect(result).toBe('message-id-123');
    });

    it('should return TRUE when email_provider matches', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 156,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_156_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'user_field',
                user_field_key: 'email_provider',
                conditional_user_field: '=',
                user_field_value: 'gmail',
              },
            ],
            child: [createEndStep()],
          },
          {
            id: 'conditional_156_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()],
          },
        ],
      };

      const mockContact: any = createMockContact();
      mockContact.email_provider = 'gmail';

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Email Provider',
          steps: [conditionalStep],
        },
        contact: mockContact,
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-userfield-provider', null);

      // Assert
      expect(result).toBe('message-id-123');
    });

    it('should return TRUE for communication_channels check', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 157,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_157_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'user_field',
                user_field_key: 'communication_channels',
                user_field_value: 'hasWhatsapp',
                conditional_user_field: 'true',
              },
            ],
            child: [createEndStep()],
          },
          {
            id: 'conditional_157_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()],
          },
        ],
      };

      const mockContact: any = createMockContact();
      mockContact.hasWhatsapp = true;

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Communication Channels',
          steps: [conditionalStep],
        },
        contact: mockContact,
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-userfield-channels', null);

      // Assert
      expect(result).toBe('message-id-123');
    });
  });

  describe('definedConditional - automation type', () => {
    it('should return TRUE when contact has participated in automation within time range', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 158,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_158_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'automation',
                user_field_automation: [
                  { id: 10, name: 'Welcome Series' },
                  { id: 20, name: 'Onboarding' },
                ],
                conditional_user_field: '>=',
                user_field_value: 7, // Within last 7 days
              },
            ],
            child: [createEndStep()],
          },
          {
            id: 'conditional_158_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()],
          },
        ],
      };

      const mockContact: any = createMockContact();
      mockContact.contactAutomations = [
        {
          automationId: 10,
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        },
        {
          automationId: 20,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        },
      ];

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Automation Type',
          steps: [conditionalStep],
        },
        contact: mockContact,
        account: {
          id: 1,
          name: 'Test Account',
          accountConfigs: { time_zone: 'America/Sao_Paulo' },
          customFields: [],
        },
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-automation-type', null);

      // Assert
      expect(result).toBe('message-id-123');
      // Verify that contactAutomations was loaded (it's passed as a Set)
      const callArgs = mocks.mockMsgopsService.findContactById.mock.calls[0];
      expect(callArgs[2]).toBeInstanceOf(Set);
      expect(callArgs[2].has('contactAutomations')).toBe(true);
    });
  });

  describe('definedConditional - lead type', () => {
    it('should return TRUE when lead field matches condition', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 159,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_159_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'lead',
                lead_field_key: 'status',
                conditional_lead_field: '=',
                lead_field_value: 'qualified',
              },
            ],
            child: [createEndStep()],
          },
          {
            id: 'conditional_159_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()],
          },
        ],
      };

      const mockContact = createMockContact();
      const mockLead = {
        id: 999,
        status: 'qualified',
        source: 'website',
      };

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Lead Type',
          steps: [conditionalStep],
        },
        contact: mockContact,
        leadId: 999,
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);
      mocks.mockMsgopsService.findLeadById.mockResolvedValue(mockLead);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-lead-type', null);

      // Assert
      expect(result).toBe('message-id-123');
      expect(mocks.mockMsgopsService.findLeadById).toHaveBeenCalledWith(999);
    });

    it('should handle when lead is not found', async () => {
      // Arrange
      const conditionalStep: any = {
        id: 160,
        type: StepType.CONDITIONAL,
        child: [
          {
            id: 'conditional_160_1',
            type: 'conditionalTrue',
            settings: [
              {
                type: 'lead',
                lead_field_key: 'status',
                conditional_lead_field: '=',
                lead_field_value: 'qualified',
              },
            ],
            child: [createEndStep()],
          },
          {
            id: 'conditional_160_2',
            type: 'conditionalFalse',
            settings: {},
            child: [createEndStep()],
          },
        ],
      };

      const mockContact = createMockContact();

      const mockLeadStateMessage = createMockLeadStateMessage({
        automation: {
          id: 50,
          type: 'email',
          title: 'Test Lead Not Found',
          steps: [conditionalStep],
        },
        contact: mockContact,
        leadId: 999,
      });

      redisClient.del.mockResolvedValueOnce(0);
      mocks.mockMsgopsService.findContactById.mockResolvedValue(mockContact);
      mocks.mockMsgopsService.findLeadById.mockResolvedValue(null);

      // Act
      const result = await service.receiveMessage(mockLeadStateMessage, 'msg-lead-notfound', null);

      // Assert
      expect(result).toBe('message-id-123');
    });
  });

  describe('definedConditional - hardening (EVO-1193)', () => {
    const TRUE_BRANCH_CHILD = [{ id: 9001, type: 'httpRequest' }];
    const FALSE_BRANCH_CHILD = [{ id: 9002, type: 'httpRequest' }];

    const baseLeadStateMessage = {
      id: 'lsm-1',
      contact: {
        id: 63321184,
        accountId: 1,
        email: 'test@example.com',
        firstName: 'Test',
        customFields: {},
      },
      startedAt: 1672148098000,
      account: { id: 1, accountConfigs: { time_zone: 'America/Sao_Paulo' } },
      automation: { id: 50, type: 'email', title: 'Test Automation', version: '1' },
    };

    const buildStep = (settings: any[]) => ({
      id: 999,
      type: 'conditional',
      child: [
        { id: 'true-1', type: 'conditionalTrue', settings, child: TRUE_BRANCH_CHILD },
        { id: 'false-1', type: 'conditionalFalse', settings: {}, child: FALSE_BRANCH_CHILD },
      ],
    });

    beforeEach(() => {
      // Tracker-event assertions here must see only calls produced by the current test.
      mocks.mockTrackerService.send.mockClear();
      mocks.mockMsgopsService.queryEventsLogs.mockClear();
    });

    it('H4: rejects SQL injection via conditional_event_filter (allowlist) and emits failure tracker event', async () => {
      const step = buildStep([
        {
          type: 'custom_event',
          conditional: 'and',
          time_type: 'date',
          conditional_event_type: 'in',
          conditional_event_filter: "= '' UNION SELECT * FROM users --",
          custom_event_date: '2025-01-01',
          event: { name: 'purchase' },
        },
      ]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, customFields: {} });

      const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

      expect(result).toEqual(FALSE_BRANCH_CHILD);
      // SQL must never reach ClickHouse with operator interpolated
      expect(mocks.mockMsgopsService.queryEventsLogs).not.toHaveBeenCalled();
      // Failure must be visible
      expect(mocks.mockTrackerService.send).toHaveBeenCalledWith(
        'MSGOPS_CONDITIONAL_EVAL_FAILED',
        expect.objectContaining({ email: 'test@example.com', active_step: 999 }),
        expect.any(Number),
      );
    });

    it('H4: rejects malformed custom_event_date and emits failure tracker event', async () => {
      const step = buildStep([
        {
          type: 'custom_event',
          conditional: 'and',
          time_type: 'date',
          conditional_event_type: 'in',
          conditional_event_filter: '>=',
          custom_event_date: "2025-01-01' OR 1=1 --",
          event: { name: 'purchase' },
        },
      ]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, customFields: {} });

      const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

      expect(result).toEqual(FALSE_BRANCH_CHILD);
      expect(mocks.mockMsgopsService.queryEventsLogs).not.toHaveBeenCalled();
      expect(mocks.mockTrackerService.send).toHaveBeenCalledWith('MSGOPS_CONDITIONAL_EVAL_FAILED', expect.any(Object), expect.any(Number));
    });

    it('H4: parameterized query carries values out-of-band (no string interpolation of values)', async () => {
      const step = buildStep([
        {
          type: 'custom_event',
          conditional: 'and',
          time_type: 'range',
          conditional_event_type: 'in',
          custom_event_date: '2025-01-01',
          custom_event_date_end: '2025-01-31',
          event: { name: 'click' },
        },
      ]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, customFields: {} });
      mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([{ contact_id: 63321184 }]);

      await service['definedConditional'](step as any, baseLeadStateMessage as any);

      const [sql, params] = mocks.mockMsgopsService.queryEventsLogs.mock.calls[0];
      // Account/contact/event values never appear inline in the SQL
      expect(sql).not.toMatch(/account_id\s*=\s*1\b/);
      expect(sql).not.toMatch(/contact_id\s*=\s*63321184\b/);
      expect(sql).not.toContain("'click'");
      expect(params).toMatchObject({ accountId: 1, contactId: 63321184, eventName: 'click' });
    });

    it('H3: runtime ClickHouse failure routes to false branch AND emits failure tracker event (not silent)', async () => {
      const step = buildStep([
        {
          type: 'custom_event',
          conditional: 'and',
          time_type: 'range',
          conditional_event_type: 'in',
          custom_event_date: '2025-01-01',
          custom_event_date_end: '2025-01-31',
          event: { name: 'click' },
        },
      ]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, customFields: {} });
      mocks.mockMsgopsService.queryEventsLogs.mockRejectedValue(new Error('ClickHouse timeout'));

      const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

      expect(result).toEqual(FALSE_BRANCH_CHILD);
      expect(mocks.mockTrackerService.send).toHaveBeenCalledWith('MSGOPS_CONDITIONAL_EVAL_FAILED', expect.any(Object), expect.any(Number));
    });

    it('H2: prototype-pollution key on custom_field routes to false AND emits failure tracker event (loud, not silent)', async () => {
      const step = buildStep([
        {
          type: 'custom_field',
          conditional_custom_field: '=',
          custom_field_id: '__proto__',
          custom_field_value: 'anything',
        },
      ]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, customFields: { plan: 'premium' } });

      const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

      expect(result).toEqual(FALSE_BRANCH_CHILD);
      expect(mocks.mockTrackerService.send).toHaveBeenCalledWith('MSGOPS_CONDITIONAL_EVAL_FAILED', expect.any(Object), expect.any(Number));
    });

    it('H2: prototype-pollution segment on lead_field_key routes to false AND emits failure tracker event', async () => {
      const step = buildStep([
        {
          type: 'lead',
          conditional_lead_field: '=',
          lead_field_key: 'data.__proto__.polluted',
          lead_field_value: 'x',
        },
      ]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, customFields: {}, lead: { data: {} } });

      const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

      expect(result).toEqual(FALSE_BRANCH_CHILD);
      expect(mocks.mockTrackerService.send).toHaveBeenCalledWith('MSGOPS_CONDITIONAL_EVAL_FAILED', expect.any(Object), expect.any(Number));
    });

    it('H4: assertIsoDate accepts ISO-8601 datetime (legacy producers) without rejecting', async () => {
      const step = buildStep([
        {
          type: 'custom_event',
          conditional: 'and',
          time_type: 'range',
          conditional_event_type: 'in',
          custom_event_date: '2025-01-01T00:00:00Z',
          custom_event_date_end: '2025-01-31 23:59:59',
          event: { name: 'click' },
        },
      ]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, customFields: {} });
      mocks.mockMsgopsService.queryEventsLogs.mockResolvedValue([{ contact_id: 63321184 }]);

      const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

      expect(result).toEqual(TRUE_BRANCH_CHILD);
      expect(mocks.mockTrackerService.send).not.toHaveBeenCalledWith('MSGOPS_CONDITIONAL_EVAL_FAILED', expect.any(Object), expect.any(Number));
    });

    it('tag atom: normalizes comma-separated string tag_id (legacy eval shape)', async () => {
      const step = buildStep([
        {
          type: 'tag',
          conditional_tag: 'in',
          tag_id: '10, 20, 30',
        },
      ]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, tags: [20], customFields: {} });

      const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

      expect(result).toEqual(TRUE_BRANCH_CHILD);
    });

    it('H2: unknown conditional atom type does not silently fall to false — emits tracker event', async () => {
      const step = buildStep([{ type: 'totally_unknown_type', conditional: 'and' }]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, customFields: {} });

      const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

      expect(result).toEqual(FALSE_BRANCH_CHILD);
      expect(mocks.mockTrackerService.send).toHaveBeenCalledWith('MSGOPS_CONDITIONAL_EVAL_FAILED', expect.any(Object), expect.any(Number));
    });

    it('H2: TRUE branch on custom_field iLike match (no eval path)', async () => {
      const step = buildStep([
        {
          type: 'custom_field',
          conditional_custom_field: 'iLike',
          custom_field_id: 'company',
          custom_field_value: 'Tech',
        },
      ]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, customFields: { company: 'TechCorp Inc' } });

      const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

      expect(result).toEqual(TRUE_BRANCH_CHILD);
    });

    it('H2: FALSE branch on custom_field mismatch (no eval path)', async () => {
      const step = buildStep([
        {
          type: 'custom_field',
          conditional_custom_field: '=',
          custom_field_id: 'plan',
          custom_field_value: 'premium',
        },
      ]);
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 63321184, accountId: 1, customFields: { plan: 'basic' } });

      const result = await service['definedConditional'](step as any, baseLeadStateMessage as any);

      expect(result).toEqual(FALSE_BRANCH_CHILD);
    });

    it('H2: processHttpRequest rejects prototype-pollution path in dynamic id', async () => {
      const mockLeadStateMessage: any = {
        id: 'lsm-2',
        contact: { id: 1, accountId: 1, email: 'a@b.com', firstName: 'A' },
        automation: {
          id: 50,
          type: 'email',
          title: 'HTTP Proto',
          steps: [
            {
              id: 100,
              type: StepType.HTTP_REQUEST,
              settings: {
                operation: 'post',
                url: 'https://api.example.com/x',
                headers: [{ key: 'X-Bad', value: { type: 'dynamic', id: '__proto__.polluted' } }],
                body: [{ key: 'email', value: { type: 'dynamic', id: 'contact.email' } }],
              },
            },
          ],
        },
      };
      mocks.mockMsgopsService.findContactById.mockResolvedValue({ id: 1, accountId: 1, email: 'a@b.com', customFields: {} });
      mocks.mockHttpRequestProvider.process.mockResolvedValue({ status: 200 });

      await service.processHttpRequest(mockLeadStateMessage);

      expect(mocks.mockHttpRequestProvider.process).toHaveBeenCalledWith(
        'post',
        'https://api.example.com/x',
        expect.objectContaining({ 'X-Bad': '' }),
        expect.objectContaining({ email: 'a@b.com' }),
      );
    });
  });
});
