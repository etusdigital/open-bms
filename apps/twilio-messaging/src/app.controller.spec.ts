import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PubSubProvider } from './providers/pubsub.provider';
import { Utils } from './utils/index.utils';
import request from 'supertest';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { MsgopsService } from './msgops/msgops.service';
import { RedisService } from './providers/redis/redis.service';

const campaignPayload = {
  account: {
    id: 1,
    name: 'Unit Teste',
    description: null,
    createdAt: '2022-11-08T02:23:01.460Z',
    updatedAt: null,
    deletedAt: null,
    customFields: [],
    accountConfigs: [
      {
        accountId: 1,
        name: 'api_key',
        value: '1z1wkVIKbjm{~vM2BJ*x)[sErsN&@dO|8MP4JPM{Urrr^l@CLnB}WjZKws[g',
        description: null,
      },
      {
        accountId: 1,
        name: 'twilio_sid',
        value: '1111',
        description: null,
      },
      {
        accountId: 1,
        name: 'twilio_secret',
        value: '222',
        description: null,
      },
      {
        accountId: 1,
        name: 'twilio_sid_account',
        value: '222',
        description: null,
      },
      {
        accountId: 1,
        name: 'twilio_sms_service',
        value: '+testesms',
        description: null,
      },
      {
        accountId: 1,
        name: 'twilio_whatsapp_service',
        value: '+testewhatsapp',
        description: null,
      },
    ],
  },
  campaign_id: 5414,
  campaign_name: 'warmup-17',
  campaign_test_ab_mode: false,
  contacts: [
    {
      id: 37511222,
      accountId: 1,
      uuid: '8cdd0ff0c145e0d91d48e3c944391696b43ed360',
      email: 'agostinho@carrara.com',
      emailProvider: 'Gmail',
      firstName: 'Agostinho',
      lastName: 'Carrara',
      hashedEmail: 'ce13a9831262ff412ac6b1cb9931792b340ba32414be8625803b4e0fc0597a2c',
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
    content: 'Integração com a twillio 4',
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
    content: 'Integração com a twillio 4',
    providerMessageId: '1',
    type: 'sms',
  },
  contact: {
    id: 37511222,
    accountId: 1,
    uuid: '8cdd0ff0c145e0d91d48e3c944391696b43ed360',
    email: 'agostinho@carrara.com',
    emailProvider: 'Gmail',
    firstName: 'Agostinho',
    lastName: 'Carrara',
    hashedEmail: 'ce13a9831262ff412ac6b1cb9931792b340ba32414be8625803b4e0fc0597a2c',
    phone: '+55111111',
    whatsapp: '+55111111',
    hasPhone: true,
    hasWhatsapp: true,
  },
  account: {
    id: 1,
    name: 'Unit Teste',
    description: null,
    createdAt: '2022-11-08T02:23:01.460Z',
    updatedAt: null,
    deletedAt: null,
    customFields: [],
    accountConfigs: [
      {
        accountId: 1,
        name: 'api_key',
        value: '1z1wkVIKbjm{~vM2BJ*x)[sErsN&@dO|8MP4JPM{Urrr^l@CLnB}WjZKws[g',
        description: null,
      },
      {
        accountId: 1,
        name: 'twilio_sid',
        value: '1111',
        description: null,
      },
      {
        accountId: 1,
        name: 'twilio_secret',
        value: '222',
        description: null,
      },
      {
        accountId: 1,
        name: 'twilio_sid_account',
        value: '222',
        description: null,
      },
      {
        accountId: 1,
        name: 'twilio_sms_service',
        value: '+testesms',
        description: null,
      },
      {
        accountId: 1,
        name: 'twilio_whatsapp_service',
        value: '+testewhatsapp',
        description: null,
      },
    ],
  },
};

const mockRedisClient = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
};

const mockRedisService = {
  getClient: jest.fn().mockReturnValue(mockRedisClient),
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
};

const mockMsgopsService = {
  createShortLink: jest.fn().mockResolvedValue('https://short.link/abc123'),
};

describe('AppController', () => {
  let appController: AppController;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        PubSubProvider,
        Utils,
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

  it('[SMS] twilio process campaign page', () => {
    return request(app.getHttpServer())
      .post('/campaign')
      .send(campaignPayload)
      .expect(201)
      .expect({ status: 201, message: 'ok' });
  });

  it('[SMS] twilio error process campaign page', () => {
    return request(app.getHttpServer()).post('/campaign').send({}).expect(500);
  });

  it('[SMS] twilio process automation step without next', () => {
    return request(app.getHttpServer())
      .post('/automation')
      .send(automationPayload)
      .expect(201)
      .expect({
        status: true,
        message: `[${automationPayload.messageId}] This message does not have the next filled in.`,
      });
  });

  it('[SMS] twilio process automation step with next', () => {
    automationPayload.next = { pubName: 'unit-test', data: {} };
    return request(app.getHttpServer()).post('/automation').send(automationPayload).expect(201);
  });

  it('[SMS] twilio error process automation step', () => {
    return request(app.getHttpServer()).post('/automation').send({}).expect(500);
  });

  it('[WHATSAPP] twilio process campaign page', () => {
    campaignPayload.message.type = 'whatsapp';
    return request(app.getHttpServer())
      .post('/campaign')
      .send(campaignPayload)
      .expect(201)
      .expect({ status: 201, message: 'ok' });
  });

  it('[WHATSAPP] twilio error process campaign page', () => {
    return request(app.getHttpServer()).post('/campaign').send({}).expect(500);
  });

  it('[WHATSAPP] twilio process automation step without next', () => {
    automationPayload.message.type = 'whatsapp';
    automationPayload.next = {};
    return request(app.getHttpServer())
      .post('/automation')
      .send(automationPayload)
      .expect(201)
      .expect({
        status: true,
        message: `[${automationPayload.messageId}] This message does not have the next filled in.`,
      });
  });

  it('[WHATSAPP] twilio process automation step with next', () => {
    automationPayload.message.type = 'whatsapp';
    automationPayload.next = { pubName: 'unit-test', data: {} };
    return request(app.getHttpServer()).post('/automation').send(automationPayload).expect(201);
  });

  it('[WHATSAPP] twilio error process automation step', () => {
    return request(app.getHttpServer()).post('/automation').send({}).expect(500);
  });
});
