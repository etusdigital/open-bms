import { Test } from '@nestjs/testing';
import { INestApplication, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { AuthzModule } from '../../src/modules/authz/authz.module';
import { UsersModule } from '../../src/modules/users/users.module';
import { RedisService } from '../../src/providers/redis.provider';
import { seedAdmin } from '../../src/bootstrap/seed-admin';

/**
 * AC23 — logout must invalidate the AuthzService PrincipalContext cache
 * keyed by providerId, so a stale access token can't benefit from the 5-min TTL.
 */
describe('Auth cache invalidation on logout e2e', () => {
  let app: INestApplication;
  let redis: RedisService;
  const TEST_EMAIL = `cache-admin-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'cache-password1';

  beforeAll(async () => {
    process.env.AUTH_PROVIDER = 'local';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret-at-least-32-chars-long-!!';
    process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'bms-msgops-api';
    process.env.BOOTSTRAP_ADMIN_EMAIL = TEST_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = TEST_PASSWORD;

    const moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AuthzModule, UsersModule, AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    await seedAdmin(app.get(DataSource), { get: (k: string, dv?: string) => process.env[k] ?? dv } as any, new Logger('SeedAdmin'));
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await app?.close();
  });

  test('logout removes authz cache keys for the user', async () => {
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    const accessToken: string = login.body.accessToken;
    const providerId: string = login.body.user.providerId;
    const refreshCookie = ((login.headers['set-cookie'] as unknown as string[]) || []).find((c: string) => c.startsWith('bms_refresh='))!.split(';')[0];

    // Warm the cache by hitting a protected endpoint
    const me = await request(app.getHttpServer()).get('/users/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);

    const client = redis.getClient();
    const keysBefore = await client.keys(`authz:user:${providerId}:*`);
    expect(keysBefore.length).toBeGreaterThanOrEqual(1);

    const logout = await request(app.getHttpServer()).post('/auth/logout').set('Cookie', refreshCookie);
    expect(logout.status).toBe(201);

    const keysAfter = await client.keys(`authz:user:${providerId}:*`);
    expect(keysAfter.length).toBe(0);
  });
});
