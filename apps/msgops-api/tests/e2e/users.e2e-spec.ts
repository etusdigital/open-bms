import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { AuthzModule } from '../../src/modules/authz/authz.module';
import { UsersModule } from '../../src/modules/users/users.module';
import { UserEntity } from '../../src/entities/users.entity';
import { UserCredentialsEntity } from '../../src/entities/user-credentials.entity';
import { UserAccountEntity } from '../../src/entities/users-account.entity';
import { AccountEntity } from '../../src/entities/account.entity';
import { RoleEntity } from '../../src/entities/role.entity';
import { ROLE_CODES } from '../../src/modules/authz/authz.constants';

/**
 * E2E for account-scoped user management (Admin da Conta).
 *
 * Requires:
 *  - AUTH_PROVIDER=local
 *  - JWT_SECRET, JWT_AUDIENCE, JWT_ACCESS_TTL, JWT_REFRESH_TTL
 *  - Fresh test DB with migrations applied (roles seeded) — same setup as auth.e2e-spec.ts
 *
 * Seeds (single-account admin so list scoping matches the ACs). listPaginated and the
 * account-scoped detail fetch now scope strictly to the requester's ACTIVE account when
 * one is resolvable server-side (x-account-id header / first membership), falling back to
 * the union of the requester's accounts otherwise — see tech-spec review notes (F12).
 *  - Account "Acme" + Account "Other"
 *  - adminAcme   → admin role, member of Acme only
 *  - editorAcme  → editor role, member of Acme only
 *  - bobMulti    → editor, member of Acme AND Other
 */
describe('Account Users Management (account-scoped) e2e', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const key = Date.now();
  const PASSWORD = 'e2e-password1';

  let acme: AccountEntity;
  let other: AccountEntity;
  let adminAcme: UserEntity;
  let editorAcme: UserEntity;
  let bobMulti: UserEntity;

  let adminToken: string;

  async function seedUser(email: string, name: string, roleCode: string): Promise<UserEntity> {
    const userRepo = dataSource.getRepository(UserEntity);
    const credRepo = dataSource.getRepository(UserCredentialsEntity);
    const roleRepo = dataSource.getRepository(RoleEntity);
    const role = await roleRepo.findOneOrFail({ where: { code: roleCode } });
    const user = await userRepo.save(
      userRepo.create({
        email: email.toLowerCase(),
        name,
        profile: '',
        providerId: `local|${uuidv4()}`,
        status: 'active',
        globalRoleId: role.id,
      } as Partial<UserEntity>),
    );
    await credRepo.save(credRepo.create({ userId: user.id, passwordHash: await bcrypt.hash(PASSWORD, 12) }));
    return user;
  }

  async function addMembership(userId: number, accountId: number, roleCode?: string): Promise<void> {
    const uaRepo = dataSource.getRepository(UserAccountEntity);
    const roleRepo = dataSource.getRepository(RoleEntity);
    let roleOverrideRoleId: number | null = null;
    if (roleCode) {
      roleOverrideRoleId = (await roleRepo.findOneOrFail({ where: { code: roleCode } })).id;
    }
    await uaRepo.save(uaRepo.create({ userId, accountId, isMasterUser: false, roleOverrideRoleId }));
  }

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email: email.toLowerCase(), password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    process.env.AUTH_PROVIDER = 'local';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret-at-least-32-chars-long-!!';
    process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'bms-msgops-api';
    process.env.JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '3600';
    process.env.JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL || '2592000';

    const moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AuthzModule, UsersModule, AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    dataSource = app.get(DataSource);
    const accountRepo = dataSource.getRepository(AccountEntity);

    acme = await accountRepo.save(accountRepo.create({ name: `Acme_${key}`, description: 'acme test', isActive: true, groupId: 1 } as Partial<AccountEntity>));
    other = await accountRepo.save(accountRepo.create({ name: `Other_${key}`, description: 'other test', isActive: true, groupId: 1 } as Partial<AccountEntity>));

    adminAcme = await seedUser(`admin-acme-${key}@example.com`, 'Admin Acme', ROLE_CODES.ADMIN);
    editorAcme = await seedUser(`editor-acme-${key}@example.com`, 'Editor Acme', ROLE_CODES.EDITOR);
    bobMulti = await seedUser(`bob-multi-${key}@example.com`, 'Bob Multi', ROLE_CODES.EDITOR);

    // Single-account admin so list scoping matches AC-4/AC-10.
    await addMembership(adminAcme.id, acme.id, ROLE_CODES.ADMIN);
    await addMembership(editorAcme.id, acme.id, ROLE_CODES.EDITOR);
    await addMembership(bobMulti.id, acme.id, ROLE_CODES.EDITOR);
    await addMembership(bobMulti.id, other.id, ROLE_CODES.EDITOR);

    adminToken = await login(adminAcme.email);
  });

  afterAll(async () => {
    await app?.close();
  });

  // AC-2: admin creates a user with a valid (non-super) role → 201
  test('AC-2: admin creates editor user → 201', async () => {
    const email = `new-editor-${key}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Editor',
        email,
        password: 'temp-password-1',
        accounts: [{ accountId: acme.id, isMasterUser: false, roleOverrideCode: ROLE_CODES.EDITOR }],
      });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email.toLowerCase());

    const ua = await dataSource.getRepository(UserAccountEntity).findOne({ where: { userId: res.body.id, accountId: acme.id } });
    expect(ua).toBeTruthy();
  });

  // AC-6: admin (non-super) creates user with role super_admin → 403
  test('AC-6: admin cannot create super_admin → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Sneaky Super',
        email: `sneaky-${key}@example.com`,
        password: 'temp-password-1',
        globalRoleCode: 'super_admin',
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super_admin/i);

    const created = await dataSource.getRepository(UserEntity).findOne({ where: { email: `sneaky-${key}@example.com` } });
    expect(created).toBeFalsy();
  });

  // AC-3: admin updates a user's role in the account → 200
  test('AC-3: admin updates account role of bob → support', async () => {
    const res = await request(app.getHttpServer())
      .put(`/users/${bobMulti.id}/accounts/${acme.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleOverrideCode: ROLE_CODES.SUPPORT });
    expect([200, 201]).toContain(res.status);

    const roleRepo = dataSource.getRepository(RoleEntity);
    const supportRole = await roleRepo.findOneOrFail({ where: { code: ROLE_CODES.SUPPORT } });
    const ua = await dataSource.getRepository(UserAccountEntity).findOne({ where: { userId: bobMulti.id, accountId: acme.id } });
    expect(ua?.roleOverrideRoleId).toBe(supportRole.id);
  });

  // F1: account admin (isMasterUser=false) GET /users/:id of a same-account user → 200 with role data.
  // editorAcme stays in Acme across the suite (AC-4 only removes bobMulti), so it's a stable subject.
  test('F1: admin loads a same-account user detail with role → 200', async () => {
    const res = await request(app.getHttpServer()).get(`/users/${editorAcme.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(editorAcme.id);
    const membership = (res.body.userAccount ?? []).find((m: { accountId: number }) => m.accountId === acme.id);
    expect(membership).toBeTruthy();
    expect(membership.roleOverride?.code).toBe(ROLE_CODES.EDITOR);
  });

  // F1: account admin GET /users/:id of a user NOT in the admin's account → 404 (out of scope).
  test('F1: admin cannot load a user outside the account scope → 404', async () => {
    const outsider = await seedUser(`outsider-${key}@example.com`, 'Outsider Other', ROLE_CODES.EDITOR);
    await addMembership(outsider.id, other.id, ROLE_CODES.EDITOR);

    const res = await request(app.getHttpServer()).get(`/users/${outsider.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect([403, 404]).toContain(res.status);
  });

  // AC-5/D4 backend coverage: admin cannot set super_admin as an account role → 403
  test('AC-5: admin cannot set super_admin account role → 403', async () => {
    const res = await request(app.getHttpServer())
      .put(`/users/${bobMulti.id}/accounts/${acme.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleOverrideCode: 'super_admin' });
    expect(res.status).toBe(403);
  });

  // AC-4: remove membership from Acme → 204 (or 200); bob remains in Other
  test('AC-4: admin removes bob from Acme; bob stays in Other', async () => {
    const res = await request(app.getHttpServer()).delete(`/users/${bobMulti.id}/accounts/${acme.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);

    const inAcme = await dataSource.getRepository(UserAccountEntity).findOne({ where: { userId: bobMulti.id, accountId: acme.id } });
    expect(inAcme).toBeFalsy();
    const inOther = await dataSource.getRepository(UserAccountEntity).findOne({ where: { userId: bobMulti.id, accountId: other.id } });
    expect(inOther).toBeTruthy();
  });

  // AC-7 backend: admin cannot remove own membership → 403
  test('AC-7: admin cannot remove own membership → 403', async () => {
    const res = await request(app.getHttpServer()).delete(`/users/${adminAcme.id}/accounts/${acme.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  // AC-7 backend: admin cannot change own account role → 403
  test('AC-7: admin cannot change own account role → 403', async () => {
    const res = await request(app.getHttpServer())
      .put(`/users/${adminAcme.id}/accounts/${acme.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleOverrideCode: ROLE_CODES.EDITOR });
    expect(res.status).toBe(403);
  });

  // AC-7 backend: admin cannot self-promote via PUT /users/:id (globalRoleCode) → 403
  test('AC-7: admin cannot self-modify global role → 403', async () => {
    const res = await request(app.getHttpServer()).put(`/users/${adminAcme.id}`).set('Authorization', `Bearer ${adminToken}`).send({ globalRoleCode: 'super_admin' });
    expect(res.status).toBe(403);
  });

  // Existing behavior (AC referenced as "já existia"): admin cannot DELETE a user globally → 403
  test('admin cannot DELETE user globally → 403', async () => {
    const res = await request(app.getHttpServer()).delete(`/users/${editorAcme.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  // AC-9: reset-password remains super-only → 403 for admin
  test('AC-9: admin cannot trigger global reset-password → 403', async () => {
    const res = await request(app.getHttpServer()).post(`/users/${editorAcme.id}/reset-password`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  // AC-10: list is account-scoped — a user in Other-only must not appear
  test('AC-10: list excludes users outside the admin account scope', async () => {
    // carol belongs only to Other (not Acme)
    const carol = await seedUser(`carol-${key}@example.com`, 'Carol Other', ROLE_CODES.EDITOR);
    await addMembership(carol.id, other.id, ROLE_CODES.EDITOR);

    const res = await request(app.getHttpServer()).get('/users').query({ page: 1, itemsPerPage: 100, search: 'Carol' }).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const ids = (res.body.results ?? []).map((u: { id: number }) => u.id);
    expect(ids).not.toContain(carol.id);
  });
});
