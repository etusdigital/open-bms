import { HttpException, HttpStatus } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { UsersService } from './users.service';
import type { UserEntity } from '../../entities/users.entity';
import type { UserAccountEntity } from '../../entities/users-account.entity';
import type { RoleEntity } from '../../entities/role.entity';
import type { UserActivityEntity } from '../../entities/user-activity.entity';
import type { AccountsService } from '../accounts/accounts.service';
import type { BucketsService } from '../buckets/buckets.service';
import type { AuthzService } from '../authz/authz.service';
import type { CreateUserDto } from './dtos/create-user.dto';

function makeQueryBuilder(result: any = null) {
  const qb: any = { select: jest.fn(), where: jest.fn(), getOne: jest.fn().mockResolvedValue(result) };
  qb.select.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  return qb;
}

function makeRepo<T>(extra: Partial<jest.Mocked<Repository<T>>> = {}): jest.Mocked<Repository<T>> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    merge: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder()),
    ...extra,
  } as unknown as jest.Mocked<Repository<T>>;
}

function makeService() {
  const userRepo = makeRepo<UserEntity>();
  const userAccountRepo = makeRepo<UserAccountEntity>();
  const roleRepo = makeRepo<RoleEntity>();
  const activityRepo = makeRepo<UserActivityEntity>();
  const authProvider = {
    updateUser: jest.fn().mockResolvedValue(undefined),
    supportsCredentialLogin: jest.fn().mockReturnValue(false),
  } as any;
  const accountService = {} as AccountsService;
  const bucketsService = {} as BucketsService;
  const authzService = { invalidateUserCache: jest.fn().mockResolvedValue(undefined) } as unknown as AuthzService;

  const service = new UsersService(userRepo, userAccountRepo, roleRepo, activityRepo, authProvider, accountService, bucketsService, authzService);

  return { service, userRepo, roleRepo, authProvider };
}

describe('UsersService.update', () => {
  it('EVO-1086: globalRoleId persiste mesmo quando merge() teria sobrescrito com undefined', async () => {
    const { service, userRepo, roleRepo } = makeService();

    const existingUser = { id: 1, globalRoleId: 10, providerId: 'local|abc', name: 'Original', userAccount: [] } as unknown as UserEntity;
    const newRole = { id: 20, code: 'editor', name: 'Editor' } as RoleEntity;

    userRepo.findOne.mockResolvedValue(existingUser);
    // simula TypeORM: colunas ausentes no DTO ficam undefined após merge
    userRepo.merge.mockImplementation((target: any, source: any) => {
      target.globalRoleId = undefined;
      return Object.assign(target, source);
    });
    roleRepo.findOne.mockResolvedValue(newRole);

    await service.update(1, { globalRoleCode: 'editor' } as CreateUserDto, 99);

    const [, entityArg] = userRepo.update.mock.calls[0];
    expect((entityArg as any).globalRoleId).toBe(20);
  });

  it('não permite sobrescrever providerId via body do request', async () => {
    const { service, userRepo } = makeService();

    const existingUser = { id: 1, providerId: 'local|original', name: 'Test', userAccount: [] } as unknown as UserEntity;

    userRepo.findOne.mockResolvedValue(existingUser);
    userRepo.merge.mockImplementation((target: any, source: any) => Object.assign(target, source));

    await service.update(1, { name: 'Updated', providerId: 'local|attacker' } as CreateUserDto, 99);

    const [, entityArg] = userRepo.update.mock.calls[0];
    expect((entityArg as any).providerId).toBe('local|original');
  });

  it('não permite sobrescrever createdAt via body do request', async () => {
    const { service, userRepo } = makeService();

    const originalDate = new Date('2020-01-01T00:00:00Z');
    const existingUser = { id: 1, providerId: 'local|abc', name: 'Test', createdAt: originalDate, userAccount: [] } as unknown as UserEntity;

    userRepo.findOne.mockResolvedValue(existingUser);
    userRepo.merge.mockImplementation((target: any, source: any) => Object.assign(target, source));

    await service.update(1, { name: 'Updated', createdAt: new Date('1970-01-01') } as CreateUserDto, 99);

    const [, entityArg] = userRepo.update.mock.calls[0];
    expect((entityArg as any).createdAt).toEqual(originalDate);
  });

  it('retorna entidade com globalRole sincronizado com o novo papel', async () => {
    const { service, userRepo, roleRepo } = makeService();

    const oldRole = { id: 10, code: 'viewer', name: 'Viewer' } as RoleEntity;
    const newRole = { id: 20, code: 'editor', name: 'Editor' } as RoleEntity;
    const existingUser = { id: 1, globalRoleId: 10, globalRole: oldRole, providerId: 'local|abc', name: 'Test', userAccount: [] } as unknown as UserEntity;

    userRepo.findOne.mockResolvedValue(existingUser);
    userRepo.merge.mockImplementation((target: any, source: any) => Object.assign(target, source));
    roleRepo.findOne.mockResolvedValue(newRole);

    const result = await service.update(1, { globalRoleCode: 'editor' } as CreateUserDto, 99);

    expect(result.globalRoleId).toBe(20);
    expect(result.globalRole).toEqual(newRole);
  });

  it('lança 404 quando usuário não existe', async () => {
    const { service, userRepo } = makeService();
    userRepo.findOne.mockResolvedValue(null);

    await expect(service.update(999, {} as CreateUserDto, 1)).rejects.toThrow(new HttpException('User not found', HttpStatus.NOT_FOUND));
  });
});
