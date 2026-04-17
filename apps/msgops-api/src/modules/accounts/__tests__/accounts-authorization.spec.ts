import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AccountsController } from '../accounts.controller';
import { AccountsService } from '../accounts.service';
import { ApiKeyRegenService } from '../api-key-regen.service';

// Minimal mocks — we're testing authorization, not business logic
const mockAccountsService = {
  getAllAccounts: jest.fn().mockResolvedValue([]),
  destroy: jest.fn().mockResolvedValue({ message: 'Account deleted successfully' }),
  findOne: jest.fn().mockResolvedValue({ id: 1, name: 'test' }),
  update: jest.fn().mockResolvedValue({ id: 1 }),
  createOrUpdateAccountsConfigs: jest.fn().mockResolvedValue({}),
  findConfig: jest.fn().mockResolvedValue({}),
  updateAccountConfig: jest.fn().mockResolvedValue({}),
  getApiKeysByAccount: jest.fn().mockResolvedValue([]),
  deleteApiKeyByAccount: jest.fn().mockResolvedValue({}),
  getConfigs: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: 1, name: 'test' }),
  getSendgridAccounts: jest.fn().mockResolvedValue([]),
};

const mockApiKeyRegenService = {
  requestRegeneration: jest.fn().mockResolvedValue(undefined),
  confirmRegeneration: jest.fn().mockResolvedValue({}),
  getKeyStatus: jest.fn().mockResolvedValue({}),
};

describe('AccountsController — authorization', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        { provide: AccountsService, useValue: mockAccountsService },
        { provide: ApiKeyRegenService, useValue: mockApiKeyRegenService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // Middleware to simulate authzContext from x-test-authz header
    app.use((req, res, next) => {
      const header = req.headers['x-test-authz'];
      if (header) {
        try {
          req.authzContext = JSON.parse(header as string);
        } catch {
          // ignore malformed header
        }
      }
      next();
    });

    await app.init();
  });

  afterEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await app.close();
  });

  describe('GET /accounts/all — super_admin only', () => {
    it('returns 403 when authzContext is not super_admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/all')
        .set('x-test-authz', JSON.stringify({ isSuperAdmin: false, accountId: 1 }));

      expect(res.status).toBe(403);
    });

    it('returns 200 when authzContext is super_admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/all')
        .set('x-test-authz', JSON.stringify({ isSuperAdmin: true }));

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /accounts/:id — super_admin only', () => {
    it('returns 403 when authzContext is not super_admin', async () => {
      const res = await request(app.getHttpServer())
        .delete('/accounts/999')
        .set('x-test-authz', JSON.stringify({ isSuperAdmin: false, accountId: 1 }));

      expect(res.status).toBe(403);
    });

    it('returns 200 when authzContext is super_admin', async () => {
      const res = await request(app.getHttpServer())
        .delete('/accounts/999')
        .set('x-test-authz', JSON.stringify({ isSuperAdmin: true }));

      expect(res.status).toBe(200);
    });

    it('returns 403 when no authzContext is present', async () => {
      const res = await request(app.getHttpServer()).delete('/accounts/999');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /accounts/:id — requires settings_view + account scope', () => {
    it('returns 403 when accessing different account (scope check)', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/999')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:settings_view'],
          }),
        );

      expect(res.status).toBe(403);
    });

    it('returns 200 when accessing own account', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/1')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:settings_view'],
          }),
        );

      expect(res.status).toBe(200);
    });

    it('returns 200 when super_admin accesses any account', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/999')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: true,
            permissions: ['account:settings_view'],
          }),
        );

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /accounts/:id — requires settings_update + account scope', () => {
    it('returns 403 when accessing different account (scope check)', async () => {
      const res = await request(app.getHttpServer())
        .put('/accounts/999')
        .send({ name: 'test' })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:settings_update'],
          }),
        );

      expect(res.status).toBe(403);
    });

    it('returns 200 when accessing own account', async () => {
      const res = await request(app.getHttpServer())
        .put('/accounts/1')
        .send({ name: 'test' })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:settings_update'],
          }),
        );

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /accounts/providers/:id — requires settings_update + account scope', () => {
    it('returns 403 when accessing different account (scope check)', async () => {
      const res = await request(app.getHttpServer())
        .put('/accounts/providers/999')
        .send({ provider: 'test' })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:settings_update'],
          }),
        );

      expect(res.status).toBe(403);
    });

    it('returns 200 when accessing own account', async () => {
      const res = await request(app.getHttpServer())
        .put('/accounts/providers/1')
        .send({ provider: 'test' })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:settings_update'],
          }),
        );

      expect(res.status).toBe(200);
    });
  });

  describe('Scope-checked endpoints — no authzContext returns 403', () => {
    it('GET /accounts/:id returns 403 when no authzContext is present', async () => {
      const res = await request(app.getHttpServer()).get('/accounts/1');
      expect(res.status).toBe(403);
    });

    it('PUT /accounts/:id returns 403 when no authzContext is present', async () => {
      const res = await request(app.getHttpServer()).put('/accounts/1').send({ name: 'test' });
      expect(res.status).toBe(403);
    });

    it('PUT /accounts/providers/:id returns 403 when no authzContext is present', async () => {
      const res = await request(app.getHttpServer()).put('/accounts/providers/1').send({ provider: 'test' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /accounts/config/:name — requires settings_view', () => {
    it('returns 200 with valid authz context', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/config/some-config')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:settings_view'],
          }),
        );

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /accounts/config/:name — requires settings_update', () => {
    it('returns 200 with valid authz context', async () => {
      const res = await request(app.getHttpServer())
        .put('/accounts/config/some-config')
        .send({ value: 'test' })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:settings_update'],
          }),
        );

      expect(res.status).toBe(200);
    });
  });

  describe('GET /accounts/api-keys/:id — requires api_keys_view + account scope', () => {
    it('returns 403 when accessing different account', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/api-keys/999')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:api_keys_view'],
          }),
        );

      expect(res.status).toBe(403);
    });

    it('returns 403 when no authzContext is present', async () => {
      const res = await request(app.getHttpServer()).get('/accounts/api-keys/1');
      expect(res.status).toBe(403);
    });

    it('returns 200 when accessing own account', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/api-keys/1')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:api_keys_view'],
          }),
        );

      expect(res.status).toBe(200);
    });

    it('returns 200 when super_admin accesses any account', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/api-keys/999')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: true,
            permissions: ['account:api_keys_view'],
          }),
        );

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /accounts/api-keys — requires api_keys_revoke + account scope', () => {
    it('returns 403 without permission (no authzContext)', async () => {
      const res = await request(app.getHttpServer()).delete('/accounts/api-keys').query({ accountId: 1, id: 1 });

      expect(res.status).toBe(403);
    });

    it('returns 403 when accessing different account via query param', async () => {
      const res = await request(app.getHttpServer())
        .delete('/accounts/api-keys')
        .query({ accountId: 999, id: 1 })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:api_keys_revoke'],
          }),
        );

      expect(res.status).toBe(403);
    });

    it('returns 400 when accountId query param is missing', async () => {
      const res = await request(app.getHttpServer())
        .delete('/accounts/api-keys')
        .set('x-test-authz', JSON.stringify({ isSuperAdmin: false, accountId: 1, permissions: ['account:api_keys_revoke'] }));
      expect(res.status).toBe(400);
    });

    it('returns 200 when accessing own account', async () => {
      const res = await request(app.getHttpServer())
        .delete('/accounts/api-keys')
        .query({ accountId: 1, id: 1 })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:api_keys_revoke'],
          }),
        );

      expect(res.status).toBe(200);
    });
  });

  describe('POST /accounts/:id/api-keys/request-regen — requires api_keys_rotate + scope', () => {
    it('returns 403 when accessing different account', async () => {
      const res = await request(app.getHttpServer())
        .post('/accounts/999/api-keys/request-regen')
        .send({ keyType: 'public' })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:api_keys_rotate'],
          }),
        );

      expect(res.status).toBe(403);
    });

    it('returns 403 when no authzContext is present', async () => {
      const res = await request(app.getHttpServer()).post('/accounts/1/api-keys/request-regen').send({ keyType: 'public' });

      expect(res.status).toBe(403);
    });

    it('returns 201 when accessing own account', async () => {
      const res = await request(app.getHttpServer())
        .post('/accounts/1/api-keys/request-regen')
        .send({ keyType: 'public' })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:api_keys_rotate'],
          }),
        );

      expect(res.status).toBe(201);
    });
  });

  describe('POST /accounts/:id/api-keys/confirm-regen — requires api_keys_rotate + scope', () => {
    it('returns 403 when accessing different account', async () => {
      const res = await request(app.getHttpServer())
        .post('/accounts/999/api-keys/confirm-regen')
        .send({ keyType: 'public', token: 'abc123' })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:api_keys_rotate'],
          }),
        );

      expect(res.status).toBe(403);
    });

    it('returns 403 when no authzContext is present', async () => {
      const res = await request(app.getHttpServer()).post('/accounts/1/api-keys/confirm-regen').send({ keyType: 'public', token: 'abc123' });

      expect(res.status).toBe(403);
    });

    it('returns 201 when accessing own account', async () => {
      const res = await request(app.getHttpServer())
        .post('/accounts/1/api-keys/confirm-regen')
        .send({ keyType: 'public', token: 'abc123' })
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:api_keys_rotate'],
          }),
        );

      expect(res.status).toBe(201);
    });
  });

  describe('GET /accounts/:id/api-keys/status — requires api_keys_view + scope', () => {
    it('returns 403 when accessing different account', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/999/api-keys/status')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:api_keys_view'],
          }),
        );

      expect(res.status).toBe(403);
    });

    it('returns 403 when no authzContext is present', async () => {
      const res = await request(app.getHttpServer()).get('/accounts/1/api-keys/status');
      expect(res.status).toBe(403);
    });

    it('returns 200 when accessing own account', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/1/api-keys/status')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 1,
            permissions: ['account:api_keys_view'],
          }),
        );

      expect(res.status).toBe(200);
    });

    it('returns 200 when super_admin accesses any account', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/999/api-keys/status')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: true,
            permissions: ['account:api_keys_view'],
          }),
        );

      expect(res.status).toBe(200);
    });
  });

  describe('POST /accounts — super_admin only', () => {
    it('returns 403 when not super_admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/accounts')
        .send({ name: 'test', defaultDomain: 'test.com' })
        .set('x-test-authz', JSON.stringify({ isSuperAdmin: false, accountId: 1 }));

      expect(res.status).toBe(403);
    });

    it('returns 201 when super_admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/accounts')
        .send({ name: 'test', defaultDomain: 'test.com' })
        .set('x-test-authz', JSON.stringify({ isSuperAdmin: true }));

      expect(res.status).toBe(201);
    });

    it('returns 403 when no authzContext is present', async () => {
      const res = await request(app.getHttpServer()).post('/accounts').send({ name: 'test', defaultDomain: 'test.com' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /accounts/sendgrid-subusers — super_admin only', () => {
    it('returns 403 when not super_admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/sendgrid-subusers')
        .set('x-test-authz', JSON.stringify({ isSuperAdmin: false, accountId: 1 }));

      expect(res.status).toBe(403);
    });

    it('returns 200 when super_admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/sendgrid-subusers')
        .set('x-test-authz', JSON.stringify({ isSuperAdmin: true }));

      expect(res.status).toBe(200);
    });

    it('returns 403 when no authzContext is present', async () => {
      const res = await request(app.getHttpServer()).get('/accounts/sendgrid-subusers');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /accounts/configs — scoped to account', () => {
    it('passes accountId from authzContext to service when not super_admin', async () => {
      await request(app.getHttpServer())
        .get('/accounts/configs')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: false,
            accountId: 42,
            permissions: [],
          }),
        );

      expect(mockAccountsService.getConfigs).toHaveBeenCalledWith(42);
    });

    it('passes accountId from authzContext to service for super_admin with selected account', async () => {
      await request(app.getHttpServer())
        .get('/accounts/configs')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: true,
            accountId: 7,
            permissions: [],
          }),
        );

      expect(mockAccountsService.getConfigs).toHaveBeenCalledWith(7);
    });

    it('returns 403 when super_admin has no selected account', async () => {
      const res = await request(app.getHttpServer())
        .get('/accounts/configs')
        .set(
          'x-test-authz',
          JSON.stringify({
            isSuperAdmin: true,
            permissions: [],
          }),
        );

      expect(res.status).toBe(403);
    });
  });
});
