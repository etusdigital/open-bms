import { HttpException, HttpStatus } from '@nestjs/common';
import { AccountMiddleware } from './account.middleware';
import { MsgopsService } from '../msgops/msgops.service';
import { ClsService } from 'nestjs-cls';

describe('AccountMiddleware', () => {
  let middleware: AccountMiddleware;
  let msgopsService: Partial<MsgopsService>;
  let clsService: Partial<ClsService>;
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    msgopsService = {
      findByConfig: jest.fn(),
    };
    clsService = {
      get: jest.fn(),
      set: jest.fn(),
    };
    middleware = new AccountMiddleware(msgopsService as MsgopsService, clsService as ClsService);
    mockReq = { headers: {} };
    mockRes = {};
    mockNext = jest.fn();
  });

  it('should call next() when api-key header is valid', async () => {
    (clsService.get as jest.Mock).mockReturnValue('valid-api-key');
    (msgopsService.findByConfig as jest.Mock).mockResolvedValue({ accountId: 42 });

    await middleware.use(mockReq, mockRes, mockNext);

    expect(clsService.set).toHaveBeenCalledWith('accountId', 42);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when api-key header is missing', async () => {
    (clsService.get as jest.Mock).mockReturnValue(undefined);

    await expect(middleware.use(mockReq, mockRes, mockNext)).rejects.toThrow(new HttpException('[Unauthorized]', HttpStatus.UNAUTHORIZED));
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when api-key does not match any account', async () => {
    (clsService.get as jest.Mock).mockReturnValue('invalid-key');
    (msgopsService.findByConfig as jest.Mock).mockResolvedValue(null);

    await expect(middleware.use(mockReq, mockRes, mockNext)).rejects.toThrow(new HttpException('[Unauthorized]', HttpStatus.UNAUTHORIZED));
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should set accountId in ClsService when key is valid', async () => {
    (clsService.get as jest.Mock).mockReturnValue('valid-api-key');
    (msgopsService.findByConfig as jest.Mock).mockResolvedValue({ accountId: 99 });

    await middleware.use(mockReq, mockRes, mockNext);

    expect(clsService.set).toHaveBeenCalledWith('accountId', 99);
  });

  it('should call next() immediately for mobile requests', async () => {
    (clsService.get as jest.Mock).mockReturnValue('valid-api-key');
    (msgopsService.findByConfig as jest.Mock).mockResolvedValue({ accountId: 42 });
    mockReq.headers['x-requester'] = 'mobile';

    await middleware.use(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should call next() for non-mobile requests after setting accountId', async () => {
    (clsService.get as jest.Mock).mockReturnValue('valid-api-key');
    (msgopsService.findByConfig as jest.Mock).mockResolvedValue({ accountId: 42 });

    await middleware.use(mockReq, mockRes, mockNext);

    expect(clsService.set).toHaveBeenCalledWith('accountId', 42);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should throw when findByConfig returns config without accountId', async () => {
    (clsService.get as jest.Mock).mockReturnValue('valid-api-key');
    (msgopsService.findByConfig as jest.Mock).mockResolvedValue({ accountId: null });

    await expect(middleware.use(mockReq, mockRes, mockNext)).rejects.toThrow(new HttpException('[Unauthorized]', HttpStatus.UNAUTHORIZED));
  });
});
