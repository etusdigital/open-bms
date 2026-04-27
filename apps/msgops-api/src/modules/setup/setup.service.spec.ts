import { BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { SystemConfigEntity } from '../../entities/system-config.entity';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
import { UserEntity } from '../../entities/users.entity';
import { RoleEntity } from '../../entities/role.entity';
import { AccountEntity } from '../../entities/account.entity';
import { PoolEntity } from '../../entities/pool.entity';
import { UserAccountEntity } from '../../entities/users-account.entity';
import { AUTH_PROVIDER_TOKEN, IAuthProvider } from '../auth/providers/auth.provider.interface';
import { ROLE_CODES } from '../authz/authz.constants';
import { SetupService } from './setup.service';

const SUPER_ADMIN_ROLE = { id: 42, code: ROLE_CODES.SUPER_ADMIN };

function makeRepo<T = any>(overrides: Partial<T> = {}): any {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    count: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn((v) => ({ id: 1, ...v })),
    remove: jest.fn(),
    ...overrides,
  };
}

function makeAuthProvider(overrides: Partial<IAuthProvider> = {}): jest.Mocked<IAuthProvider> {
  return {
    createUser: jest.fn().mockResolvedValue({ providerId: 'local|abc' }),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    verifyToken: jest.fn(),
    supportsCredentialLogin: jest.fn().mockReturnValue(true),
    ...overrides,
  } as any;
}

/**
 * Builds a minimal DataSource mock whose `transaction(cb)` runs `cb(em)` with an
 * EntityManager stub that routes `getRepository(Entity)` to the same repo instances the
 * service already has injected. This means tests can assert on a single repo across both
 * transactional and non-transactional code paths without having to track two copies.
 */
function makeDataSourceMock(repos: { userRepo: any; roleRepo: any; systemConfigRepo: any }): any {
  return {
    transaction: async (cb: (em: any) => Promise<void>) => {
      const em = {
        query: jest.fn().mockResolvedValue(undefined),
        getRepository: (entity: any) => {
          if (entity === UserEntity) return repos.userRepo;
          if (entity === RoleEntity) return repos.roleRepo;
          if (entity === SystemConfigEntity) return repos.systemConfigRepo;
          throw new Error(`unexpected getRepository in test for ${entity?.name}`);
        },
      };
      await cb(em);
    },
  };
}

async function buildService(
  overrides: {
    systemConfigRepo?: any;
    userRepo?: any;
    roleRepo?: any;
    accountRepo?: any;
    poolRepo?: any;
    userAccountRepo?: any;
  } = {},
  authProvider: IAuthProvider = makeAuthProvider(),
): Promise<{
  service: SetupService;
  systemConfigRepo: any;
  userRepo: any;
  roleRepo: any;
  accountRepo: any;
  poolRepo: any;
  userAccountRepo: any;
  authProvider: jest.Mocked<IAuthProvider>;
  dataSource: any;
}> {
  const systemConfigRepo = overrides.systemConfigRepo ?? makeRepo();
  const userRepo = overrides.userRepo ?? makeRepo();
  const roleRepo = overrides.roleRepo ?? makeRepo();
  const accountRepo = overrides.accountRepo ?? makeRepo();
  const poolRepo = overrides.poolRepo ?? makeRepo();
  const userAccountRepo = overrides.userAccountRepo ?? makeRepo();
  const dataSource = makeDataSourceMock({ userRepo, roleRepo, systemConfigRepo });

  const moduleRef = await Test.createTestingModule({
    providers: [
      SetupService,
      { provide: getDataSourceToken(), useValue: dataSource },
      { provide: getRepositoryToken(SystemConfigEntity), useValue: systemConfigRepo },
      { provide: getRepositoryToken(UserEntity), useValue: userRepo },
      { provide: getRepositoryToken(RoleEntity), useValue: roleRepo },
      { provide: getRepositoryToken(AccountEntity), useValue: accountRepo },
      { provide: getRepositoryToken(PoolEntity), useValue: poolRepo },
      { provide: getRepositoryToken(UserAccountEntity), useValue: userAccountRepo },
      { provide: AUTH_PROVIDER_TOKEN, useValue: authProvider },
    ],
  }).compile();

  return {
    service: moduleRef.get(SetupService),
    systemConfigRepo,
    userRepo,
    roleRepo,
    accountRepo,
    poolRepo,
    userAccountRepo,
    authProvider: authProvider as jest.Mocked<IAuthProvider>,
    dataSource,
  };
}

describe('SetupService', () => {
  describe('getStatus', () => {
    it('returns step 1 when no super admin exists in the database', async () => {
      const { service, roleRepo, userRepo, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue(undefined);
      roleRepo.findOne.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.count.mockResolvedValue(0);

      const status = await service.getStatus();
      expect(status).toEqual({ configured: false, currentStep: 1 });
    });

    it('returns step 1 when admins exist but wizard key is absent', async () => {
      const { service, roleRepo, userRepo, systemConfigRepo } = await buildService();
      roleRepo.findOne.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.count.mockResolvedValue(1);
      systemConfigRepo.findOne.mockResolvedValue(undefined);

      const status = await service.getStatus();
      expect(status).toEqual({ configured: false, currentStep: 1 });
    });

    it('returns the persisted currentStep while wizard is incomplete', async () => {
      const { service, roleRepo, userRepo, systemConfigRepo } = await buildService();
      roleRepo.findOne.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.count.mockResolvedValue(1);
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 3, completed: false } });

      const status = await service.getStatus();
      expect(status).toEqual({ configured: false, currentStep: 3 });
    });

    it('returns configured=true once wizard is marked completed', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 5, completed: true } });

      const status = await service.getStatus();
      expect(status).toEqual({ configured: true, currentStep: 5 });
    });
  });

  describe('advanceStep — guards', () => {
    it('rejects all advance calls with 403 once wizard is completed', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 5, completed: true } });

      for (const step of [1, 2, 3, 4, 5] as const) {
        await expect(service.advanceStep({ step, data: {} as any })).rejects.toBeInstanceOf(ForbiddenException);
      }
    });

    it('rejects out-of-order steps (POST step=5 when currentStep is still 2)', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 2, completed: false } });

      await expect(
        service.advanceStep({
          step: 5,
          data: { accountName: 'A', poolName: 'P', senderEmail: 'a@b.io', senderName: 'A', replyToEmail: 'a@b.io', sendingLimit: 1 } as any,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows resubmitting the current step (idempotent re-run)', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 2, completed: false } });

      await expect(service.advanceStep({ step: 2, data: { host: 'h', port: 25, user: 'u', pass: 'p', from: 'a@b.io' } as any })).resolves.toBeUndefined();
    });
  });

  describe('advanceStep validation', () => {
    it('throws BadRequestException on invalid step1 payload (short password)', async () => {
      const { service } = await buildService();
      await expect(service.advanceStep({ step: 1, data: { name: 'A', email: 'a@b.io', password: 'short' } as any })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException on invalid email syntax (missing @)', async () => {
      const { service } = await buildService();
      await expect(service.advanceStep({ step: 1, data: { name: 'A', email: 'not-an-email', password: 'password1' } as any })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('normalizes step1 email to lowercase before lookup and createUser', async () => {
      const { service, roleRepo, userRepo, authProvider } = await buildService();
      roleRepo.findOneOrFail.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.findOne.mockResolvedValue(undefined);

      await service.advanceStep({ step: 1, data: { name: 'Admin', email: '  Admin@BMS.Local  ', password: 'password1' } as any });

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'admin@bms.local' } });
      expect(authProvider.createUser).toHaveBeenCalledWith({ name: 'Admin', email: 'admin@bms.local', password: 'password1' });
    });

    it('accepts .local TLD in step1 email', async () => {
      const { service, roleRepo, userRepo, authProvider } = await buildService();
      roleRepo.findOneOrFail.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.findOne.mockResolvedValue(undefined);

      await service.advanceStep({ step: 1, data: { name: 'Admin', email: 'admin@bms.local', password: 'password1' } as any });
      expect(authProvider.createUser).toHaveBeenCalledWith({ name: 'Admin', email: 'admin@bms.local', password: 'password1' });
    });

    it('rejects step2 port above 65535', async () => {
      const { service } = await buildService();
      await expect(service.advanceStep({ step: 2, data: { host: 'smtp.x.io', port: 99999, user: 'u', pass: 'p', from: 'a@b.io' } as any })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects step3 baseUrl with non-http scheme', async () => {
      const { service } = await buildService();
      await expect(service.advanceStep({ step: 3, data: { baseUrl: 'ftp://bad.example' } as any })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('step1 — create admin', () => {
    it('acquires advisory lock, creates user via authProvider, persists credentials, advances wizard + stores adminUserId', async () => {
      const systemConfigRepo = makeRepo();
      const userRepo = makeRepo({ save: jest.fn().mockResolvedValue({ id: 17 }) });
      const roleRepo = makeRepo();
      roleRepo.findOneOrFail.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.findOne.mockResolvedValue(undefined);
      systemConfigRepo.findOne.mockResolvedValue(undefined);

      const queryMock = jest.fn().mockResolvedValue(undefined);
      const dataSource = {
        transaction: async (cb: any) => {
          await cb({
            query: queryMock,
            getRepository: (entity: any) => {
              if (entity === UserEntity) return userRepo;
              if (entity === RoleEntity) return roleRepo;
              if (entity === SystemConfigEntity) return systemConfigRepo;
              throw new Error('unexpected entity');
            },
          });
        },
      };

      const authProvider = makeAuthProvider();

      const moduleRef = await Test.createTestingModule({
        providers: [
          SetupService,
          { provide: getDataSourceToken(), useValue: dataSource },
          { provide: getRepositoryToken(SystemConfigEntity), useValue: systemConfigRepo },
          { provide: getRepositoryToken(UserEntity), useValue: userRepo },
          { provide: getRepositoryToken(RoleEntity), useValue: roleRepo },
          { provide: getRepositoryToken(AccountEntity), useValue: makeRepo() },
          { provide: getRepositoryToken(PoolEntity), useValue: makeRepo() },
          { provide: getRepositoryToken(UserAccountEntity), useValue: makeRepo() },
          { provide: AUTH_PROVIDER_TOKEN, useValue: authProvider },
        ],
      }).compile();
      const service = moduleRef.get(SetupService);

      await service.advanceStep({ step: 1, data: { name: 'Admin', email: 'admin@bms.io', password: 'password1' } as any });

      expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [834729]);
      expect(authProvider.createUser).toHaveBeenCalledWith({ name: 'Admin', email: 'admin@bms.io', password: 'password1' });
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ email: 'admin@bms.io', providerId: 'local|abc', globalRoleId: SUPER_ADMIN_ROLE.id }));
      expect(authProvider.updatePassword).toHaveBeenCalledWith('local|abc', 'password1', expect.objectContaining({ getRepository: expect.any(Function) }));
      expect(systemConfigRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'setup_wizard_step', value: expect.objectContaining({ currentStep: 2, completed: false, adminUserId: 17 }) }),
      );
    });

    it('is idempotent when user with same email already exists (no duplicate user + no password reset) and still records adminUserId', async () => {
      const { service, userRepo, systemConfigRepo, authProvider } = await buildService();
      userRepo.findOne.mockResolvedValue({ id: 9, email: 'admin@bms.io' });
      systemConfigRepo.findOne.mockResolvedValue(undefined);

      await service.advanceStep({ step: 1, data: { name: 'Admin', email: 'admin@bms.io', password: 'password1' } as any });

      expect(authProvider.createUser).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
      expect(authProvider.updatePassword).not.toHaveBeenCalled();
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ value: expect.objectContaining({ currentStep: 2, completed: false, adminUserId: 9 }) }));
    });

    it('skips credential persistence when auth provider does not support credential login', async () => {
      const authProvider = makeAuthProvider({ supportsCredentialLogin: jest.fn().mockReturnValue(false) } as any);
      const { service, roleRepo, userRepo } = await buildService({}, authProvider);
      roleRepo.findOneOrFail.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.findOne.mockResolvedValue(undefined);

      await service.advanceStep({ step: 1, data: { name: 'Admin', email: 'admin@bms.io', password: 'password1' } as any });

      expect(authProvider.createUser).toHaveBeenCalled();
      expect(authProvider.updatePassword).not.toHaveBeenCalled();
    });

    it('rolls back the user row when updatePassword fails (no orphan user left behind)', async () => {
      const authProvider = makeAuthProvider({ updatePassword: jest.fn().mockRejectedValue(new Error('kms unavailable')) } as any);
      const { service, roleRepo, userRepo } = await buildService({}, authProvider);
      roleRepo.findOneOrFail.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.findOne.mockResolvedValue(undefined);
      userRepo.save.mockResolvedValue({ id: 99, email: 'admin@bms.io' });

      await expect(service.advanceStep({ step: 1, data: { name: 'Admin', email: 'admin@bms.io', password: 'password1' } as any })).rejects.toThrow(/kms unavailable/);
      expect(userRepo.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 99 }));
    });
  });

  describe('step2 / step3 — config persistence', () => {
    it('step2 persists smtp_settings and advances to step 3', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 2, completed: false } });
      const smtp = { host: 'smtp.bms.io', port: 587, user: 'u', pass: 'p', from: 'noreply@bms.io' };

      await service.advanceStep({ step: 2, data: smtp as any });
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ key: 'smtp_settings', value: smtp }));
      expect(systemConfigRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'setup_wizard_step', value: expect.objectContaining({ currentStep: 3, completed: false }) }),
      );
    });

    it('step3 persists domain_settings and advances to step 4', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 3, completed: false } });

      await service.advanceStep({ step: 3, data: { baseUrl: 'https://bms.io' } as any });
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ key: 'domain_settings', value: { baseUrl: 'https://bms.io' } }));
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ value: expect.objectContaining({ currentStep: 4, completed: false }) }));
    });
  });

  describe('step4 — SendGrid', () => {
    it('with skip=true, advances to step 5 without persisting sendgrid_settings', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });

      await service.advanceStep({ step: 4, data: { skip: true } as any });

      expect(systemConfigRepo.save).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'sendgrid_settings' }));
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ value: expect.objectContaining({ currentStep: 5, completed: false }) }));
    });

    it('persists sendgrid_settings with required fields and advances to step 5', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });

      await service.advanceStep({
        step: 4,
        data: {
          apiKey: 'SG.abcdefghij',
          subuserEmail: 'billing@acme.io',
          subuserPrefix: 'bms',
          defaultIpPool: 'pool-1',
          webhookBaseUrl: 'https://bms.io/bms/events',
        } as any,
      });

      expect(systemConfigRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'sendgrid_settings',
          value: expect.objectContaining({
            apiKey: 'SG.abcdefghij',
            subuserEmail: 'billing@acme.io',
            subuserPrefix: 'bms',
            defaultIpPool: 'pool-1',
            webhookBaseUrl: 'https://bms.io/bms/events',
          }),
        }),
      );
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ value: expect.objectContaining({ currentStep: 5, completed: false }) }));
    });

    it('rejects payload without skip and without apiKey', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      await expect(service.advanceStep({ step: 4, data: {} as any })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects payload without skip that has apiKey but misses subuserEmail', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      await expect(service.advanceStep({ step: 4, data: { apiKey: 'SG.abcdefghij' } as any })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects apiKey not starting with SG.', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      await expect(service.advanceStep({ step: 4, data: { apiKey: 'nope-not-sg', subuserEmail: 'a@b.io' } as any })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('step5 — account + pool', () => {
    it('with skip=true, marks wizard completed without touching account/pool tables', async () => {
      const { service, systemConfigRepo, accountRepo, poolRepo, userAccountRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 5, completed: false } });

      await service.advanceStep({ step: 5, data: { skip: true } as any });

      expect(accountRepo.save).not.toHaveBeenCalled();
      expect(poolRepo.save).not.toHaveBeenCalled();
      expect(userAccountRepo.save).not.toHaveBeenCalled();
      expect(systemConfigRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'setup_wizard_step', value: expect.objectContaining({ currentStep: 5, completed: true }) }),
      );
    });

    it('uses the adminUserId stored in wizard state (not "first super-admin") when linking master user', async () => {
      const { service, roleRepo, userRepo, accountRepo, poolRepo, userAccountRepo, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({
        key: 'setup_wizard_step',
        value: { currentStep: 5, completed: false, adminUserId: 123 },
      });
      userRepo.findOne.mockResolvedValue({ id: 123, email: 'admin@bms.io' });
      accountRepo.save.mockResolvedValue({ id: 100 });

      await service.advanceStep({
        step: 5,
        data: {
          accountName: 'Acme',
          poolName: 'Acme Tx',
          senderEmail: 'noreply@acme.io',
          senderName: 'Acme',
          replyToEmail: 'reply@acme.io',
          sendingLimit: 5000,
          ips: ['192.0.2.10'],
        } as any,
      });

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 123 } });
      expect(userAccountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 123, accountId: 100, isMasterUser: true }));
      // Did NOT fall back to role-based lookup when wizard state already had the id.
      expect(roleRepo.findOne).not.toHaveBeenCalled();
    });

    it('falls back to the oldest super-admin (ORDER BY id ASC) when wizard state has no adminUserId', async () => {
      const { service, roleRepo, userRepo, accountRepo, userAccountRepo, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 5, completed: false } });
      roleRepo.findOne.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.findOne.mockResolvedValue({ id: 7 });
      accountRepo.save.mockResolvedValue({ id: 200 });

      await service.advanceStep({
        step: 5,
        data: {
          accountName: 'Acme',
          poolName: 'Acme Tx',
          senderEmail: 'noreply@acme.io',
          senderName: 'Acme',
          replyToEmail: 'reply@acme.io',
          sendingLimit: 5000,
        } as any,
      });

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { globalRoleId: SUPER_ADMIN_ROLE.id }, order: { id: 'ASC' } });
      expect(userAccountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, accountId: 200, isMasterUser: true }));
    });

    it('rejects step5 payload that is neither skip nor full config (Joi or-constraint)', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 5, completed: false } });
      await expect(service.advanceStep({ step: 5, data: {} as any })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('upsertWizard — never regresses', () => {
    it('does not downgrade currentStep on step2 when stored state is already at step 3', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 3, completed: false } });

      await service.advanceStep({ step: 2, data: { host: 's', port: 1, user: 'u', pass: 'p', from: 'a@b.io' } as any });

      const wizardSaves = systemConfigRepo.save.mock.calls.filter(([v]: [any]) => v.key === 'setup_wizard_step');
      expect(wizardSaves).toHaveLength(0);
    });
  });

  describe('testSmtp', () => {
    const createTransport = nodemailer.createTransport as jest.Mock;
    afterEach(() => createTransport.mockReset());

    it('rejects testSmtp once wizard is already completed', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: true } });

      await expect(service.testSmtp({ host: 's', port: 1, user: 'u', pass: 'p', from: 'a@b.io' } as any, '1.1.1.1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects testSmtp when no admin has been created yet (step1 not run)', async () => {
      const { service, systemConfigRepo, roleRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue(undefined);
      roleRepo.findOne.mockResolvedValue(SUPER_ADMIN_ROLE);

      await expect(service.testSmtp({ host: 's', port: 1, user: 'u', pass: 'p', from: 'a@b.io' } as any, '1.1.1.1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('resolves toEmail from the admin user stored in wizard state (not from the client body)', async () => {
      const { service, systemConfigRepo, userRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({
        key: 'setup_wizard_step',
        value: { currentStep: 2, completed: false, adminUserId: 9 },
      });
      userRepo.findOne.mockResolvedValue({ id: 9, email: 'admin@bms.io' });

      const sendMail = jest.fn().mockResolvedValue({});
      createTransport.mockReturnValue({ sendMail });

      await service.testSmtp({ host: 's', port: 587, user: 'u', pass: 'p', from: 'noreply@bms.io' } as any, '1.1.1.1');

      expect(createTransport).toHaveBeenCalledWith({ host: 's', port: 587, auth: { user: 'u', pass: 'p' } });
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'noreply@bms.io', to: 'admin@bms.io', subject: expect.stringContaining('SMTP') }));
    });

    it('returns a generic BAD_GATEWAY error on transport failure (does not leak the nodemailer message)', async () => {
      const { service, systemConfigRepo, userRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({
        key: 'setup_wizard_step',
        value: { currentStep: 2, completed: false, adminUserId: 9 },
      });
      userRepo.findOne.mockResolvedValue({ id: 9, email: 'admin@bms.io' });

      const sendMail = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.3:25'));
      createTransport.mockReturnValue({ sendMail });

      try {
        await service.testSmtp({ host: 's', port: 587, user: 'u', pass: 'p', from: 'a@b.io' } as any, '1.1.1.1');
        throw new Error('expected testSmtp to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
        expect(err.message).not.toMatch(/ECONNREFUSED|10\.0\.0\.3/);
      }
    });

    it('applies per-IP rate limit (6th attempt within the window returns 429)', async () => {
      const { service, systemConfigRepo, userRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({
        key: 'setup_wizard_step',
        value: { currentStep: 2, completed: false, adminUserId: 9 },
      });
      userRepo.findOne.mockResolvedValue({ id: 9, email: 'admin@bms.io' });

      const sendMail = jest.fn().mockResolvedValue({});
      createTransport.mockReturnValue({ sendMail });

      const body = { host: 's', port: 587, user: 'u', pass: 'p', from: 'a@b.io' } as any;
      for (let i = 0; i < 5; i++) {
        await service.testSmtp(body, '9.9.9.9');
      }
      try {
        await service.testSmtp(body, '9.9.9.9');
        throw new Error('expected 6th attempt to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });
  });

  describe('testSendgrid', () => {
    const axiosMock = require('axios').default.get as jest.Mock;
    afterEach(() => axiosMock.mockReset());

    it('returns first_name as accountName on 2xx', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      axiosMock.mockResolvedValue({ status: 200, data: { first_name: 'Maria', company: 'Acme', type: 'free' } });

      const out = await service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '1.1.1.1');

      expect(axiosMock).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/user/account',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer SG.abcdefghij' }) }),
      );
      expect(out).toEqual({ accountName: 'Maria' });
    });

    it('falls back to company when first_name is absent', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      axiosMock.mockResolvedValue({ status: 200, data: { company: 'Acme', type: 'free' } });

      const out = await service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '1.1.1.1');

      expect(out).toEqual({ accountName: 'Acme' });
    });

    it('does NOT use res.data.type as accountName fallback (would mislead user with plan tier)', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      axiosMock.mockResolvedValue({ status: 200, data: { type: 'free' } });

      const out = await service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '1.1.1.1');

      expect(out).toEqual({ accountName: null });
    });

    it('maps 401 to UNAUTHORIZED with PT-BR message about Full Access', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      axiosMock.mockResolvedValue({ status: 401, data: { errors: [{ message: 'unauthorized' }] } });

      try {
        await service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '1.1.1.1');
        throw new Error('expected to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(err.message).toMatch(/Full Access/);
      }
    });

    it('maps 403 to UNAUTHORIZED with the same message', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      axiosMock.mockResolvedValue({ status: 403, data: {} });

      try {
        await service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '1.1.1.1');
        throw new Error('expected to throw');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }
    });

    it('passes through 429 from SendGrid as TOO_MANY_REQUESTS', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      axiosMock.mockResolvedValue({ status: 429, data: {} });

      try {
        await service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '1.1.1.1');
        throw new Error('expected to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('maps unexpected status (5xx) to BAD_GATEWAY with generic message', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      axiosMock.mockResolvedValue({ status: 502, data: { detail: 'upstream' } });

      try {
        await service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '1.1.1.1');
        throw new Error('expected to throw');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
        // Generic — does not leak upstream payload
        expect(err.message).not.toMatch(/upstream/);
      }
    });

    it('maps network errors (axios rejects) to BAD_GATEWAY', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      axiosMock.mockRejectedValue(new Error('connect ETIMEDOUT api.sendgrid.com'));

      try {
        await service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '1.1.1.1');
        throw new Error('expected to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
        expect(err.message).not.toMatch(/ETIMEDOUT|api\.sendgrid\.com/);
      }
    });

    it('rejects testSendgrid once wizard is already completed', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 5, completed: true } });

      await expect(service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '1.1.1.1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(axiosMock).not.toHaveBeenCalled();
    });

    it('applies per-IP rate limit independently of testSmtp (6th SendGrid attempt returns 429)', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: false } });
      axiosMock.mockResolvedValue({ status: 200, data: { first_name: 'X' } });

      for (let i = 0; i < 5; i++) {
        await service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '8.8.8.8');
      }
      try {
        await service.testSendgrid({ apiKey: 'SG.abcdefghij' } as any, '8.8.8.8');
        throw new Error('expected 6th attempt to throw');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });
  });
});
