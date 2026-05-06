import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { VerifyService } from './verify.service';
import { VerifyStatisticsService, VerifyStatisticType } from './verify-statistics.service';
import { RedisService } from '../../providers/redis.provider';
import { ClsService } from 'nestjs-cls';
import { AccountsService } from '../accounts/accounts.service';
import { MessagesService } from '../messages/messages.service';
import { EventPublisherService } from 'src/providers/messaging/event-publisher.service';
import { VerifyMethod } from './verify.interface';

describe('VerifyService — EMAIL_VALIDATION_ENABLED guard', () => {
  let service: VerifyService;
  let verifyStatisticsService: { incrementStatistic: jest.Mock };
  let accountsService: { findOne: jest.Mock };
  let messagesService: { getMessageById: jest.Mock };
  let eventPublisher: { publish: jest.Mock };
  let cls: { get: jest.Mock };
  let redisService: { getClient: jest.Mock };
  const originalEnv = process.env;

  const buildAccount = () => ({
    configByName: jest.fn((key: string) => {
      const map: Record<string, any> = {
        '2fa_settings': { value: JSON.stringify({ email: { default: { id: 1 } } }) },
        time_zone: { value: 'UTC' },
        api_key: { value: 'test-api-key' },
      };
      return map[key];
    }),
  });

  beforeEach(async () => {
    process.env = { ...originalEnv };

    verifyStatisticsService = { incrementStatistic: jest.fn() };
    accountsService = { findOne: jest.fn().mockResolvedValue(buildAccount()) };
    messagesService = { getMessageById: jest.fn().mockResolvedValue({ subject: 's', html: '<p>{{CODE}}</p>' }) };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    cls = { get: jest.fn().mockReturnValue(1) };
    redisService = { getClient: jest.fn().mockReturnValue({ set: jest.fn().mockResolvedValue('OK') }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyService,
        { provide: RedisService, useValue: redisService },
        { provide: ClsService, useValue: cls },
        { provide: AccountsService, useValue: accountsService },
        { provide: MessagesService, useValue: messagesService },
        { provide: EventPublisherService, useValue: eventPublisher },
        { provide: VerifyStatisticsService, useValue: verifyStatisticsService },
      ],
    }).compile();

    service = module.get<VerifyService>(VerifyService);
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    delete (global as any).fetch;
  });

  describe('EMAIL_VALIDATION_ENABLED=true', () => {
    beforeEach(() => {
      process.env.EMAIL_VALIDATION_ENABLED = 'true';
      process.env.EMAIL_VALIDATION_URL = 'http://email-validation:3000/';
    });

    it('calls fetch and proceeds when result is deliverable', async () => {
      ((global as any).fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'deliverable' }),
      });

      await service.generate({ method: VerifyMethod.EMAIL, to: 'user@example.com' } as any, { headers: {} });

      expect((global as any).fetch).toHaveBeenCalledTimes(1);
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('throws 422 when result is undeliverable', async () => {
      ((global as any).fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'undeliverable' }),
      });

      await expect(service.generate({ method: VerifyMethod.EMAIL, to: 'bad@example.com' } as any, { headers: {} })).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
      expect(verifyStatisticsService.incrementStatistic).toHaveBeenCalledWith(VerifyMethod.EMAIL, undefined, VerifyStatisticType.ERROR, 'UTC');
    });

    it('throws 503 when validation service is unavailable', async () => {
      ((global as any).fetch as jest.Mock).mockResolvedValue({ ok: false });

      await expect(service.generate({ method: VerifyMethod.EMAIL, to: 'user@example.com' } as any, { headers: {} })).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });

  describe('EMAIL_VALIDATION_ENABLED=false', () => {
    beforeEach(() => {
      process.env.EMAIL_VALIDATION_ENABLED = 'false';
    });

    it('does NOT call fetch and proceeds when format is valid', async () => {
      await service.generate({ method: VerifyMethod.EMAIL, to: 'user@example.com' } as any, { headers: {} });

      expect((global as any).fetch).not.toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('throws 422 Invalid email address for malformed input', async () => {
      await expect(service.generate({ method: VerifyMethod.EMAIL, to: 'notanemail' } as any, { headers: {} })).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Invalid email address',
      });

      expect((global as any).fetch).not.toHaveBeenCalled();
      expect(verifyStatisticsService.incrementStatistic).toHaveBeenCalledWith(VerifyMethod.EMAIL, undefined, VerifyStatisticType.ERROR, 'UTC');
    });

    it('throws 422 for email without domain', async () => {
      await expect(service.generate({ method: VerifyMethod.EMAIL, to: 'user@' } as any, { headers: {} })).rejects.toBeInstanceOf(HttpException);
      expect((global as any).fetch).not.toHaveBeenCalled();
    });
  });

  describe('EMAIL_VALIDATION_ENABLED unset (default)', () => {
    beforeEach(() => {
      delete process.env.EMAIL_VALIDATION_ENABLED;
    });

    it('treats as disabled — no fetch call', async () => {
      await service.generate({ method: VerifyMethod.EMAIL, to: 'user@example.com' } as any, { headers: {} });

      expect((global as any).fetch).not.toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });
  });

  describe('EMAIL_VALIDATION_ENABLED — truthy parsing tolerance (F4)', () => {
    beforeEach(() => {
      process.env.EMAIL_VALIDATION_URL = 'http://email-validation:3000/';
      ((global as any).fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'deliverable' }),
      });
    });

    it.each(['true', 'TRUE', 'True', ' true ', '1', 'yes', 'YES'])('treats %j as enabled and calls fetch', async (value) => {
      process.env.EMAIL_VALIDATION_ENABLED = value;

      await service.generate({ method: VerifyMethod.EMAIL, to: 'user@example.com' } as any, { headers: {} });

      expect((global as any).fetch).toHaveBeenCalledTimes(1);
    });

    it.each(['false', 'FALSE', '0', 'no', '', '  '])('treats %j as disabled and skips fetch', async (value) => {
      process.env.EMAIL_VALIDATION_ENABLED = value;

      await service.generate({ method: VerifyMethod.EMAIL, to: 'user@example.com' } as any, { headers: {} });

      expect((global as any).fetch).not.toHaveBeenCalled();
    });
  });

  describe('EMAIL_FORMAT_REGEX — local format check (F5)', () => {
    beforeEach(() => {
      process.env.EMAIL_VALIDATION_ENABLED = 'false';
    });

    it.each(['user@example.com', 'first.last@sub.domain.io', 'user+tag@host.co.uk'])('accepts %s', async (email) => {
      await service.generate({ method: VerifyMethod.EMAIL, to: email } as any, { headers: {} });
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it.each(['notanemail', 'user@', '@host.com', 'a b@c.com', 'x"a"@b.com'])('rejects %s', async (email) => {
      await expect(service.generate({ method: VerifyMethod.EMAIL, to: email } as any, { headers: {} })).rejects.toMatchObject({ status: HttpStatus.UNPROCESSABLE_ENTITY });
    });
  });
});
