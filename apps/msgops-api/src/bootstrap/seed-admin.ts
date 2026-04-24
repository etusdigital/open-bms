import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserEntity } from '../entities/users.entity';
import { UserCredentialsEntity } from '../entities/user-credentials.entity';
import { RoleEntity } from '../entities/role.entity';
import { ROLE_CODES } from '../modules/authz/authz.constants';

const ADVISORY_LOCK_KEY = 834729;
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

export interface SimpleConfigService {
  get(key: string): string | undefined;
  get(key: string, defaultValue: string): string;
}

export async function seedAdmin(dataSource: DataSource, config: SimpleConfigService, logger: Logger): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [ADVISORY_LOCK_KEY]);

    const countRows: Array<{ count: string }> = await queryRunner.query(`SELECT COUNT(*)::text AS count FROM users WHERE deleted_at IS NULL`);
    const existing = parseInt(countRows[0]?.count || '0', 10);
    if (existing > 0) {
      await queryRunner.commitTransaction();
      logger.log('Bootstrap admin: skipped (users table not empty)');
      return;
    }

    const email = (config.get as any)('BOOTSTRAP_ADMIN_EMAIL') as string | undefined;
    const password = (config.get as any)('BOOTSTRAP_ADMIN_PASSWORD') as string | undefined;

    if (!email || !password) {
      await queryRunner.commitTransaction();
      logger.log('Bootstrap admin: skipped (no BOOTSTRAP_ADMIN_* envs — setup wizard will create the first admin)');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      await queryRunner.rollbackTransaction();
      throw new Error(`BOOTSTRAP_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters (to match /auth/login DTO)`);
    }

    const roleRepo = queryRunner.manager.getRepository(RoleEntity);
    const superAdminRole = await roleRepo.findOne({ where: { code: ROLE_CODES.SUPER_ADMIN } });
    if (!superAdminRole) {
      await queryRunner.rollbackTransaction();
      throw new Error('RBAC seed missing — run migrations first');
    }

    const providerId = `local|${uuidv4()}`;
    const userRepo = queryRunner.manager.getRepository(UserEntity);
    const credentialsRepo = queryRunner.manager.getRepository(UserCredentialsEntity);
    const normalizedEmail = email.toLowerCase();

    const savedUser = await userRepo.save(
      userRepo.create({
        email: normalizedEmail,
        name: 'Admin',
        profile: '',
        providerId,
        status: 'active',
        globalRoleId: superAdminRole.id,
      } as Partial<UserEntity>),
    );

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await credentialsRepo.save(credentialsRepo.create({ userId: savedUser.id, passwordHash: hash }));

    await queryRunner.commitTransaction();
    logger.log(`Bootstrap admin created: ${normalizedEmail}`);
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction().catch(() => null);
    }
    throw error;
  } finally {
    await queryRunner.release();
  }
}
