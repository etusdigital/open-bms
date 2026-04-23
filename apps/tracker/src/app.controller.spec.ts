import { NotFoundException } from '@nestjs/common';
import { AppController } from './app.controller';
import { MsgopsService } from './msgops/msgops.service';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let msgopsService: Partial<MsgopsService>;
  let appService: Partial<AppService>;

  beforeEach(() => {
    msgopsService = {
      findContact: jest.fn(),
      findContactTags: jest.fn(),
      accountsByEmail: jest.fn(),
    };
    appService = {
      findContactsByEmail: jest.fn(),
      processShortLink: jest.fn(),
      publishRedirectClick: jest.fn().mockResolvedValue(undefined),
    };

    controller = new AppController(msgopsService as MsgopsService, appService as AppService);
  });

  describe('findContact()', () => {
    it('should return contact for valid email request', async () => {
      const mockContact = { id: 1, email: 'test@test.com' };
      (msgopsService.findContact as jest.Mock).mockResolvedValue(mockContact);
      const body = { data: Buffer.from(JSON.stringify({ e: 'test@test.com' })).toString('base64') };

      const result = await controller.findContact(body);

      expect(result).toEqual(mockContact);
      expect(msgopsService.findContact).toHaveBeenCalledWith('e', 'test@test.com');
    });

    it('should return contact for valid uuid request', async () => {
      const mockContact = { id: 1, uuid: 'uuid-123' };
      (msgopsService.findContact as jest.Mock).mockResolvedValue(mockContact);
      const body = { data: Buffer.from(JSON.stringify({ u: 'uuid-123' })).toString('base64') };

      const result = await controller.findContact(body);

      expect(result).toEqual(mockContact);
      expect(msgopsService.findContact).toHaveBeenCalledWith('u', 'uuid-123');
    });

    it('should return contact for valid hashed email request', async () => {
      const mockContact = { id: 1, hashedEmail: 'hash123' };
      (msgopsService.findContact as jest.Mock).mockResolvedValue(mockContact);
      const body = { data: Buffer.from(JSON.stringify({ h: 'hash123' })).toString('base64') };

      const result = await controller.findContact(body);

      expect(result).toEqual(mockContact);
      expect(msgopsService.findContact).toHaveBeenCalledWith('h', 'hash123');
    });

    it('should throw NotFoundException for empty params', async () => {
      const body = { data: Buffer.from(JSON.stringify({})).toString('base64') };

      await expect(controller.findContact(body)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for invalid filter key', async () => {
      const body = { data: Buffer.from(JSON.stringify({ x: 'invalid' })).toString('base64') };

      await expect(controller.findContact(body)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findContactSegment()', () => {
    it('should return tag IDs for valid contact', async () => {
      (msgopsService.findContactTags as jest.Mock).mockResolvedValue([1, 3, 5]);
      const body = { data: Buffer.from(JSON.stringify({ i: 100 })).toString('base64') };

      const result = await controller.findContactSegment(body);

      expect(result).toEqual([1, 3, 5]);
      expect(msgopsService.findContactTags).toHaveBeenCalledWith(100);
    });

    it('should throw NotFoundException when i param is missing', async () => {
      const body = { data: Buffer.from(JSON.stringify({})).toString('base64') };

      await expect(controller.findContactSegment(body)).rejects.toThrow(NotFoundException);
    });
  });

  describe('redirect()', () => {
    it('should redirect to decoded URL', async () => {
      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as any;
      const mockRequest = {
        hostname: 'tracker.example.com',
      } as any;
      const url = Buffer.from(encodeURIComponent('https://example.com/page?bmsu=uuid-123')).toString('base64');

      await controller.redirect(mockResponse, mockRequest, url, null);

      expect(mockResponse.cookie).toHaveBeenCalledWith('bmsUUID', 'uuid-123', expect.any(Object));
      expect(mockResponse.redirect).toHaveBeenCalledWith(302, expect.any(String));
    });

    it('should use bmsu query param when provided', async () => {
      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as any;
      const mockRequest = {
        hostname: 'tracker.example.com',
      } as any;
      const url = Buffer.from(encodeURIComponent('https://example.com/page')).toString('base64');

      await controller.redirect(mockResponse, mockRequest, url, 'direct-uuid');

      expect(mockResponse.cookie).toHaveBeenCalledWith('bmsUUID', 'direct-uuid', expect.any(Object));
    });

    it('should set utm_id cookie when present', async () => {
      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as any;
      const mockRequest = {
        hostname: 'tracker.example.com',
      } as any;
      const url = Buffer.from(encodeURIComponent('https://example.com/page?utm_id=campaign123')).toString('base64');

      await controller.redirect(mockResponse, mockRequest, url, null);

      expect(mockResponse.cookie).toHaveBeenCalledWith('utm_id', 'campaign123', expect.any(Object));
    });

    it('should set bmsInfo cookie when contact is found by bmsUUID', async () => {
      const mockContact = { uuid: 'uuid-123', email: 'test@test.com', lc: null, lo: null };
      (msgopsService.findContact as jest.Mock).mockResolvedValue(mockContact);
      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as any;
      const mockRequest = {
        hostname: 'tracker.example.com',
      } as any;
      const url = Buffer.from(encodeURIComponent('https://example.com/page?bmsu=uuid-123')).toString('base64');

      await controller.redirect(mockResponse, mockRequest, url, null);

      expect(msgopsService.findContact).toHaveBeenCalledWith('u', 'uuid-123');
      expect(mockResponse.cookie).toHaveBeenCalledWith('bmsInfo', expect.any(String), expect.objectContaining({ maxAge: expect.any(Number) }));
    });

    it('should handle error when contact lookup fails', async () => {
      (msgopsService.findContact as jest.Mock).mockRejectedValue(new Error('DB error'));
      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as any;
      const mockRequest = {
        hostname: 'tracker.example.com',
      } as any;
      const url = Buffer.from(encodeURIComponent('https://example.com/page?bmsu=uuid-123')).toString('base64');

      await controller.redirect(mockResponse, mockRequest, url, null);

      // Should still redirect despite the error
      expect(mockResponse.redirect).toHaveBeenCalledWith(302, expect.any(String));
    });

    it('should set bmst cookie when present', async () => {
      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as any;
      const mockRequest = {
        hostname: 'tracker.example.com',
      } as any;
      const url = Buffer.from(encodeURIComponent('https://example.com/page?bmst=token123')).toString('base64');

      await controller.redirect(mockResponse, mockRequest, url, null);

      expect(mockResponse.cookie).toHaveBeenCalledWith('bmst', 'token123', expect.any(Object));
    });

    it('should fire-and-forget publishRedirectClick when bmsUUID and accountId are present', () => {
      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as any;
      const mockRequest = {
        hostname: 'tracker.example.com',
        ip: '1.2.3.4',
        headers: { 'user-agent': 'jest-agent' },
      } as any;
      const url = Buffer.from(encodeURIComponent('https://example.com/page?bmsu=uuid-123&bmsa=5&utm_source=news')).toString('base64');

      controller.redirect(mockResponse, mockRequest, url, null);

      expect(appService.publishRedirectClick).toHaveBeenCalledTimes(1);
      expect(appService.publishRedirectClick).toHaveBeenCalledWith({
        bmsUUID: 'uuid-123',
        accountId: '5',
        decodedUrl: expect.any(String),
        ip: '1.2.3.4',
        userAgent: 'jest-agent',
      });
      const decodedUrlArg = (appService.publishRedirectClick as jest.Mock).mock.calls[0][0].decodedUrl as string;
      expect(decodeURIComponent(decodedUrlArg)).toContain('https://example.com/page');
      expect(decodeURIComponent(decodedUrlArg)).toContain('bmsa=5');
      expect(mockResponse.redirect).toHaveBeenCalledWith(302, expect.any(String));
    });

    it('should not call publishRedirectClick when accountId (bmsa) is missing', () => {
      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as any;
      const mockRequest = {
        hostname: 'tracker.example.com',
        ip: '1.2.3.4',
        headers: { 'user-agent': 'jest-agent' },
      } as any;
      const url = Buffer.from(encodeURIComponent('https://example.com/page?bmsu=uuid-123')).toString('base64');

      controller.redirect(mockResponse, mockRequest, url, null);

      expect(appService.publishRedirectClick).not.toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(302, expect.any(String));
    });

    it('should not call publishRedirectClick when bmsUUID is missing', () => {
      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as any;
      const mockRequest = {
        hostname: 'tracker.example.com',
        ip: '1.2.3.4',
        headers: { 'user-agent': 'jest-agent' },
      } as any;
      const url = Buffer.from(encodeURIComponent('https://example.com/page?bmsa=5')).toString('base64');

      controller.redirect(mockResponse, mockRequest, url, null);

      expect(appService.publishRedirectClick).not.toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith(302, expect.any(String));
    });
  });

  describe('getAccounts()', () => {
    it('should return accounts by email', async () => {
      const mockContacts = [
        { accountId: 1, lo: '2024-01-01' },
        { accountId: 5, lo: '2024-02-01' },
      ];
      (msgopsService.findContact as jest.Mock).mockResolvedValue(undefined);
      (msgopsService.accountsByEmail as jest.Mock).mockResolvedValue(mockContacts);

      const body = { data: Buffer.from(JSON.stringify({ e: 'test@test.com' })).toString('base64') };
      const result = await controller.getAccounts(body);

      expect(result).toEqual({ 1: '2024-01-01', 5: '2024-02-01' });
    });

    it('should resolve email from uuid before searching accounts', async () => {
      const mockContact = { email: 'resolved@test.com' };
      (msgopsService.findContact as jest.Mock).mockResolvedValue(mockContact);
      (msgopsService.accountsByEmail as jest.Mock).mockResolvedValue([]);

      const body = { data: Buffer.from(JSON.stringify({ u: 'uuid-123' })).toString('base64') };
      await controller.getAccounts(body);

      expect(msgopsService.findContact).toHaveBeenCalledWith('u', 'uuid-123');
      expect(msgopsService.accountsByEmail).toHaveBeenCalledWith('resolved@test.com');
    });

    it('should throw NotFoundException for invalid filter key', async () => {
      const body = { data: Buffer.from(JSON.stringify({ x: 'invalid' })).toString('base64') };

      await expect(controller.getAccounts(body)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findContacts()', () => {
    it('should delegate to appService.findContactsByEmail', async () => {
      const mockContact = { email: 'test@test.com' };
      (appService.findContactsByEmail as jest.Mock).mockResolvedValue(mockContact);

      const result = await controller.findContacts('test@test.com', ['details']);

      expect(result).toEqual(mockContact);
      expect(appService.findContactsByEmail).toHaveBeenCalledWith('test@test.com', ['details']);
    });
  });

  describe('redirectShortCode()', () => {
    it('should delegate to appService.processShortLink', async () => {
      const mockRequest = { headers: {} } as any;
      const mockResponse = {} as any;
      (appService.processShortLink as jest.Mock).mockResolvedValue(undefined);

      await controller.redirectShortCode(mockRequest, mockResponse, 'abc123', '1.2.3.4');

      expect(appService.processShortLink).toHaveBeenCalledWith('abc123', '1.2.3.4', mockResponse, mockRequest.headers);
    });
  });
});
