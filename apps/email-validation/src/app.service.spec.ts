import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { AppService } from './app.service';
import { MsgopsService } from './msgops/msgops.service';
import { EMAIL_VALIDATION_PROVIDER_TOKEN, IEmailValidationProvider } from './providers/email-validation.provider.interface';

describe('AppService', () => {
  let service: AppService;
  let msgopsService: Partial<Record<keyof MsgopsService, jest.Mock>>;
  let checker: Partial<Record<keyof IEmailValidationProvider, jest.Mock>>;

  beforeEach(async () => {
    msgopsService = {
      findAccountByApiKey: jest.fn(),
      createOrUpdateAccountUsage: jest.fn(),
      findByEmail: jest.fn(),
      createOrUpdateEmail: jest.fn(),
    };

    checker = {
      check: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService, { provide: MsgopsService, useValue: msgopsService }, { provide: EMAIL_VALIDATION_PROVIDER_TOKEN, useValue: checker }],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  describe('validate()', () => {
    // Regex check
    describe('regex validation (Step 1)', () => {
      it('should return undeliverable for email without @ symbol', async () => {
        const result = await service.validate('notanemail', '', false);
        expect(result.result).toBe('undeliverable');
      });

      it('should return undeliverable for email without domain', async () => {
        const result = await service.validate('user@', '', false);
        expect(result.result).toBe('undeliverable');
      });

      it('should return undeliverable for empty string', async () => {
        const result = await service.validate('', '', false);
        expect(result.result).toBe('undeliverable');
      });

      it('should return undeliverable for email with spaces', async () => {
        const result = await service.validate('user @example.com', '', false);
        expect(result.result).toBe('undeliverable');
      });

      it('should not call checker provider for invalid email format', async () => {
        await service.validate('invalid', '', false);
        expect(checker.check).not.toHaveBeenCalled();
      });

      it('should not call findByEmail for invalid email format', async () => {
        await service.validate('invalid', '', false);
        expect(msgopsService.findByEmail).not.toHaveBeenCalled();
      });
    });

    // Account validation (shouldChargeUse)
    describe('account validation', () => {
      it('should throw FORBIDDEN when shouldChargeUse is true and account not found', async () => {
        msgopsService.findAccountByApiKey.mockResolvedValue(null);

        await expect(service.validate('user@example.com', 'bad-key', true)).rejects.toThrow(HttpException);
      });

      it('should call createOrUpdateAccountUsage when account is found', async () => {
        msgopsService.findAccountByApiKey.mockResolvedValue({ id: 1 });
        msgopsService.findByEmail.mockResolvedValue(null);
        checker.check.mockResolvedValue({
          email: 'user@example.com',
          status: 'deliverable',
          response: {},
          apiStatus: 200,
        });

        await service.validate('user@example.com', 'good-key', true);

        expect(msgopsService.createOrUpdateAccountUsage).toHaveBeenCalledWith(1);
      });

      it('should not validate account when shouldChargeUse is false', async () => {
        msgopsService.findByEmail.mockResolvedValue(null);
        checker.check.mockResolvedValue({
          email: 'user@example.com',
          status: 'deliverable',
          response: {},
          apiStatus: 200,
        });

        await service.validate('user@example.com', '', false);

        expect(msgopsService.findAccountByApiKey).not.toHaveBeenCalled();
      });
    });

    // Cache hit (DB lookup with 7-day window)
    describe('database cache hit (Step 3)', () => {
      it('should return cached response when DB record has response field', async () => {
        msgopsService.findByEmail.mockResolvedValue({
          email: 'user@example.com',
          status: 'deliverable',
          response: JSON.stringify({ state: 'deliverable', reason: 'accepted_email' }),
          lastOpen: null,
          lastClick: null,
          unsubscribedAt: null,
        });

        const result = await service.validate('user@example.com', '', false);

        expect(result.result).toBe('deliverable');
        expect(checker.check).not.toHaveBeenCalled();
      });
    });

    // Engagement bypass (7-day rule)
    describe('engagement bypass (Step 4)', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3); // 3 days ago

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      it('should return deliverable when lastOpen is within 7 days', async () => {
        msgopsService.findByEmail.mockResolvedValue({
          email: 'user@example.com',
          lastOpen: recentDate,
          lastClick: null,
          unsubscribedAt: null,
          response: null,
        });

        const result = await service.validate('user@example.com', '', false);

        expect(result.result).toBe('deliverable');
        expect(result.state).toBe('deliverable');
        expect(checker.check).not.toHaveBeenCalled();
      });

      it('should return deliverable when lastClick is within 7 days', async () => {
        msgopsService.findByEmail.mockResolvedValue({
          email: 'user@example.com',
          lastOpen: null,
          lastClick: recentDate,
          unsubscribedAt: null,
          response: null,
        });

        const result = await service.validate('user@example.com', '', false);

        expect(result.result).toBe('deliverable');
        expect(checker.check).not.toHaveBeenCalled();
      });

      it('should return deliverable when unsubscribedAt is within 7 days', async () => {
        msgopsService.findByEmail.mockResolvedValue({
          email: 'user@example.com',
          lastOpen: null,
          lastClick: null,
          unsubscribedAt: recentDate,
          response: null,
        });

        const result = await service.validate('user@example.com', '', false);

        expect(result.result).toBe('deliverable');
        expect(checker.check).not.toHaveBeenCalled();
      });

      // Boundary tests
      it('should bypass for engagement exactly 6 days ago (within 7 day window)', async () => {
        const sixDaysAgo = new Date();
        sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

        msgopsService.findByEmail.mockResolvedValue({
          email: 'user@example.com',
          lastOpen: sixDaysAgo,
          lastClick: null,
          unsubscribedAt: null,
          response: null,
        });

        const result = await service.validate('user@example.com', '', false);

        expect(result.result).toBe('deliverable');
        expect(checker.check).not.toHaveBeenCalled();
      });

      it('should NOT bypass for engagement 8 days ago (outside 7 day window)', async () => {
        msgopsService.findByEmail.mockResolvedValue({
          email: 'user@example.com',
          lastOpen: oldDate,
          lastClick: null,
          unsubscribedAt: null,
          response: null,
          status: null,
        });

        checker.check.mockResolvedValue({
          email: 'user@example.com',
          status: 'deliverable',
          response: {},
          apiStatus: 200,
        });

        await service.validate('user@example.com', '', false);

        expect(checker.check).toHaveBeenCalled();
      });
    });

    // Validation provider API call (Step 5)
    describe('validation provider API call (Step 5)', () => {
      beforeEach(() => {
        msgopsService.findByEmail.mockResolvedValue(null);
      });

      it('should call checker provider when no cache hit', async () => {
        checker.check.mockResolvedValue({
          email: 'user@example.com',
          status: 'deliverable',
          response: { state: 'deliverable' },
          apiStatus: 200,
        });

        await service.validate('user@example.com', '', false);

        expect(checker.check).toHaveBeenCalledWith('user@example.com');
      });

      it('should save result to DB for HTTP 200', async () => {
        const checkResult = {
          email: 'user@example.com',
          status: 'deliverable',
          response: { state: 'deliverable' },
          apiStatus: 200,
        };
        checker.check.mockResolvedValue(checkResult);

        await service.validate('user@example.com', '', false);

        expect(msgopsService.createOrUpdateEmail).toHaveBeenCalledWith(checkResult);
      });

      it('should return the correct result from provider response', async () => {
        checker.check.mockResolvedValue({
          email: 'user@example.com',
          status: 'deliverable',
          response: { state: 'deliverable', reason: 'accepted_email' },
          apiStatus: 200,
        });

        const result = await service.validate('user@example.com', '', false);

        expect(result.result).toBe('deliverable');
      });
    });

    // Noop provider — must not persist to cache (F1)
    describe('noop provider — cache bypass', () => {
      beforeEach(() => {
        msgopsService.findByEmail.mockResolvedValue(null);
      });

      it('should NOT save to DB when reason is "noop"', async () => {
        checker.check.mockResolvedValue({
          email: 'user@example.com',
          status: 'deliverable',
          reason: 'noop',
          response: { state: 'deliverable', reason: 'noop' },
          apiStatus: 200,
        });

        await service.validate('user@example.com', '', false);

        expect(msgopsService.createOrUpdateEmail).not.toHaveBeenCalled();
      });

      it('should still return deliverable for noop response', async () => {
        checker.check.mockResolvedValue({
          email: 'user@example.com',
          status: 'deliverable',
          reason: 'noop',
          response: { state: 'deliverable', reason: 'noop' },
          apiStatus: 200,
        });

        const result = await service.validate('user@example.com', '', false);

        expect(result.result).toBe('deliverable');
      });
    });

    // HTTP 249 handling (Step 7)
    describe('HTTP 249 handling (Step 7)', () => {
      beforeEach(() => {
        msgopsService.findByEmail.mockResolvedValue(null);
      });

      it('should NOT save to DB when apiStatus is 249', async () => {
        checker.check.mockResolvedValue({
          email: 'user@example.com',
          status: 'deferred',
          response: { message: 'Still processing' },
          apiStatus: 249,
        });

        await service.validate('user@example.com', '', false);

        expect(msgopsService.createOrUpdateEmail).not.toHaveBeenCalled();
      });

      it('should return deferred status for HTTP 249', async () => {
        checker.check.mockResolvedValue({
          email: 'user@example.com',
          status: 'deferred',
          response: { message: 'Still processing' },
          apiStatus: 249,
        });

        const result = await service.validate('user@example.com', '', false);

        expect(result.result).toBe('deferred');
      });

      it('should NOT save for Yahoo email with HTTP 249', async () => {
        checker.check.mockResolvedValue({
          email: 'user@yahoo.com',
          status: 'deferred',
          response: { message: 'Still processing' },
          apiStatus: 249,
        });

        await service.validate('user@yahoo.com', '', false);

        expect(msgopsService.createOrUpdateEmail).not.toHaveBeenCalled();
      });
    });
  });
});
