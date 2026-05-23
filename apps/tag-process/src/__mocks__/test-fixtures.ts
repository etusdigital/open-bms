import { AccountEntity } from '../msgops/entities/account.entity';
import { AutomationEntity } from '../msgops/entities/automation.entity';
import { ContactEntity } from '../msgops/entities/contact.entity';
import { ContactAutomationEntity } from '../msgops/entities/contact-automation.entity';
import { TagEntity } from '../msgops/entities/tag.entity';
import { CampaignEntity } from '../msgops/entities/campaign.entity';
import { LeadMessage, TagBatch, Actions, EventsTrigger, SegmentToClickHouse } from '../interfaces';

export function createAccount(overrides: Partial<AccountEntity> = {}): AccountEntity {
  return {
    id: 1,
    name: 'Test Account',
    isInternal: false,
    description: 'Test account description',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    accountConfigs: { time_zone: 'America/Sao_Paulo', api_key: 'test-api-key' } as any,
    customFields: ['field1', 'field2'],
    parseAccount: jest.fn(),
    ...overrides,
  } as AccountEntity;
}

export function createAutomation(overrides: Partial<AutomationEntity> = {}): AutomationEntity {
  return {
    id: 10,
    title: 'Test Automation',
    name: 'test-automation',
    isActive: true,
    type: 'email',
    steps: '[]',
    triggers: {
      settings: {
        id: 100,
        type: 'tag',
        applyFrequency: 'multiply',
        conditional: null,
      },
    },
    isRateLimit: false,
    verticalType: 'automation',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    account: createAccount(),
    ...overrides,
  } as AutomationEntity;
}

export function createContact(overrides: Partial<ContactEntity> = {}): ContactEntity {
  return {
    id: 100,
    accountId: 1,
    uuid: 'test-uuid-123',
    email: 'test@example.com',
    emailProvider: 'Gmail',
    firstName: 'John',
    lastName: 'Doe',
    hashedEmail: 'hashed123',
    phone: '+5511999999999',
    city: 'Sao Paulo',
    region: 'SP',
    country: 'BR',
    postal: '01000-000',
    ip: '127.0.0.1',
    latitude: -23.55,
    longitude: -46.63,
    timezone: 'America/Sao_Paulo',
    isActive: true,
    isUnsubscribed: false,
    isValid: true,
    hasBounced: false,
    hasEmail: true,
    lastOpen: new Date('2024-01-01'),
    lastOpenDate: new Date('2024-01-01'),
    lastClick: new Date('2024-01-01'),
    lastClickDate: new Date('2024-01-01'),
    lastSent: new Date('2024-01-01'),
    lastSentDate: new Date('2024-01-01'),
    lastAutomation: new Date('2024-01-01'),
    lastAutomationDate: new Date('2024-01-01'),
    score: 50,
    scoreForecast: 60,
    lastVerticalType: 'automation',
    createdAt: new Date('2024-01-01'),
    createdAtDate: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    fullName: 'John Doe',
    tags: [],
    customFields: {},
    contactAutomation: [],
    parseCustomFields: jest.fn(),
    ...overrides,
  } as unknown as ContactEntity;
}

export function createTag(overrides: Partial<TagEntity> = {}): TagEntity {
  return {
    id: 100,
    accountId: 1,
    name: 'test-tag',
    description: 'Test tag',
    type: 'tag',
    recurrence: 0,
    scheduleCloudTaskId: null,
    steps: '[]',
    segmentInfo: [],
    contactsLimit: 0,
    lastCount: 0,
    lastCountEmail: 0,
    lastCountWebPush: 0,
    lastCountMobilePush: 0,
    lastCountPhone: 0,
    lastCountWhatsapp: 0,
    status: 'active',
    isRealTimeSegment: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as TagEntity;
}

export function createContactAutomation(overrides: Partial<ContactAutomationEntity> = {}): ContactAutomationEntity {
  return {
    id: 1,
    accountId: 1,
    contactId: 100,
    status: 'running',
    automationId: 10,
    automationTitle: 'Test Automation',
    automationType: 'email',
    createdAt: new Date('2024-01-01'),
    createdAtDate: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    contact: null,
    ...overrides,
  } as ContactAutomationEntity;
}

export function createLeadMessage(overrides: Partial<LeadMessage> = {}): LeadMessage {
  return {
    id: 1,
    account: createAccount(),
    contact: createContact(),
    tagName: 'test-tag',
    startedAt: Date.now(),
    automation: createAutomation(),
    ...overrides,
  } as LeadMessage;
}

export function createTagBatch(overrides: Partial<TagBatch> = {}): TagBatch {
  return {
    action: Actions.ADD as any,
    tag: 'test-tag',
    apiKey: 'test-api-key',
    createContacts: false,
    contacts: [
      { email: 'user1@example.com', firstName: 'User', lastName: 'One' },
      { email: 'user2@example.com', firstName: 'User', lastName: 'Two' },
    ],
    ...overrides,
  };
}

export function createEventsTrigger(overrides: Partial<EventsTrigger> = {}): EventsTrigger {
  return {
    accountId: 1,
    contactId: 100,
    messageId: 200,
    event: 'open',
    ...overrides,
  };
}

export function createSegmentToClickHouse(overrides: Partial<SegmentToClickHouse> = {}): SegmentToClickHouse {
  return {
    type: 'segment-in',
    tagId: 100,
    tagName: 'test-segment',
    accountId: 1,
    contacts: [{ contact_id: 1 }, { contact_id: 2 }],
    ...overrides,
  };
}

export function createCampaign(overrides: Partial<CampaignEntity> = {}): CampaignEntity {
  return {
    id: 50,
    accountId: 1,
    title: 'Test Campaign',
    name: 'test-campaign',
    publisher: 'sendgrid',
    scheduleTo: new Date(),
    status: 1,
    steps: '[]',
    tags: [],
    type: 'email',
    triggers: { settings: { type: 'events', eventType: 'open', id: 200 } },
    isRateLimit: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    account: createAccount(),
    ...overrides,
  } as CampaignEntity;
}
