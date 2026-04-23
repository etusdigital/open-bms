import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { LocalAuthProvider } from './local-auth.provider';

const ORIGINAL_ENV = { ...process.env };

function mockRepo<T = any>() {
  return {
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
    findOne: jest.fn<Promise<T | null>, any[]>(),
    update: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    })),
  } as any;
}

describe('LocalAuthProvider', () => {
  let provider: LocalAuthProvider;
  let userRepository: any;
  let credentialsRepository: any;
  let refreshTokenRepository: any;
  let authzService: any;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-secret-value', JWT_AUDIENCE: 'test-aud', JWT_ACCESS_TTL: '3600', JWT_REFRESH_TTL: '2592000' };
    userRepository = mockRepo();
    credentialsRepository = mockRepo();
    refreshTokenRepository = mockRepo();
    authzService = { invalidateUserCache: jest.fn() };
    provider = new LocalAuthProvider(userRepository, credentialsRepository, refreshTokenRepository, authzService);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('supportsCredentialLogin', () => {
    it('returns true', () => {
      expect(provider.supportsCredentialLogin()).toBe(true);
    });
  });

  describe('createUser', () => {
    it('mints a local|<uuid> providerId without touching the DB', async () => {
      const result = await provider.createUser({ email: 'a@b.com', name: 'A', password: 'secret12' });
      expect(result.providerId.startsWith('local|')).toBe(true);
      // UserEntity insertion is owned by UsersService.create; provider only mints the id.
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(credentialsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updatePassword', () => {
    it('rejects non-local providerId', async () => {
      await expect(provider.updatePassword('auth0|abc', 'newpassword')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('upserts credentials and invalidates cache', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1, providerId: 'local|uuid' });
      credentialsRepository.findOne.mockResolvedValue({ userId: 1 });
      await provider.updatePassword('local|uuid', 'newpassword');
      expect(credentialsRepository.update).toHaveBeenCalled();
      expect(authzService.invalidateUserCache).toHaveBeenCalledWith('local|uuid');
    });
  });

  describe('verifyToken', () => {
    it('accepts valid HS256 token', async () => {
      const token = jwt.sign({ sub: 'local|x', email: 'a@b.com' }, 'test-secret-value', {
        algorithm: 'HS256',
        issuer: 'bms-msgops-api',
        audience: 'test-aud',
        expiresIn: 60,
      });
      const payload = await provider.verifyToken(token);
      expect(payload.sub).toBe('local|x');
    });

    it('rejects token signed with wrong secret', async () => {
      const token = jwt.sign({ sub: 'x' }, 'other-secret', { algorithm: 'HS256', issuer: 'bms-msgops-api', audience: 'test-aud', expiresIn: 60 });
      await expect(provider.verifyToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects expired token', async () => {
      const token = jwt.sign({ sub: 'x' }, 'test-secret-value', { algorithm: 'HS256', issuer: 'bms-msgops-api', audience: 'test-aud', expiresIn: -1 });
      await expect(provider.verifyToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('returns tokens when credentials are valid', async () => {
      const hash = await bcrypt.hash('secret12', 4);
      userRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, email: 'a@b.com', name: 'A', providerId: 'local|x', profile: '' }),
      });
      credentialsRepository.findOne.mockResolvedValue({ userId: 1, passwordHash: hash });

      const result = await provider.login('a@b.com', 'secret12');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.expiresIn).toBe(3600);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const hash = await bcrypt.hash('secret12', 4);
      userRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, email: 'a@b.com', name: 'A', providerId: 'local|x', profile: '' }),
      });
      credentialsRepository.findOne.mockResolvedValue({ userId: 1, passwordHash: hash });

      await expect(provider.login('a@b.com', 'wrongpass')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException on unknown email (generic message)', async () => {
      userRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      await expect(provider.login('missing@b.com', 'whatever1')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
