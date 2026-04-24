import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { seedAdmin } from '../../src/bootstrap/seed-admin';
import { UserEntity } from '../../src/entities/users.entity';
import { UserCredentialsEntity } from '../../src/entities/user-credentials.entity';

/**
 * AC21 — Two concurrent seedAdmin calls must produce exactly one admin,
 * protected by pg_advisory_xact_lock. Requires fresh test DB (empty users table).
 */
describe('seedAdmin race (multi-replica) e2e', () => {
  let dataSource: DataSource;
  const TEST_EMAIL = `race-admin-${Date.now()}@example.com`;

  beforeAll(async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = TEST_EMAIL;
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'race-password1';

    const moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot()],
    }).compile();
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      // clean up
      await dataSource.getRepository(UserCredentialsEntity).createQueryBuilder().delete().from(UserCredentialsEntity).execute();
      await dataSource.getRepository(UserEntity).createQueryBuilder().delete().from(UserEntity).where('email = :e', { e: TEST_EMAIL }).execute();
      await dataSource.destroy();
    }
  });

  test('two concurrent seedAdmin calls produce exactly one admin row', async () => {
    const envConfig = { get: (key: string, dv?: string) => process.env[key] ?? dv } as any;
    const loggerA = new Logger('SeedA');
    const loggerB = new Logger('SeedB');

    const results = await Promise.allSettled([seedAdmin(dataSource, envConfig, loggerA), seedAdmin(dataSource, envConfig, loggerB)]);

    // No call must throw (either creates, the other skips)
    for (const r of results) {
      expect(r.status).toBe('fulfilled');
    }

    const count = await dataSource.getRepository(UserEntity).createQueryBuilder('u').where('u.email = :e', { e: TEST_EMAIL }).getCount();
    expect(count).toBe(1);
  });
});
