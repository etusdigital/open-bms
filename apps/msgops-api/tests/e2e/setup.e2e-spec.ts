import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { SetupModule } from '../../src/modules/setup/setup.module';
import { AUTH_PROVIDER_TOKEN } from '../../src/modules/auth/providers/auth.provider.interface';
import { SetupService } from '../../src/modules/setup/setup.service';
import { HealthCheckResult } from '../../src/modules/setup/dtos/health-check-result.dto';

describe('Setup Wizard (E2E)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let setupService: SetupService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), SetupModule],
    })
      .overrideProvider(AUTH_PROVIDER_TOKEN)
      .useValue({
        createUser: jest.fn().mockResolvedValue({ providerId: 'local|test-user-id' }),
        updatePassword: jest.fn().mockResolvedValue(undefined),
        supportsCredentialLogin: jest.fn().mockReturnValue(true),
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        verifyToken: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    setupService = moduleRef.get(SetupService);
  });

  afterAll(async () => {
    // Clean up wizard state so the suite can be re-run safely
    const repo = (setupService as any).systemConfigRepo;
    await repo.delete({ key: 'setup_wizard_step' });
    await repo.delete({ key: 'setup_complete' });
    await repo.delete({ key: 'smtp_settings' });
    await repo.delete({ key: 'domain_settings' });
    await (setupService as any).userRepo.delete({ email: 'admin@test.com' });
    await app.close();
  });

  test('GET /setup/status returns unconfigured step 1 on fresh state', async () => {
    const response = await request(app.getHttpServer()).get('/setup/status');

    expect(response.status).toBe(200);
    expect(response.body.configured).toBe(false);
    expect(response.body.currentStep).toBe(1);
  });

  test('POST /setup/advance step 1 (admin) advances to step 2', async () => {
    const response = await request(app.getHttpServer())
      .post('/setup/advance')
      .send({
        step: 1,
        data: { name: 'Admin Test', email: 'admin@test.com', password: 'P@ssw0rd123!', accountName: 'Acme E2E' },
      });

    expect(response.status).toBe(201);

    const status = await request(app.getHttpServer()).get('/setup/status');
    expect(status.body.currentStep).toBe(2);
  });

  test('POST /setup/advance step 2 (SMTP) advances to step 3', async () => {
    const response = await request(app.getHttpServer())
      .post('/setup/advance')
      .send({
        step: 2,
        data: { host: 'smtp.test.com', port: 587, user: 'smtp@test.com', pass: 'smtppass', from: 'noreply@test.com' },
      });

    expect(response.status).toBe(201);

    const status = await request(app.getHttpServer()).get('/setup/status');
    expect(status.body.currentStep).toBe(3);
  });

  test('POST /setup/advance step 3 (domain) advances to step 4', async () => {
    const response = await request(app.getHttpServer())
      .post('/setup/advance')
      .send({
        step: 3,
        data: { baseUrl: 'https://bms.test.com' },
      });

    expect(response.status).toBe(201);

    const status = await request(app.getHttpServer()).get('/setup/status');
    expect(status.body.currentStep).toBe(4);
  });

  test('POST /setup/advance step 4 (skip) advances to step 5 but is NOT yet complete', async () => {
    const response = await request(app.getHttpServer())
      .post('/setup/advance')
      .send({ step: 4, data: { skip: true } });

    expect(response.status).toBe(201);

    const status = await request(app.getHttpServer()).get('/setup/status');
    expect(status.body.configured).toBe(false);
    expect(status.body.currentStep).toBe(5);
  });

  test('GET /setup/health-check returns all-ok when services are healthy', async () => {
    const mockResult: HealthCheckResult = {
      postgres: { ok: true, latencyMs: 1 },
      redis: { ok: true, latencyMs: 1 },
      clickhouse: { ok: true, latencyMs: 1 },
      rabbitmq: { ok: true, latencyMs: 1 },
      s3: { ok: true, latencyMs: 1 },
      smtp: { ok: true, latencyMs: 1 },
      allOk: true,
    };
    jest.spyOn(setupService, 'checkHealth').mockResolvedValueOnce(mockResult);

    const response = await request(app.getHttpServer()).get('/setup/health-check');

    expect(response.status).toBe(200);
    expect(response.body.allOk).toBe(true);
    expect(response.body.postgres).toMatchObject({ ok: true });
    expect(response.body.redis).toMatchObject({ ok: true });
    expect(response.body.clickhouse).toMatchObject({ ok: true });
    expect(response.body.rabbitmq).toMatchObject({ ok: true });
    expect(response.body.s3).toMatchObject({ ok: true });
    expect(response.body.smtp).toMatchObject({ ok: true });
  });

  test('POST /setup/advance step 5 (pool skipped) advances to step 6', async () => {
    const response = await request(app.getHttpServer())
      .post('/setup/advance')
      .send({ step: 5, data: { skip: true } });

    expect(response.status).toBe(201);

    const status = await request(app.getHttpServer()).get('/setup/status');
    expect(status.body.currentStep).toBe(6);
  });

  test('POST /setup/advance step 6 rejects when health fails and no skipReason', async () => {
    const failing: HealthCheckResult = {
      postgres: { ok: false, latencyMs: 5000, error: 'timeout' },
      redis: { ok: true, latencyMs: 1 },
      clickhouse: { ok: true, latencyMs: 1 },
      rabbitmq: { ok: true, latencyMs: 1 },
      s3: { ok: true, latencyMs: 1 },
      smtp: { ok: true, latencyMs: 1 },
      allOk: false,
    };
    jest.spyOn(setupService, 'checkHealth').mockResolvedValueOnce(failing);

    const response = await request(app.getHttpServer()).post('/setup/advance').send({ step: 6, data: {} });

    expect(response.status).toBe(400);

    const status = await request(app.getHttpServer()).get('/setup/status');
    expect(status.body.configured).toBe(false);
  });

  test('POST /setup/advance step 6 completes with skipReason when health fails', async () => {
    const failing: HealthCheckResult = {
      postgres: { ok: false, latencyMs: 5000, error: 'timeout' },
      redis: { ok: true, latencyMs: 1 },
      clickhouse: { ok: true, latencyMs: 1 },
      rabbitmq: { ok: true, latencyMs: 1 },
      s3: { ok: true, latencyMs: 1 },
      smtp: { ok: true, latencyMs: 1 },
      allOk: false,
    };
    jest.spyOn(setupService, 'checkHealth').mockResolvedValueOnce(failing);

    // Reset wizard back to step 6 so we can complete it
    const repo = (setupService as any).systemConfigRepo;
    await repo.save(repo.create({ key: 'setup_wizard_step', value: { currentStep: 6, completed: false } }));
    await repo.delete({ key: 'setup_complete' });

    const response = await request(app.getHttpServer())
      .post('/setup/advance')
      .send({ step: 6, data: { skipReason: 'Postgres indisponível em test env' } });

    expect(response.status).toBe(201);

    const status = await request(app.getHttpServer()).get('/setup/status');
    expect(status.body.configured).toBe(true);
  });

  test('POST /setup/advance step 6 completes wizard when all services healthy', async () => {
    const allGreen: HealthCheckResult = {
      postgres: { ok: true, latencyMs: 1 },
      redis: { ok: true, latencyMs: 1 },
      clickhouse: { ok: true, latencyMs: 1 },
      rabbitmq: { ok: true, latencyMs: 1 },
      s3: { ok: true, latencyMs: 1 },
      smtp: { ok: true, latencyMs: 1 },
      allOk: true,
    };
    jest.spyOn(setupService, 'checkHealth').mockResolvedValueOnce(allGreen);

    // Reset wizard back to step 6
    const repo = (setupService as any).systemConfigRepo;
    await repo.save(repo.create({ key: 'setup_wizard_step', value: { currentStep: 6, completed: false } }));
    await repo.delete({ key: 'setup_complete' });

    const response = await request(app.getHttpServer()).post('/setup/advance').send({ step: 6, data: {} });

    expect(response.status).toBe(201);

    const status = await request(app.getHttpServer()).get('/setup/status');
    expect(status.body.configured).toBe(true);
    expect(status.body.currentStep).toBe(6);
  });

  test('setup_complete key is written to system_config after wizard completion', async () => {
    const setupCompleteConfig = await (setupService as any).systemConfigRepo.findOne({
      where: { key: 'setup_complete' },
    });

    expect(setupCompleteConfig).not.toBeNull();
    expect(setupCompleteConfig.value.complete).toBe(true);
    expect(setupCompleteConfig.value.completedAt).toBeTruthy();
  });
});
