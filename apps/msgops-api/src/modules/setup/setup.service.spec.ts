import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { SystemConfigEntity } from '../../entities/system-config.entity';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
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

async function buildService(
  repos: {
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
}> {
  const systemConfigRepo = repos.systemConfigRepo ?? makeRepo();
  const userRepo = repos.userRepo ?? makeRepo();
  const roleRepo = repos.roleRepo ?? makeRepo();
  const accountRepo = repos.accountRepo ?? makeRepo();
  const poolRepo = repos.poolRepo ?? makeRepo();
  const userAccountRepo = repos.userAccountRepo ?? makeRepo();

  const moduleRef = await Test.createTestingModule({
    providers: [
      SetupService,
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
  };
}

describe('SetupService', () => {
  describe('getStatus', () => {
    it('returns step 1 when no super admin exists in the database', async () => {
      const { service, roleRepo, userRepo } = await buildService();
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
      const { service, roleRepo, userRepo, systemConfigRepo } = await buildService();
      roleRepo.findOne.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.count.mockResolvedValue(1);
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 4, completed: true } });

      const status = await service.getStatus();
      expect(status).toEqual({ configured: true, currentStep: 4 });
    });
  });

  describe('advanceStep validation', () => {
    it('throws BadRequestException on invalid step1 payload (short password)', async () => {
      const { service } = await buildService();
      await expect(service.advanceStep({ step: 1, data: { name: 'A', email: 'a@b.io', password: 'short' } as any })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException on invalid email TLD-free syntax (missing @)', async () => {
      const { service } = await buildService();
      await expect(service.advanceStep({ step: 1, data: { name: 'A', email: 'not-an-email', password: 'password1' } as any })).rejects.toBeInstanceOf(BadRequestException);
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
    it('creates user via authProvider, persists credentials, advances wizard to step 2', async () => {
      const { service, roleRepo, userRepo, systemConfigRepo, authProvider } = await buildService();
      roleRepo.findOneOrFail.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.findOne.mockResolvedValue(undefined);
      systemConfigRepo.findOne.mockResolvedValue(undefined);

      await service.advanceStep({ step: 1, data: { name: 'Admin', email: 'admin@bms.io', password: 'password1' } as any });

      expect(authProvider.createUser).toHaveBeenCalledWith({ name: 'Admin', email: 'admin@bms.io', password: 'password1' });
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ email: 'admin@bms.io', providerId: 'local|abc', globalRoleId: SUPER_ADMIN_ROLE.id }));
      expect(authProvider.updatePassword).toHaveBeenCalledWith('local|abc', 'password1');
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ key: 'setup_wizard_step', value: { currentStep: 2, completed: false } }));
    });

    it('is idempotent when user with same email already exists (no duplicate user + no password reset)', async () => {
      const { service, userRepo, systemConfigRepo, authProvider } = await buildService();
      userRepo.findOne.mockResolvedValue({ id: 9, email: 'admin@bms.io' });
      systemConfigRepo.findOne.mockResolvedValue(undefined);

      await service.advanceStep({ step: 1, data: { name: 'Admin', email: 'admin@bms.io', password: 'password1' } as any });

      expect(authProvider.createUser).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
      expect(authProvider.updatePassword).not.toHaveBeenCalled();
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ value: { currentStep: 2, completed: false } }));
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
  });

  describe('step2 / step3 — config persistence', () => {
    it('step2 persists smtp_settings and advances to step 3', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue(undefined);
      const smtp = { host: 'smtp.bms.io', port: 587, user: 'u', pass: 'p', from: 'noreply@bms.io' };

      await service.advanceStep({ step: 2, data: smtp as any });
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ key: 'smtp_settings', value: smtp }));
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ key: 'setup_wizard_step', value: { currentStep: 3, completed: false } }));
    });

    it('step3 persists domain_settings and advances to step 4', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue(undefined);

      await service.advanceStep({ step: 3, data: { baseUrl: 'https://bms.io' } as any });
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ key: 'domain_settings', value: { baseUrl: 'https://bms.io' } }));
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ value: { currentStep: 4, completed: false } }));
    });
  });

  describe('step4 — account + pool', () => {
    it('with skip=true, marks wizard completed without touching account/pool tables', async () => {
      const { service, systemConfigRepo, accountRepo, poolRepo, userAccountRepo } = await buildService();

      await service.advanceStep({ step: 4, data: { skip: true } as any });

      expect(accountRepo.save).not.toHaveBeenCalled();
      expect(poolRepo.save).not.toHaveBeenCalled();
      expect(userAccountRepo.save).not.toHaveBeenCalled();
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ value: { currentStep: 4, completed: true } }));
    });

    it('creates account, pool, links admin as master user, and marks wizard completed', async () => {
      const { service, roleRepo, userRepo, accountRepo, poolRepo, userAccountRepo, systemConfigRepo } = await buildService();
      roleRepo.findOne.mockResolvedValue(SUPER_ADMIN_ROLE);
      userRepo.findOne.mockResolvedValue({ id: 7 });
      accountRepo.save.mockResolvedValue({ id: 100 });

      await service.advanceStep({
        step: 4,
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

      expect(accountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Acme', groupId: 1, isActive: true }));
      expect(poolRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 100, poolName: 'Acme Tx', senderEmail: 'noreply@acme.io', ip: ['192.0.2.10'], sendingLimit: 5000, isDefault: true }),
      );
      expect(userAccountRepo.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, accountId: 100, isMasterUser: true }));
      expect(systemConfigRepo.save).toHaveBeenCalledWith(expect.objectContaining({ value: { currentStep: 4, completed: true } }));
    });

    it('rejects step4 payload that is neither skip nor full config (Joi or-constraint)', async () => {
      const { service } = await buildService();
      await expect(service.advanceStep({ step: 4, data: {} as any })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('upsertWizard — never regresses', () => {
    it('does not overwrite when the requested step is not greater than the stored one', async () => {
      const { service, systemConfigRepo } = await buildService();
      systemConfigRepo.findOne.mockResolvedValue({ key: 'setup_wizard_step', value: { currentStep: 3, completed: false } });

      await service.advanceStep({ step: 2, data: { host: 's', port: 1, user: 'u', pass: 'p', from: 'a@b.io' } as any });

      // step2 still persists smtp_settings, but should NOT downgrade wizard key
      const wizardSaves = systemConfigRepo.save.mock.calls.filter(([v]: [any]) => v.key === 'setup_wizard_step');
      expect(wizardSaves).toHaveLength(0);
    });
  });

  describe('testSmtp', () => {
    const createTransport = nodemailer.createTransport as jest.Mock;
    afterEach(() => createTransport.mockReset());

    it('sends email via nodemailer with provided credentials', async () => {
      const sendMail = jest.fn().mockResolvedValue({});
      createTransport.mockReturnValue({ sendMail });

      const { service } = await buildService();
      await service.testSmtp({ host: 's', port: 587, user: 'u', pass: 'p', from: 'a@b.io', toEmail: 'x@y.io' });

      expect(createTransport).toHaveBeenCalledWith({ host: 's', port: 587, auth: { user: 'u', pass: 'p' } });
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'a@b.io', to: 'x@y.io', subject: expect.stringContaining('SMTP') }));
    });

    it('wraps nodemailer errors in BadRequestException with the original message', async () => {
      const sendMail = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
      createTransport.mockReturnValue({ sendMail });

      const { service } = await buildService();
      await expect(service.testSmtp({ host: 's', port: 587, user: 'u', pass: 'p', from: 'a@b.io', toEmail: 'x@y.io' })).rejects.toThrow(/connect ECONNREFUSED/);
    });
  });
});
