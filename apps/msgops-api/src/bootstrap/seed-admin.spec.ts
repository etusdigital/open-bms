import { Logger } from '@nestjs/common';
import { seedAdmin, SimpleConfigService } from './seed-admin';

type QueryHandler = (sql: string, params?: any[]) => Promise<any>;

function makeRepo(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
    ...overrides,
  };
}

function makeQueryRunner(queryHandler: QueryHandler, repos: Record<string, any>) {
  const runner: any = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(queryHandler),
    isTransactionActive: true,
    manager: {
      getRepository: jest.fn((entityOrName: any) => {
        const name = typeof entityOrName === 'function' ? entityOrName.name : String(entityOrName);
        return repos[name];
      }),
    },
  };
  return runner;
}

function makeConfig(values: Record<string, string | undefined>): SimpleConfigService {
  return {
    get: ((key: string, defaultValue?: string) => values[key] ?? defaultValue) as any,
  };
}

const silentLogger = new Logger('test-seed');
jest.spyOn(silentLogger, 'log').mockImplementation(() => undefined);
jest.spyOn(silentLogger, 'warn').mockImplementation(() => undefined);

describe('seedAdmin', () => {
  it('skips when users table is not empty', async () => {
    const userRepo = makeRepo();
    const credRepo = makeRepo();
    const roleRepo = makeRepo();
    const runner = makeQueryRunner(
      async (sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) return [];
        if (sql.includes('SELECT COUNT')) return [{ count: '5' }];
        return [];
      },
      { UserEntity: userRepo, UserCredentialsEntity: credRepo, RoleEntity: roleRepo },
    );
    const dataSource: any = { createQueryRunner: () => runner };

    await expect(seedAdmin(dataSource, makeConfig({ BOOTSTRAP_ADMIN_EMAIL: 'a@b.com', BOOTSTRAP_ADMIN_PASSWORD: 'password1' }), silentLogger)).resolves.toBeUndefined();

    expect(userRepo.save).not.toHaveBeenCalled();
    expect(runner.commitTransaction).toHaveBeenCalled();
  });

  it('skips silently when envs are missing and users table is empty (setup wizard will handle first admin)', async () => {
    const userRepo = makeRepo();
    const credRepo = makeRepo();
    const roleRepo = makeRepo();
    const runner = makeQueryRunner(
      async (sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) return [];
        if (sql.includes('SELECT COUNT')) return [{ count: '0' }];
        return [];
      },
      { UserEntity: userRepo, UserCredentialsEntity: credRepo, RoleEntity: roleRepo },
    );
    const dataSource: any = { createQueryRunner: () => runner };

    await expect(seedAdmin(dataSource, makeConfig({}), silentLogger)).resolves.toBeUndefined();
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 8 chars (AC11b)', async () => {
    const userRepo = makeRepo();
    const credRepo = makeRepo();
    const roleRepo = makeRepo();
    const runner = makeQueryRunner(
      async (sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) return [];
        if (sql.includes('SELECT COUNT')) return [{ count: '0' }];
        return [];
      },
      { UserEntity: userRepo, UserCredentialsEntity: credRepo, RoleEntity: roleRepo },
    );
    const dataSource: any = { createQueryRunner: () => runner };

    await expect(seedAdmin(dataSource, makeConfig({ BOOTSTRAP_ADMIN_EMAIL: 'a@b.com', BOOTSTRAP_ADMIN_PASSWORD: 'short' }), silentLogger)).rejects.toThrow(/at least 8/);
    expect(runner.rollbackTransaction).toHaveBeenCalled();
  });

  it('throws when super_admin role is missing (RBAC seed not run)', async () => {
    const userRepo = makeRepo();
    const credRepo = makeRepo();
    const roleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const runner = makeQueryRunner(
      async (sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) return [];
        if (sql.includes('SELECT COUNT')) return [{ count: '0' }];
        return [];
      },
      { UserEntity: userRepo, UserCredentialsEntity: credRepo, RoleEntity: roleRepo },
    );
    const dataSource: any = { createQueryRunner: () => runner };

    await expect(seedAdmin(dataSource, makeConfig({ BOOTSTRAP_ADMIN_EMAIL: 'a@b.com', BOOTSTRAP_ADMIN_PASSWORD: 'password1' }), silentLogger)).rejects.toThrow(/RBAC seed missing/);
  });

  it('creates admin with bcrypt-hashed password when DB is empty and envs are present', async () => {
    const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 99 }) });
    const credRepo = makeRepo();
    const roleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 1, code: 'super_admin' }) });
    const runner = makeQueryRunner(
      async (sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) return [];
        if (sql.includes('SELECT COUNT')) return [{ count: '0' }];
        return [];
      },
      { UserEntity: userRepo, UserCredentialsEntity: credRepo, RoleEntity: roleRepo },
    );
    const dataSource: any = { createQueryRunner: () => runner };

    await seedAdmin(dataSource, makeConfig({ BOOTSTRAP_ADMIN_EMAIL: 'Admin@Acme.COM', BOOTSTRAP_ADMIN_PASSWORD: 'password1' }), silentLogger);

    expect(userRepo.save).toHaveBeenCalledTimes(1);
    const savedUser = userRepo.save.mock.calls[0][0];
    expect(savedUser.email).toBe('admin@acme.com'); // normalized lowercase
    expect(savedUser.providerId).toMatch(/^local\|/);
    expect(savedUser.globalRoleId).toBe(1);

    expect(credRepo.save).toHaveBeenCalledTimes(1);
    const savedCred = credRepo.save.mock.calls[0][0];
    expect(savedCred.userId).toBe(99);
    expect(savedCred.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt prefix

    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [expect.any(Number)]);
  });

  it('releases queryRunner even when the inner transaction throws', async () => {
    const userRepo = makeRepo({ save: jest.fn().mockRejectedValue(new Error('DB exploded')) });
    const credRepo = makeRepo();
    const roleRepo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 1, code: 'super_admin' }) });
    const runner = makeQueryRunner(
      async (sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) return [];
        if (sql.includes('SELECT COUNT')) return [{ count: '0' }];
        return [];
      },
      { UserEntity: userRepo, UserCredentialsEntity: credRepo, RoleEntity: roleRepo },
    );
    const dataSource: any = { createQueryRunner: () => runner };

    await expect(seedAdmin(dataSource, makeConfig({ BOOTSTRAP_ADMIN_EMAIL: 'a@b.com', BOOTSTRAP_ADMIN_PASSWORD: 'password1' }), silentLogger)).rejects.toThrow('DB exploded');
    expect(runner.release).toHaveBeenCalled();
  });
});
