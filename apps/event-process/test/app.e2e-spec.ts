import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from './../src/app.module';

const SENDGRID_PAYLOAD = {
  platform: 'sendgrid',
  payload: [
    {
      category: [
        'pool_cc_plusdin_com_br',
        'source_msgops',
        'type_campaign',
        'campaign_1348',
        'id_plusdin-uc-fluxo-cc-e2-novo-v2',
        'domain_cc.plusdin.com.br',
        'account_1',
      ],
      email: 'batistadossantosrosimeire424@gmail.com',
      event: 'delivered',
      ip: '149.72.45.233',
      response: '250 2.0.0 OK  1660922846 p188-20020a2542c5000000b00694c3f2df52si2303677yba.264 - gsmtp',
      sg_event_id: 'ZGVsaXZlcmVkLTAtMTM1NDg2MzctUDlSXzk0d0VRQjJLWDlEYTZhQkhiUS04MDI',
      sg_message_id: 'P9R_94wEQB2KX9Da6aBHbQ.filterdrecv-canary-55ffb46599-tq7xj-1-62FFABBA-C0.802',
      timestamp: 1660922846,
      tls: 1,
      smtp_id: '<P9R_94wEQB2KX9Da6aBHbQ@geopod-ismtpd-4-2>',
    },
  ],
};

const SENDGRID_PAYLOAD_INVALID_TYPE = {
  platform: 'sendgrid',
  payload: [
    {
      category: [
        'pool_cc_plusdin_com_br',
        'source_msgops',
        'type_campaign',
        'campaign_1348',
        'id_plusdin-uc-fluxo-cc-e2-novo-v2',
        'domain_cc.plusdin.com.br',
        'account_1',
      ],
      email: 'batistadossantosrosimeire424@gmail.com',
      event: 'processed',
      ip: '149.72.45.233',
      response: '250 2.0.0 OK  1660922846 p188-20020a2542c5000000b00694c3f2df52si2303677yba.264 - gsmtp',
      sg_event_id: 'ZGVsaXZlcmVkLTAtMTM1NDg2MzctUDlSXzk0d0VRQjJLWDlEYTZhQkhiUS04MDI',
      sg_message_id: 'P9R_94wEQB2KX9Da6aBHbQ.filterdrecv-canary-55ffb46599-tq7xj-1-62FFABBA-C0.802',
      timestamp: 1660922846,
      tls: 1,
      smtp_id: '<P9R_94wEQB2KX9Da6aBHbQ@geopod-ismtpd-4-2>',
    },
  ],
};

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('sendgrid it should update 1 contact', () => {
    return request(app.getHttpServer()).post('/sendgrid').send(SENDGRID_PAYLOAD).expect(201).expect({});
  });

  it('sendgrid it should ignore events', () => {
    return request(app.getHttpServer()).post('/sendgrid').send(SENDGRID_PAYLOAD_INVALID_TYPE).expect(201).expect({});
  });

  it('sendgrid it should return 400 Bad Request', () => {
    return request(app.getHttpServer()).post('/sendgrid').send().expect(400);
  });
});
