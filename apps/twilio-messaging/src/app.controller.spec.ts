jest.mock('@bms/messaging', () => ({
  AmqpPublisher: jest.fn(),
  AmqpConsumer: jest.fn(),
  createHttpBridgeHandler: jest.fn(),
  EXCHANGES: {
    email: 'bms.email',
    events: 'bms.events',
    leads: 'bms.leads',
    campaigns: 'bms.campaigns',
    triggers: 'bms.triggers',
    push: 'bms.push',
    whatsapp: 'bms.whatsapp',
    sms: 'bms.sms',
    tags: 'bms.tags',
  },
  DLX: 'bms.dlx',
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventPublisherService } from './event-publisher.service';
import { Utils } from './utils/index.utils';
import request from 'supertest';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { MsgopsService } from './msgops/msgops.service';
import { RedisService } from './providers/redis/redis.service';

const VALID_TOKEN = 'dev-twilio-messaging-token-test';

const baseAccountConfigs = [
  { accountId: 1, name: 'twilio_sid', value: '1111', description: null },
  { accountId: 1, name: 'twilio_secret', value: '222', description: null },
  { accountId: 1, name: 'twilio_sid_account', value: '222', description: null },
  { accountId: 1, name: 'twilio_sms_service', value: '+testesms', description: null },
  { accountId: 1, name: 'twilio_whatsapp_service', value: '+testewhatsapp', description: null },
];

const campaignPayload = {
  account: { id: 1, name: 'Unit Teste', accountConfigs: baseAccountConfigs, customFields: [] },
  campaign_id: 5414,
  campaign_name: 'warmup-17',
  campaign_test_ab_mode: false,
  contacts: [
    {
      id: 37511222,
      accountId: 1,
      uuid: '8cdd0ff0c145e0d91d48e3c944391696b43ed360',
      email: 'agostinho@carrara.com',
      firstName: 'Agostinho',
      lastName: 'Carrara',
      phone: '+55111111',
      whatsapp: '+55111111',
      hasPhone: true,
      hasWhatsapp: true,
    },
  ],
  page: 1,
  totalPages: 60,
  message: {
    id: 8287,
    accountId: 1,
    title: 'WarmUp #17',
    name: 'warmup-17',
    content: 'sms test',
    providerMessageId: '2',
    type: 'sms',
  },
};

const automationPayload = {
  startedAt: 1213242,
  automationId: 1,
  automationName: 'Unit Test',
  automationType: 'email',
  utmContent: 'bms',
  utmCampaign: 'unit-test-e1-01',
  next: {} as any,
  messageId: 'ousnfgb1nasdhs',
  message: {
    id: 8287,
    accountId: 1,
    title: 'WarmUp #17',
    name: 'warmup-17',
    content: 'sms test',
    providerMessageId: '1',
    type: 'sms',
  },
  contact: {
    id: 37511222,
    accountId: 1,
    uuid: '8cdd0ff0c145e0d91d48e3c944391696b43ed360',
    firstName: 'Agostinho',
    lastName: 'Carrara',
    phone: '+55111111',
    whatsapp: '+55111111',
    hasPhone: true,
    hasWhatsapp: true,
  },
  account: { id: 1, name: 'Unit Teste', accountConfigs: baseAccountConfigs, customFields: [] },
};

const mockRedisClient = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

const mockRedisService = {
  getClient: jest.fn().mockReturnValue(mockRedisClient),
};

const mockMsgopsService = {
  createShortLink: jest.fn().mockResolvedValue('https://short.link/abc123'),
};

const mockEventPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

describe('AppController', () => {
  let appController: AppController;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.INTERNAL_AUTH_TOKEN = VALID_TOKEN;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        Utils,
        { provide: EventPublisherService, useValue: mockEventPublisher },
        { provide: RedisService, useValue: mockRedisService },
        { provide: MsgopsService, useValue: mockMsgopsService },
      ],
    }).compile();

    appController = moduleFixture.get<AppController>(AppController);
    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('campaign (/campaign — TODO Onda 4)', () => {
    it('[SMS] processes campaign page', () => {
      campaignPayload.message.type = 'sms';
      return request(app.getHttpServer())
        .post('/campaign')
        .send(campaignPayload)
        .expect(201)
        .expect({ status: 201, message: 'ok' });
    });

    it('[SMS] error processing empty campaign payload', () => {
      return request(app.getHttpServer()).post('/campaign').send({}).expect(500);
    });

    it('[WHATSAPP] processes campaign page', () => {
      campaignPayload.message.type = 'whatsapp';
      return request(app.getHttpServer())
        .post('/campaign')
        .send(campaignPayload)
        .expect(201)
        .expect({ status: 201, message: 'ok' });
    });
  });

  describe('automation (/internal/sms/automation)', () => {
    it('rejects with 401 without token', () => {
      automationPayload.next = {};
      return request(app.getHttpServer()).post('/internal/sms/automation').send(automationPayload).expect(401);
    });

    it('rejects with 401 with wrong token', () => {
      automationPayload.next = {};
      return request(app.getHttpServer())
        .post('/internal/sms/automation')
        .set('x-internal-token', 'wrong')
        .send(automationPayload)
        .expect(401);
    });

    it('[SMS] processes automation step without next', () => {
      automationPayload.message.type = 'sms';
      automationPayload.next = {};
      return request(app.getHttpServer())
        .post('/internal/sms/automation')
        .set('x-internal-token', VALID_TOKEN)
        .send(automationPayload)
        .expect(201)
        .expect({
          status: true,
          message: `[${automationPayload.messageId}] This message does not have the next filled in.`,
        });
    });

    it('[SMS] processes automation step with next', () => {
      automationPayload.message.type = 'sms';
      automationPayload.next = { pubName: 'unit-test', data: {} };
      return request(app.getHttpServer())
        .post('/internal/sms/automation')
        .set('x-internal-token', VALID_TOKEN)
        .send(automationPayload)
        .expect(201);
    });

    it('[SMS] error processing empty automation payload', () => {
      return request(app.getHttpServer())
        .post('/internal/sms/automation')
        .set('x-internal-token', VALID_TOKEN)
        .send({})
        .expect(500);
    });

    it('[WHATSAPP] processes automation step without next', () => {
      automationPayload.message.type = 'whatsapp';
      automationPayload.next = {};
      return request(app.getHttpServer())
        .post('/internal/sms/automation')
        .set('x-internal-token', VALID_TOKEN)
        .send(automationPayload)
        .expect(201)
        .expect({
          status: true,
          message: `[${automationPayload.messageId}] This message does not have the next filled in.`,
        });
    });

    it('[WHATSAPP] processes automation step with next', () => {
      automationPayload.message.type = 'whatsapp';
      automationPayload.next = { pubName: 'unit-test', data: {} };
      return request(app.getHttpServer())
        .post('/internal/sms/automation')
        .set('x-internal-token', VALID_TOKEN)
        .send(automationPayload)
        .expect(201);
    });
  });
});
