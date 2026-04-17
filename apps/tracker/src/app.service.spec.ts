import { NotFoundException } from '@nestjs/common';
import { AppService } from './app.service';
import { MsgopsService } from './msgops/msgops.service';
import { PubSubProvider } from './providers/pubsub.provider';
import { ClsService } from 'nestjs-cls';

describe('AppService', () => {
  let service: AppService;
  let pubSubProvider: Partial<PubSubProvider>;
  let msgopsService: Partial<MsgopsService>;
  let clsService: Partial<ClsService>;

  beforeEach(() => {
    pubSubProvider = {
      sendMessage: jest.fn().mockResolvedValue({ messageId: 'test-id', status: true }),
    };
    msgopsService = {
      findLongUrl: jest.fn(),
      contactByEmail: jest.fn(),
    };
    clsService = {
      get: jest.fn().mockReturnValue(42),
    };

    service = new AppService(pubSubProvider as PubSubProvider, msgopsService as MsgopsService, clsService as ClsService);
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
      process.env.TOPIC_WEBHOOKS = 'test-webhooks-topic';

      await service.processShortLink('abc123', '1.2.3.4', mockResponse, {});

      expect(mockResponse.cookie).toHaveBeenCalledWith('bmsUUID', 'abc', expect.any(Object));
      expect(pubSubProvider.sendMessage).toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(302, expect.any(String));
    });

    it('should publish click event to Pub/Sub', async () => {
      const longUrl = 'https://example.com/page?uuid=abc&platform=twilio&message_type=sms';
      (msgopsService.findLongUrl as jest.Mock).mockResolvedValue(longUrl);
      process.env.TOPIC_WEBHOOKS = 'webhooks-topic';

      await service.processShortLink('abc123', '1.2.3.4', mockResponse, { 'user-agent': 'test' });

      expect(pubSubProvider.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ event: 'click', ip: '1.2.3.4' }),
        }),
        'webhooks-topic',
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
