import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication, Query } from '@nestjs/common';
import { JoiPipe } from 'nestjs-joi';
import request from 'supertest';
import { ContactsPageDto } from '../dto/contactsPage.dto';

/**
 * Boundary-validation test for ContactsPageDto.
 *
 * Express parses `?channels=email` (single occurrence) as a string but the
 * service code calls `.map(...)` / `.includes(...)` on `params.channels` and
 * `params.activities` assuming `string[]`. The DTO now uses
 * `Joi.array().items(Joi.string()).single()` to coerce scalar → 1-element
 * array at the Joi pipe boundary, so the service can stay typed-pure.
 *
 * These tests use a stub controller (not the real ContactsController) so we
 * exercise only the Joi pipe + DTO and avoid wiring the whole module.
 */
@Controller('test-history')
class TestHistoryController {
  @Get()
  echo(@Query() params: ContactsPageDto) {
    return {
      channels: params.channels,
      activities: params.activities,
      channelsIsArray: Array.isArray(params.channels),
      activitiesIsArray: Array.isArray(params.activities),
    };
  }
}

describe('ContactsPageDto query coercion (PR #197 regression)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TestHistoryController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new JoiPipe());
    await app.init();
  });

  afterAll(async () => app.close());

  it('coerces ?channels=email (single occurrence) to ["email"]', async () => {
    const res = await request(app.getHttpServer()).get('/test-history?channels=email');

    expect(res.status).toBe(200);
    expect(res.body.channelsIsArray).toBe(true);
    expect(res.body.channels).toEqual(['email']);
  });

  it('preserves ?channels=email&channels=sms (multi-occurrence array)', async () => {
    const res = await request(app.getHttpServer()).get('/test-history?channels=email&channels=sms');

    expect(res.status).toBe(200);
    expect(res.body.channelsIsArray).toBe(true);
    expect(res.body.channels).toEqual(['email', 'sms']);
  });

  it('coerces ?activities=message (single occurrence) to ["message"]', async () => {
    const res = await request(app.getHttpServer()).get('/test-history?activities=message');

    expect(res.status).toBe(200);
    expect(res.body.activitiesIsArray).toBe(true);
    expect(res.body.activities).toEqual(['message']);
  });

  it('preserves ?activities=message&activities=automation', async () => {
    const res = await request(app.getHttpServer()).get('/test-history?activities=message&activities=automation');

    expect(res.status).toBe(200);
    expect(res.body.activitiesIsArray).toBe(true);
    expect(res.body.activities).toEqual(['message', 'automation']);
  });

  it('leaves both fields undefined when neither is provided', async () => {
    const res = await request(app.getHttpServer()).get('/test-history');

    expect(res.status).toBe(200);
    expect(res.body.channels).toBeUndefined();
    expect(res.body.activities).toBeUndefined();
  });
});
