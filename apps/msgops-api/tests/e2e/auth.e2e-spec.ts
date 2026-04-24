import { Test } from '@nestjs/testing';
import { INestApplication, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { AuthzModule } from '../../src/modules/authz/authz.module';
import { UsersModule } from '../../src/modules/users/users.module';
import { seedAdmin } from '../../src/bootstrap/seed-admin';

/**
 * End-to-end smoke for the LocalAuthProvider auth flow.
 *
 * Requires:
 *  - AUTH_PROVIDER=local
 *  - JWT_SECRET, JWT_AUDIENCE, JWT_ACCESS_TTL, JWT_REFRESH_TTL
 *  - Empty users table (the suite seeds its own admin via BOOTSTRAP_ADMIN_*)
 *  - Fresh test DB with migrations applied (same setup as accounts.e2e-spec.ts)
 */
describe('Auth (local provider) e2e', () => {
  let app: INestApplication;
  const TEST_EMAIL = `e2e-admin-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'e2e-password1';

  let accessToken: string;
  let refreshCookie: string;

  beforeAll(async () => {
    process.env.AUTH_PROVIDER = 'local';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret-at-least-32-chars-long-!!';
    process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'bms-msgops-api';
    process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '3600';
    process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL || '2592000';
    process.env.BOOTSTRAP_ADMIN_EMAIL = TEST_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = TEST_PASSWORD;

    const moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AuthzModule, UsersModule, AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const ds = app.get(DataSource);
    const envConfig = { get: (key: string, dv?: string) => process.env[key] ?? dv } as any;
    await seedAdmin(ds, envConfig, new Logger('SeedAdmin'));
  });

  afterAll(async () => {
    await app?.close();
  });

  test('POST /auth/login issues access token + httpOnly refresh cookie', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe(TEST_EMAIL);
    const setCookie = (res.headers['set-cookie'] as unknown as string[]) || [];
    const refresh = setCookie.find((c: string) => c.startsWith('bms_refresh='));
    expect(refresh).toBeTruthy();
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/Path=\//i);
    accessToken = res.body.accessToken;
    refreshCookie = refresh!.split(';')[0]; // bms_refresh=<value>
  });

  test('GET /users/me works with bearer token', async () => {
    const res = await request(app.getHttpServer()).get('/users/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_EMAIL);
    expect(res.body.isSuperAdmin).toBe(true);
    expect(res.body.roles).toEqual(expect.arrayContaining(['super_admin']));
  });

  test('POST /auth/refresh rotates cookie + returns new access token', async () => {
    const res = await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', refreshCookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    const setCookie = (res.headers['set-cookie'] as unknown as string[]) || [];
    const newRefresh = setCookie.find((c: string) => c.startsWith('bms_refresh='));
    expect(newRefresh).toBeTruthy();
    const newRefreshValue = newRefresh!.split(';')[0];
    expect(newRefreshValue).not.toBe(refreshCookie);
    // Old cookie must now be rejected
    const reused = await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', refreshCookie);
    expect(reused.status).toBe(401);
    refreshCookie = newRefreshValue;
  });

  test('POST /auth/logout revokes refresh token', async () => {
    const logout = await request(app.getHttpServer()).post('/auth/logout').set('Cookie', refreshCookie);
    expect(logout.status).toBe(201);
    const afterLogout = await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', refreshCookie);
    expect(afterLogout.status).toBe(401);
  });

  test('POST /auth/login with wrong password returns 401 (generic)', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email: TEST_EMAIL, password: 'definitely-wrong-1' });
    expect(res.status).toBe(401);
    expect(res.body.message).not.toMatch(/exist/i);
  });

  test('POST /users/login returns 410 Gone in local mode (AC22)', async () => {
    const res = await request(app.getHttpServer()).post('/users/login').send({ email: TEST_EMAIL });
    expect(res.status).toBe(410);
    expect(res.body.message).toMatch(/deprecated/i);
  });
});
