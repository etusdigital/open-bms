import { LeadMessage, QuizMakerPayload, Contact, DeviceType } from '../app.interfaces';
import { AccountEntity } from '../msgops/entities/account.entity';
import { AccountConfigEntity } from '../msgops/entities/account-config.entity';

export function createContact(overrides: Partial<Contact> = {}): Contact {
  return {
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    ...overrides,
  };
}

export function createLeadMessage(overrides: Partial<LeadMessage> = {}): LeadMessage {
  return {
    contact: createContact(),
    tagName: 'test-tag',
    apiKey: 'test-api-key',
    ...overrides,
  };
}

export function createQuizPayload(overrides: Partial<QuizMakerPayload> = {}): QuizMakerPayload {
  return {
    name: 'John Doe',
    email: 'test@example.com',
    original_email: 'test@example.com',
    app: 'plusdin-quiz-cc',
    hashed_email: 'abc123',
    referer: 'https://example.com',
    query_string: '',
    questions: [
      { question: 'What is your age?', answer: '25' },
      { question: 'What is your income?', answer: '5000' },
    ],
    direct_to: '',
    fbp: '',
    etsclientid: '',
    gid: '',
    aff_id: '',
    krux_id: '',
    sub_id: '',
    fbclid: '',
    gclid: '',
    taboola_external_id: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
    campaign_id: '',
    ad_id: '',
    adset_id: '',
    origem_cadastro: '',
    source_url: 'https://example.com/quiz',
    form_fields: [],
    td_client_id: '',
    td_ssc_id: '',
    td_global_id: '',
    apiKey: 'cbf3883074639ea9e3aced35ac37d706',
    tagName: 'plusdin-quiz-cc',
    ...overrides,
  };
}

export function createAccountEntity(overrides: Partial<AccountEntity> = {}): AccountEntity {
  const account = new AccountEntity();
  account.id = 1;
  account.name = 'Test Account';
  account.description = 'Test Description';
  account.isInternal = false;
  account.createdAt = new Date();
  account.updatedAt = new Date();
  account.deletedAt = null as any;
  account.customFieldsKeys = [];
  Object.assign(account, overrides);
  return account;
}

export function createAccountConfigEntity(overrides: Partial<AccountConfigEntity> = {}): AccountConfigEntity {
  const config = new AccountConfigEntity();
  config.accountId = 1;
  config.name = 'api_key';
  config.value = 'test-api-key';
  config.description = 'Test config';
  Object.assign(config, overrides);
  return config;
}

export function createContactWithDevice() {
  return createContact({
    devices: [
      {
        accountId: 1,
        contactId: 1,
        type: DeviceType.WEBPUSH,
        token: 'test-token',
        isUnsubscribed: false,
      },
    ],
  });
}
