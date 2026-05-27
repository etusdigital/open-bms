import { NotFoundException } from '@nestjs/common';
import { AppService } from './app.service';
import { MsgopsService } from './msgops/msgops.service';
import { EventPublisherService } from './event-publisher.service';
import { ClsService } from 'nestjs-cls';

describe('AppService', () => {
  let service: AppService;
  let eventPublisher: Partial<EventPublisherService>;
  let msgopsService: Partial<MsgopsService>;
  let clsService: Partial<ClsService>;

  beforeEach(() => {
    eventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    msgopsService = {
      findLongUrl: jest.fn(),
      contactByEmail: jest.fn(),
    };
    clsService = {
      get: jest.fn().mockReturnValue(42),
    };

    service = new AppService(eventPublisher as EventPublisherService, msgopsService as MsgopsService, clsService as ClsService);
  });

  describe('getHello()', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });
  });

  describe('processShortLink()', () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      };
    });

    it('should throw NotFoundException when short code not found', async () => {
      (msgopsService.findLongUrl as jest.Mock).mockResolvedValue(null);

      await expect(service.processShortLink('nonexistent', '1.2.3.4', mockResponse, {})).rejects.toThrow(NotFoundException);
    });

    it('should redirect to long URL for valid short code', async () => {
      const longUrl = 'https://example.com/page?uuid=abc&platform=twilio&message_type=email&utm_source=test';
      (msgopsService.findLongUrl as jest.Mock).mockResolvedValue(longUrl);

      await service.processShortLink('abc123', '1.2.3.4', mockResponse, {});

      expect(mockResponse.cookie).toHaveBeenCalledWith('bmsUUID', 'abc', expect.any(Object));
      expect(eventPublisher.publish).toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(302, expect.any(String));
    });

    it('should publish click event with twilio platform attribute', async () => {
      const longUrl = 'https://example.com/page?uuid=abc&platform=twilio&message_type=sms';
      (msgopsService.findLongUrl as jest.Mock).mockResolvedValue(longUrl);

      await service.processShortLink('abc123', '1.2.3.4', mockResponse, { 'user-agent': 'test' });

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ event: 'click', ip: '1.2.3.4' }),
        }),
        expect.objectContaining({ platform: 'twilio', message_type: 'sms' }),
      );
    });

    it('should strip internal params from redirect URL', async () => {
      const longUrl = 'https://example.com/page?uuid=abc&platform=twilio&message_type=email&type=test&utm_source=keep';
      (msgopsService.findLongUrl as jest.Mock).mockResolvedValue(longUrl);

      await service.processShortLink('abc123', '1.2.3.4', mockResponse, {});

      const redirectUrl = mockResponse.redirect.mock.calls[0][1];
      expect(redirectUrl).not.toContain('uuid=');
      expect(redirectUrl).not.toContain('platform=');
      expect(redirectUrl).toContain('utm_source=keep');
    });
  });

  describe('publishRedirectClick()', () => {
    const baseParams = {
      bmsUUID: 'uuid-123',
      accountId: '5',
      decodedUrl: 'https://example.com/page?utm_campaign=spring&utm_source=newsletter',
      ip: '1.2.3.4',
      userAgent: 'jest',
    };

    const originalEnv = { ...process.env };
    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should publish with correct body and attributes when enabled', async () => {
      process.env.ENABLE_TRACKER_REDIRECT_EVENT = 'true';

      await service.publishRedirectClick(baseParams);

      expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        {
          platform: 'internal',
          payload: [
            expect.objectContaining({
              event: 'tracker-redirect',
              schemaVersion: 1,
              accountId: '5',
              uuid: 'uuid-123',
              url: baseParams.decodedUrl,
              ip: '1.2.3.4',
              userAgent: 'jest',
              timestamp: expect.any(Number),
            }),
          ],
        },
        { platform: 'internal', message_type: 'tracker-redirect' },
      );
    });

    it('should no-op when feature flag is not set', async () => {
      delete process.env.ENABLE_TRACKER_REDIRECT_EVENT;

      await service.publishRedirectClick(baseParams);

      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('should no-op when feature flag is "false"', async () => {
      process.env.ENABLE_TRACKER_REDIRECT_EVENT = 'false';

      await service.publishRedirectClick(baseParams);

      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('should swallow publish errors', async () => {
      process.env.ENABLE_TRACKER_REDIRECT_EVENT = 'true';
      (eventPublisher.publish as jest.Mock).mockRejectedValueOnce(new Error('boom'));

      await expect(service.publishRedirectClick(baseParams)).resolves.toBeUndefined();
    });
  });

  describe('findContactsByEmail()', () => {
    it('should throw NotFoundException when email is empty', async () => {
      await expect(service.findContactsByEmail('')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when email is null', async () => {
      await expect(service.findContactsByEmail(null)).rejects.toThrow(NotFoundException);
    });

    it('should return contact data for valid email', async () => {
      const mockContact = { email: 'test@test.com', firstName: 'John' };
      (msgopsService.contactByEmail as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.findContactsByEmail('test@test.com', ['details']);

      expect(result).toEqual(mockContact);
      expect(msgopsService.contactByEmail).toHaveBeenCalledWith(42, 'test@test.com', ['details']);
    });

    it('should propagate error when service throws', async () => {
      (msgopsService.contactByEmail as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.findContactsByEmail('test@test.com')).rejects.toThrow('DB error');
    });
  });
});
