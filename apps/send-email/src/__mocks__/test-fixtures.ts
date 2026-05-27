import { TrackerRequest } from '../tracker/tracker.interface';

export const createTrackerRequest = (overrides: Partial<TrackerRequest> = {}): TrackerRequest => ({
  email: 'test@example.com',
  automation_name: 'test-automation',
  automation_type: 'email',
  message_id: 'msg-123',
  ...overrides,
});

export const createMockContact = (overrides = {}) => ({
  id: 1,
  email: 'test@example.com',
  firstName: 'John',
  isValid: true,
  uuid: 'uuid-123',
  ...overrides,
});

export const createMockAccount = (overrides = {}) => ({
  id: 1,
  name: 'Test Account',
  accountConfigs: [],
  ...overrides,
});

export const createMockMessage = (overrides = {}) => ({
  id: 456,
  title: 'Test Email',
  name: 'test-email',
  ippool: 'default',
  subject: 'Test Subject',
  replyTo: 'reply@example.com',
  content: '<p>Test content</p>',
  location: {
    bucketName: 'test-bucket',
    fileName: 'test-file.html',
  },
  from: {
    firstName: 'Sender',
    email: 'sender@example.com',
  },
  ...overrides,
});

export const createMockSendEmailMessage = (overrides = {}) => ({
  messageId: 'msg-123',
  startedAt: Date.now(),
  automationId: 123,
  automationName: 'Test Automation',
  automationType: 'email' as const,
  isRateLimit: false,
  utmContent: 'test-content',
  utmCampaign: 'test-campaign',
  contact: createMockContact(),
  message: createMockMessage(),
  next: { pubName: 'next-topic', data: {} },
  account: createMockAccount(),
  ...overrides,
});
