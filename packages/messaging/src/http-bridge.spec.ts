import { createHttpBridgeHandler } from './http-bridge';
import type { MessageContext } from './types';

function makeCtx(overrides: Partial<MessageContext> = {}): MessageContext {
  return {
    attempt: 1,
    headers: {},
    routingKey: 'email.send',
    queue: 'send-email.email.send',
    ...overrides,
  };
}

describe('createHttpBridgeHandler', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
  });

  describe('request shape', () => {
    it('POSTs to the configured endpoint with token and JSON body', async () => {
      mockFetch.mockResolvedValue({ status: 200 });
      const handler = createHttpBridgeHandler({
        endpoint: 'http://localhost:3000/internal/email/send',
        token: 'secret-token',
        fetchImpl: mockFetch,
      });

      await handler({ to: 'a@b.com', subject: 'hi' }, makeCtx());

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toBe('http://localhost:3000/internal/email/send');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ to: 'a@b.com', subject: 'hi' }));
      expect(init.headers).toMatchObject({
        'X-Internal-Token': 'secret-token',
        'Content-Type': 'application/json',
      });
    });

    it('includes attempt and routing key as tracing headers', async () => {
      mockFetch.mockResolvedValue({ status: 200 });
      const handler = createHttpBridgeHandler({
        endpoint: 'http://test',
        token: 't',
        fetchImpl: mockFetch,
      });

      await handler(
        {},
        makeCtx({ attempt: 3, routingKey: 'email.send.batch' }),
      );

      const headers = mockFetch.mock.calls[0]![1].headers;
      expect(headers['X-Bms-Attempt']).toBe('3');
      expect(headers['X-Bms-Routing-Key']).toBe('email.send.batch');
    });

    it('merges extra headers from config without overriding token', async () => {
      mockFetch.mockResolvedValue({ status: 200 });
      const handler = createHttpBridgeHandler({
        endpoint: 'http://test',
        token: 'real-token',
        fetchImpl: mockFetch,
        headers: {
          'X-Correlation-Id': 'abc-123',
          'X-Internal-Token': 'hacker-token',
        },
      });

      await handler({}, makeCtx());

      const headers = mockFetch.mock.calls[0]![1].headers;
      expect(headers['X-Correlation-Id']).toBe('abc-123');
      expect(headers['X-Internal-Token']).toBe('real-token');
    });
  });

  describe('status code translation', () => {
    it.each([
      [200, 'ack'],
      [201, 'ack'],
      [204, 'ack'],
      [299, 'ack'],
      [400, 'ack'],
      [404, 'ack'],
      [422, 'ack'],
      [428, 'ack'],
      [429, 'requeue'],
      [500, 'nack'],
      [502, 'nack'],
      [503, 'nack'],
      [599, 'nack'],
    ])('HTTP %i → %s', async (status, expected) => {
      mockFetch.mockResolvedValue({ status });
      const handler = createHttpBridgeHandler({
        endpoint: 'http://test',
        token: 't',
        fetchImpl: mockFetch,
      });

      const result = await handler({}, makeCtx());
      expect(result).toBe(expected);
    });
  });

  describe('network failures', () => {
    it('propagates fetch errors so Consumer retry layer handles them', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const handler = createHttpBridgeHandler({
        endpoint: 'http://test',
        token: 't',
        fetchImpl: mockFetch,
      });

      await expect(handler({}, makeCtx())).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('payload serialization', () => {
    it('serializes null payload as JSON null', async () => {
      mockFetch.mockResolvedValue({ status: 200 });
      const handler = createHttpBridgeHandler({
        endpoint: 'http://test',
        token: 't',
        fetchImpl: mockFetch,
      });

      await handler(null, makeCtx());

      expect(mockFetch.mock.calls[0]![1].body).toBe('null');
    });

    it('preserves nested structures', async () => {
      mockFetch.mockResolvedValue({ status: 200 });
      const handler = createHttpBridgeHandler({
        endpoint: 'http://test',
        token: 't',
        fetchImpl: mockFetch,
      });

      await handler({ nested: { a: [1, 2, 3], b: true } }, makeCtx());

      expect(mockFetch.mock.calls[0]![1].body).toBe(
        JSON.stringify({ nested: { a: [1, 2, 3], b: true } }),
      );
    });
  });
});
