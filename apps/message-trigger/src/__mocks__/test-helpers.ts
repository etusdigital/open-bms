import { ModuleMetadata } from '@nestjs/common';
import { RedisService } from '../providers/redis/redis.service';
import { ActiveStepsHandler } from '../handlers/activesteps.handler';
import { QueuePublisher } from '../providers/queue/queue.publisher';
import { ConditionStep } from '../steps/condition.step';
import { TrackerService } from '../tracker/tracker.service';
import { MsgopsService } from '../msgops/msgops.service';
import { HttpRequestProvider } from '../providers/httpRequest.provider';
import { createMockNext, createMockEmail, createMockContact } from './test-fixtures';

/**
 * Creates all mock dependencies for AppService tests
 */
export const createAppServiceMocks = () => {
  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    // `exists` defaults to a resolved 0 because receiveMessage calls it three
    // times for stop-flag detection. Tests that need a flag to be set
    // override per-call with mockResolvedValueOnce(1).
    exists: jest.fn().mockResolvedValue(0),
  };

  const mockRedisService = {
    getOrThrow: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockActiveStepsHandler = {
    createNextLeadStateMessage: jest.fn().mockReturnValue(createMockNext()),
  };

  const mockQueuePublisher = {
    sendAsyncMessage: jest.fn().mockResolvedValue('message-id-123'),
    sendInternalEvent: jest.fn().mockResolvedValue(undefined),
    scheduleDelayedStep: jest.fn().mockResolvedValue({ id: 'task-123' }),
  };

  const mockConditionStep = {
    processConditionalTime: jest.fn().mockResolvedValue('job-id-123'),
  };

  const mockTrackerService = {
    send: jest.fn(),
    log: jest.fn(),
    logInfo: jest.fn(),
    logDebug: jest.fn(),
    logError: jest.fn(),
    sendInfo: jest.fn(),
    sendDebug: jest.fn(),
  };

  const mockMsgopsService = {
    findContactById: jest.fn().mockResolvedValue(createMockContact()),
    getMessageById: jest.fn().mockResolvedValue(createMockEmail()),
    updateContact: jest.fn().mockResolvedValue(createMockContact()),
    createOrUpdateCustomFields: jest.fn().mockResolvedValue([]),
    findLeadById: jest.fn().mockResolvedValue({ id: 1, data: {} }),
    queryRunner: jest.fn().mockResolvedValue([]),
    queryEventsLogs: jest.fn().mockResolvedValue([]),
  };

  const mockHttpRequestProvider = {
    process: jest.fn().mockResolvedValue({ status: 200, data: {} }),
  };

  return {
    mockRedisClient,
    mockRedisService,
    mockActiveStepsHandler,
    mockQueuePublisher,
    mockConditionStep,
    mockTrackerService,
    mockMsgopsService,
    mockHttpRequestProvider,
  };
};

/**
 * Creates the module metadata for AppService tests
 */
export const createAppServiceTestingModule = (mocks: ReturnType<typeof createAppServiceMocks>): ModuleMetadata => ({
  providers: [
    { provide: RedisService, useValue: mocks.mockRedisService },
    { provide: ActiveStepsHandler, useValue: mocks.mockActiveStepsHandler },
    { provide: QueuePublisher, useValue: mocks.mockQueuePublisher },
    { provide: ConditionStep, useValue: mocks.mockConditionStep },
    { provide: TrackerService, useValue: mocks.mockTrackerService },
    { provide: MsgopsService, useValue: mocks.mockMsgopsService },
    { provide: HttpRequestProvider, useValue: mocks.mockHttpRequestProvider },
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
  process.env.TOPIC_NAME_MESSAGE_TRIGGER = 'message-trigger';
  process.env.TOPIC_NAME_SEND_EMAIL = 'send-email';
  process.env.TOPIC_NAME_SEND_PUSH = 'send-push';
  process.env.TOPIC_NAME_SEND_TWILIO = 'send-twilio';
  process.env.TOPIC_NAME_SEND_WHATSAPP = 'send-whatsapp';
  process.env.TOPIC_NAME_TAG_PROCESS = 'tag-process';
  process.env.TOPIC_NAME_HTTP_REQUEST = 'http-request';
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
 * Helper to create assertions for queue publisher calls
 */
export const expectQueuePublisherCalled = (mockQueuePublisher: any, topic: string, messageMatch?: Record<string, any>) => {
  const calls = mockQueuePublisher.sendAsyncMessage.mock.calls;
  const matchingCall = calls.find((call: any[]) => call[0] === topic);

  expect(matchingCall).toBeDefined();
  if (messageMatch && matchingCall) {
    expect(matchingCall[1]).toMatchObject(messageMatch);
  }
};

/** @deprecated Use expectQueuePublisherCalled instead */
export const expectPubSubCalled = expectQueuePublisherCalled;
