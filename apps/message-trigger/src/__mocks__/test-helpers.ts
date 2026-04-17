import { ModuleMetadata } from '@nestjs/common';
import { RedisService } from '../providers/redis/redis.service';
import { ActiveStepsHandler } from '../handlers/activesteps.handler';
import { GoogleTasksService } from '../google-tasks.service';
import { ConditionStep } from '../steps/condition.step';
import { PubSubProvider } from '../providers/pubsub.provider';
import { TrackerService } from '../tracker/tracker.service';
import { MsgopsService } from '../msgops/msgops.service';
import { EmailValidationProvider } from '../providers/emailValidation.provider';
import { HttpRequestProvider } from '../providers/httpRequest.provider';
import { ActiveCampaignProvider } from '../providers/activeCampaign.provider';
import { createMockNext, createMockEmail, createMockContact } from './test-fixtures';

/**
 * Creates all mock dependencies for AppService tests
 */
export const createAppServiceMocks = () => {
  // Mock Redis client
  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
  };

  // Mock RedisService
  const mockRedisService = {
    getOrThrow: jest.fn().mockReturnValue(mockRedisClient),
  };

  // Mock ActiveStepsHandler
  const mockActiveStepsHandler = {
    createNextLeadStateMessage: jest.fn().mockReturnValue(createMockNext()),
  };

  // Mock GoogleTasksService
  const mockGoogleTasksService = {
    post: jest.fn().mockResolvedValue([
      {
        name: 'projects/test/locations/us-east1/queues/test/tasks/task-123',
        scheduleTime: { seconds: 1234567890 },
      },
    ]),
  };

  // Mock ConditionStep
  const mockConditionStep = {
    processConditionalTime: jest.fn().mockResolvedValue('task-id-123'),
  };

  // Mock PubSubProvider
  const mockPubSubProvider = {
    sendAsyncMessage: jest.fn().mockResolvedValue('message-id-123'),
    sendMessageInternalEvent: jest.fn().mockResolvedValue('event-id-123'),
  };

  // Mock TrackerService
  const mockTrackerService = {
    send: jest.fn(),
    log: jest.fn(),
    logInfo: jest.fn(),
    logDebug: jest.fn(),
    logError: jest.fn(),
    sendInfo: jest.fn(),
    sendDebug: jest.fn(),
  };

  // Mock MsgopsService
  const mockMsgopsService = {
    findContactById: jest.fn().mockResolvedValue(createMockContact()),
    getMessageById: jest.fn().mockResolvedValue(createMockEmail()),
    updateContact: jest.fn().mockResolvedValue(createMockContact()),
    createOrUpdateCustomFields: jest.fn().mockResolvedValue([]),
    findLeadById: jest.fn().mockResolvedValue({ id: 1, data: {} }),
    queryRunner: jest.fn().mockResolvedValue([]),
    queryEventsLogs: jest.fn().mockResolvedValue([]),
  };

  // Mock EmailValidationProvider
  const mockEmailValidationProvider = {
    emailChecker: jest.fn().mockResolvedValue({ result: 'deliverable' }),
  };

  // Mock HttpRequestProvider
  const mockHttpRequestProvider = {
    process: jest.fn().mockResolvedValue({ status: 200, data: {} }),
  };

  // Mock ActiveCampaignProvider
  const mockActiveCampaignProvider = {
    createContact: jest.fn().mockResolvedValue({ id: 123 }),
  };

  return {
    mockRedisClient,
    mockRedisService,
    mockActiveStepsHandler,
    mockGoogleTasksService,
    mockConditionStep,
    mockPubSubProvider,
    mockTrackerService,
    mockMsgopsService,
    mockEmailValidationProvider,
    mockHttpRequestProvider,
    mockActiveCampaignProvider,
  };
};

/**
 * Creates the module metadata for AppService tests
 */
export const createAppServiceTestingModule = (mocks: ReturnType<typeof createAppServiceMocks>): ModuleMetadata => ({
  providers: [
    { provide: RedisService, useValue: mocks.mockRedisService },
    { provide: ActiveStepsHandler, useValue: mocks.mockActiveStepsHandler },
    { provide: GoogleTasksService, useValue: mocks.mockGoogleTasksService },
    { provide: ConditionStep, useValue: mocks.mockConditionStep },
    { provide: PubSubProvider, useValue: mocks.mockPubSubProvider },
    { provide: TrackerService, useValue: mocks.mockTrackerService },
    { provide: MsgopsService, useValue: mocks.mockMsgopsService },
    { provide: EmailValidationProvider, useValue: mocks.mockEmailValidationProvider },
    { provide: HttpRequestProvider, useValue: mocks.mockHttpRequestProvider },
    { provide: ActiveCampaignProvider, useValue: mocks.mockActiveCampaignProvider },
  ],
});

/**
 * Helper to reset all mocks
 */
export const resetAllMocks = (mocks: ReturnType<typeof createAppServiceMocks>) => {
  Object.values(mocks).forEach((mock) => {
    if (mock && typeof mock === 'object') {
      Object.values(mock).forEach((fn) => {
        if (jest.isMockFunction(fn)) {
          fn.mockClear();
        }
      });
    }
  });
};

/**
 * Helper to setup environment variables for tests
 */
export const setupTestEnvironment = () => {
  process.env.TOPIC_NAME_MESSAGE_TRIGGER = 'msgops.message.trigger';
  process.env.TOPIC_NAME_SEND_EMAIL = 'msgops.send.email';
  process.env.TOPIC_NAME_SEND_PUSH = 'msgops.send.push';
  process.env.TOPIC_NAME_SEND_TWILIO = 'msgops.send.twilio';
  process.env.TOPIC_NAME_SEND_WHATSAPP = 'msgops.send.whatsapp';
  process.env.TOPIC_NAME_TAG_PROCESS = 'msgops.tag.process';
  process.env.TOPIC_NAME_HTTP_REQUEST = 'msgops.http.request';
  process.env.TOPIC_NAME_API_STEP_PROCESS = 'msgops.api.step.process';
  process.env.CONTACT_TRANSFER_URL = 'https://test.com/contact-transfer';
};

/**
 * Helper to create assertions for common tracker calls
 */
export const expectTrackerSendCalled = (mockTrackerService: any, event: string, paramsMatch: Record<string, any>) => {
  expect(mockTrackerService.send).toHaveBeenCalledWith(event, expect.objectContaining(paramsMatch), expect.any(Number));
};

/**
 * Helper to create assertions for PubSub calls
 */
export const expectPubSubCalled = (mockPubSubProvider: any, topic: string, messageMatch?: Record<string, any>) => {
  const calls = mockPubSubProvider.sendAsyncMessage.mock.calls;
  const matchingCall = calls.find((call: any[]) => call[0] === topic);

  expect(matchingCall).toBeDefined();
  if (messageMatch && matchingCall) {
    expect(matchingCall[1]).toMatchObject(messageMatch);
  }
};
