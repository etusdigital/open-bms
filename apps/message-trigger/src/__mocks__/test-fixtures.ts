import { LeadStateMessage, Contact, Account, Automation, Step, StepType, Next, CompressedPayload, SendEmailMessage, Email } from '../interfaces';

/**
 * Factory function to create a mock Contact
 */
export const createMockContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 123,
  accountId: 1,
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+5511999999999',
  hashedEmail: 'hash123',
  isValid: true,
  hasEmail: true,
  uuid: 'uuid-123',
  ...overrides,
});

/**
 * Factory function to create a mock Account
 */
export const createMockAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 1,
  name: 'Test Account',
  description: 'Test account for testing',
  customFields: ['field1', 'field2'],
  defaultDomain: 'example.com',
  defaultSenderName: 'Test Sender',
  defaultSenderEmail: 'sender@example.com',
  accountConfigs: {
    time_zone: 'America/Sao_Paulo',
    api_key: 'test-api-key',
    sendgrid_key: 'test-sendgrid-key',
  },
  ...overrides,
});

/**
 * Factory function to create a mock Step
 */
export const createMockStep = (type: StepType, overrides: Partial<Step> = {}): Step => {
  const baseStep: Step = {
    id: 100,
    type,
    settings: {},
    ...overrides,
  };

  // Add type-specific default settings
  switch (type) {
    case StepType.EMAIL:
      baseStep.settings = {
        id: 200,
        title: 'Test Email',
        subject: 'Test Subject',
        ...overrides.settings,
      };
      break;
    case StepType.WAIT:
      baseStep.settings = {
        timer: 60,
        timerType: 'minutes',
        ...overrides.settings,
      };
      break;
    case StepType.CONDITIONAL_TIME:
      baseStep.settings = {
        initialTime: 8,
        endTime: 21,
        ...overrides.settings,
      };
      break;
    case StepType.ADD_TAG:
    case StepType.REMOVE_TAG:
      baseStep.settings = {
        name: 'test-tag',
        ...overrides.settings,
      };
      break;
    case StepType.CONDITIONAL:
      baseStep.settings = [
        {
          type: 'tag',
          conditional_tag: 'in',
          tag_id: [1, 2, 3],
        },
        ...overrides.settings,
      ];
      break;
  }

  return baseStep;
};

/**
 * Factory function to create a mock Automation
 */
export const createMockAutomation = (overrides: Partial<Automation> = {}): Automation => ({
  id: 50,
  type: 'email',
  title: 'Test Automation',
  name: 'test-automation',
  version: '1.0',
  steps: [createMockStep(StepType.EMAIL)],
  ...overrides,
});

/**
 * Factory function to create a mock LeadStateMessage
 */
export const createMockLeadStateMessage = (overrides: Partial<LeadStateMessage> = {}): LeadStateMessage => ({
  id: 'lead-123',
  automation: createMockAutomation(),
  account: createMockAccount(),
  contact: createMockContact(),
  activeStepId: '100',
  startedAt: Date.now(),
  tagName: 'test-tag',
  ...overrides,
});

/**
 * Factory function to create a mock Next
 */
export const createMockNext = (overrides: Partial<Next> = {}): Next => ({
  pubName: 'msgops.message.trigger',
  data: createMockLeadStateMessage(),
  ...overrides,
});

/**
 * Factory function to create a mock CompressedPayload
 */
export const createMockCompressedPayload = (overrides: Partial<CompressedPayload> = {}): CompressedPayload => ({
  automationKey: 'automation-50-123-1234567890',
  contactId: 123,
  automationId: 50,
  stepId: 100,
  ...overrides,
});

/**
 * Factory function to create a mock Email/Message
 */
export const createMockEmail = (overrides: Partial<Email> = {}): Email => ({
  id: 200,
  title: 'Test Email',
  ippool: 'test-pool',
  subject: 'Test Subject',
  previewText: 'Preview text',
  replyTo: 'reply@example.com',
  priority: 'normal',
  location: {
    bucketName: 'test-bucket',
    fileName: 'test-file.html',
  },
  from: {
    firstName: 'Test',
    email: 'from@example.com',
  },
  ...overrides,
});

/**
 * Factory function to create a mock SendEmailMessage
 */
export const createMockSendEmailMessage = (overrides: Partial<SendEmailMessage> = {}): SendEmailMessage => {
  return {
    startedAt: Date.now(),
    automationId: 50,
    automationName: 'Test Automation',
    automationType: 'email',
    utmContent: 'test-content',
    utmCampaign: 'test-campaign',
    emailId: 200,
    contact: createMockContact(),
    message: createMockEmail(),
    account: createMockAccount(),
    next: createMockNext(),
    ...overrides,
  };
};

/**
 * Helper to create a step with child steps
 */
export const createStepWithChildren = (type: StepType, children: Step[], overrides: Partial<Step> = {}): Step => ({
  ...createMockStep(type, overrides),
  child: children,
});

/**
 * Helper to create an END step
 */
export const createEndStep = (): Step => ({
  id: 0,
  type: StepType.END,
  settings: {},
});
