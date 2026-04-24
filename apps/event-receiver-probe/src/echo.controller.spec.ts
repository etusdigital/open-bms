import { Test, TestingModule } from '@nestjs/testing';
import { FastifyReply, FastifyRequest } from 'fastify';
import { EchoController } from './echo.controller';

describe('EchoController', () => {
  let controller: EchoController;
  let consoleLogSpy: jest.SpyInstance;
  const originalToken = process.env.INTERNAL_AUTH_TOKEN;
  const originalForce = process.env.PROBE_ALWAYS_ERROR;

  beforeEach(async () => {
    process.env.INTERNAL_AUTH_TOKEN = 'dev-probe-token';
    delete process.env.PROBE_ALWAYS_ERROR;
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EchoController],
    }).compile();

    controller = module.get<EchoController>(EchoController);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    process.env.INTERNAL_AUTH_TOKEN = originalToken;
    if (originalForce === undefined) delete process.env.PROBE_ALWAYS_ERROR;
    else process.env.PROBE_ALWAYS_ERROR = originalForce;
  });

  const mockReply = () => {
    const reply: Partial<FastifyReply> & { _status?: number; _body?: unknown } = {};
    reply.status = jest.fn().mockImplementation((code: number) => {
      reply._status = code;
      return reply as FastifyReply;
    });
    reply.send = jest.fn().mockImplementation((body: unknown) => {
      reply._body = body;
      return reply as FastifyReply;
    });
    return reply as FastifyReply & { _status: number; _body: unknown };
  };

  const mockRequest = (headers: Record<string, string> = {}): FastifyRequest =>
    ({ headers }) as unknown as FastifyRequest;

  it('returns 401 without token', async () => {
    const reply = mockReply();
    await controller.handle(mockRequest({}), reply);
    expect(reply._status).toBe(401);
    expect(reply._body).toEqual({ error: 'unauthorized' });
  });

  it('returns 401 with wrong token', async () => {
    const reply = mockReply();
    await controller.handle(mockRequest({ 'x-internal-token': 'wrong' }), reply);
    expect(reply._status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const reply = mockReply();
    await controller.handle(
      mockRequest({
        'x-internal-token': 'dev-probe-token',
        'x-bms-attempt': '1',
        'x-bms-routing-key': 'event.received.sendgrid',
      }),
      reply,
    );
    expect(reply._status).toBe(200);
    expect(reply._body).toEqual({ received: true });
  });

  it('honors X-Probe-Force-Error header', async () => {
    const reply = mockReply();
    await controller.handle(
      mockRequest({
        'x-internal-token': 'dev-probe-token',
        'x-probe-force-error': '503',
        'x-bms-attempt': '2',
      }),
      reply,
    );
    expect(reply._status).toBe(503);
    expect(reply._body).toEqual({ forced: true });
  });

  it('honors PROBE_ALWAYS_ERROR env var', async () => {
    process.env.PROBE_ALWAYS_ERROR = '500';
    const reply = mockReply();
    await controller.handle(mockRequest({ 'x-internal-token': 'dev-probe-token', 'x-bms-attempt': '1' }), reply);
    expect(reply._status).toBe(500);
  });

  it('ignores invalid force values (out of range)', async () => {
    const reply = mockReply();
    await controller.handle(
      mockRequest({
        'x-internal-token': 'dev-probe-token',
        'x-probe-force-error': 'notanumber',
      }),
      reply,
    );
    expect(reply._status).toBe(200);
  });
});
