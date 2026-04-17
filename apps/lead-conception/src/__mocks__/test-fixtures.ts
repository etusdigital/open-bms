import { AccountEntity } from '../msgops/entities/account.entity';
import { ContactEntity } from '../msgops/entities/contact.entity';
import { SuppressionEntity } from '../msgops/entities/suppression.entity';
import { LeadsEntity } from '../msgops/entities/leads.entity';
import { CustomFieldsEntity } from '../msgops/entities/custom-fields.entity';
import { ContactDeviceEntity } from '../msgops/entities/contact-device.entity';
import { DeviceType, LeadMessage } from '../interfaces';

export function makeAccount(overrides: Partial<AccountEntity> = {}): AccountEntity {
  return {
    id: 1,
    name: 'Test Account',
    description: 'Test account description',
    isInternal: false,
    groupId: 100,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    accountConfigs: [
      { accountId: 1, name: 'api_key', value: 'test-api-key', description: '', account: null },
      { accountId: 1, name: 'time_zone', value: 'America/Sao_Paulo', description: '', account: null },
      { accountId: 1, name: 'email_settings', value: '{"validateEmails":false}', description: '', account: null },
      { accountId: 1, name: 'default_country', value: 'BR', description: '', account: null },
    ],
    customFields: [],
    customFieldsKeys: null,
    parseCustomFields: AccountEntity.prototype.parseCustomFields,
    ...overrides,
  } as AccountEntity;
}

export function makeContact(overrides: Partial<ContactEntity> = {}): ContactEntity {
  return {
    id: 1,
    accountId: 1,
    uuid: 'test-uuid-1234',
    email: 'test@example.com',
    emailProvider: 'Gmail',
    firstName: 'Test',
    lastName: 'User',
    hashedEmail: 'abc123hash',
    phone: '+5511999999999',
    city: 'Sao Paulo',
    region: 'SP',
    country: 'BR',
    postal: '01000',
    ip: '192.168.1.1',
    latitude: -23.5,
    longitude: -46.6,
    timezone: 'America/Sao_Paulo',
    isActive: true,
    isUnsubscribed: false,
    unsubscribedAt: null,
    isBlocked: false,
    blockedAt: null,
    isValid: true,
    hasBounced: false,
    hasEmail: true,
    hasPhone: true,
    hasWebPush: false,
    hasMobilePush: false,
    lastOpen: null,
    lastClick: null,
    lastSent: null,
    lastAutomation: null,
    score: 0,
    scoreForecast: 0,
    whatsapp: null,
    hasWhatsapp: false,
    whatsappLastSent: null,
    whatsappLastDelivered: null,
    whatsappLastOpen: null,
    whatsappLastClick: null,
    lastVerticalType: null,
    createdAt: new Date('2024-01-01'),
    createdAtDate: '01/01/2024',
    updatedAt: new Date('2024-01-01'),
    contactTag: [],
    customFields: [],
    contactDevices: [],
    get fullName() {
      return `${this.firstName} ${this.lastName}`;
    },
    getMailBoxProvider: ContactEntity.prototype.getMailBoxProvider,
    ...overrides,
  } as ContactEntity;
}

export function makeSuppression(overrides: Partial<SuppressionEntity> = {}): SuppressionEntity {
  return {
    id: 1,
    groupId: 100,
    email: 'test@example.com',
    isUnsubscribed: true,
    unsubscribedAt: new Date('2024-01-01'),
    isBlocked: false,
    blockedAt: null,
    setUserDetails: SuppressionEntity.prototype.setUserDetails,
    ...overrides,
  } as SuppressionEntity;
}

export function makeLead(overrides: Partial<LeadsEntity> = {}): LeadsEntity {
  return {
    id: 1,
    contactId: 1,
    accountId: 1,
    uuid: 'test-uuid-1234',
    email: 'test@example.com',
    hashedEmail: 'abc123hash',
    emailProvider: 'Gmail',
    firstName: 'Test',
    lastName: 'User',
    isValid: true,
    status: 'new',
    engaged: '0',
    tagName: 'test-tag',
    createdAt: new Date('2024-01-01'),
    createdAtDate: '01/01/2024',
    ...overrides,
  } as LeadsEntity;
}

export function makeCustomField(overrides: Partial<CustomFieldsEntity> = {}): CustomFieldsEntity {
  return {
    id: 1,
    accountId: 1,
    title: 'Test Field',
    name: 'TEST_FIELD',
    description: '',
    order: 1,
    type: 'text',
    attributionType: 'last',
    label: 'Test Field',
    placeholder: '',
    fieldType: 'text',
    fieldFormat: '',
    fileFormats: [],
    characterLimit: 255,
    decimalLength: 0,
    options: [],
    mask: '',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    account: null,
    ...overrides,
  } as CustomFieldsEntity;
}

export function makeContactDevice(overrides: Partial<ContactDeviceEntity> = {}): ContactDeviceEntity {
  return {
    id: 1,
    accountId: 1,
    contactId: 1,
    isActive: true,
    type: DeviceType.WEBPUSH,
    token: 'test-token-123',
    isUnsubscribed: false,
    ip: '192.168.1.1',
    deviceType: 'desktop',
    os: 'Windows',
    browser: 'Chrome',
    browserVersion: '120',
    resolution: '1920x1080',
    subscriptionUrl: 'https://example.com/push',
    latestVisitedUrl: 'https://example.com',
    lastSession: null,
    lastSent: null,
    lastSentDate: null,
    lastView: null,
    lastViewDate: null,
    lastClick: null,
    lastClickDate: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    contact: null,
    ...overrides,
  } as ContactDeviceEntity;
}

export function makeLeadMessage(overrides: Partial<LeadMessage> = {}): LeadMessage {
  return {
    account: makeAccount(),
    contact: {
      email: 'test@example.com',
      isValid: true,
    },
    apiKey: 'test-api-key',
    startedAt: Date.now(),
    tagName: 'test-tag',
    ...overrides,
  } as LeadMessage;
}
