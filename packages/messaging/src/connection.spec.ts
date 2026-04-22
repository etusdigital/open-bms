import * as amqplib from 'amqplib';
import { AmqpConnection, ConnectionClosedError } from './connection';

jest.mock('amqplib');
const mockConnect = amqplib.connect as jest.Mock;

function createMockConn() {
  const handlers: Record<string, Array<(arg?: unknown) => void>> = {};
  const conn = {
    on: jest.fn((event: string, handler: (arg?: unknown) => void) => {
      (handlers[event] ??= []).push(handler);
      return conn;
    }),
    emit(event: string, arg?: unknown) {
      for (const h of handlers[event] ?? []) h(arg);
    },
    createChannel: jest.fn().mockResolvedValue({ id: 'ch' }),
    createConfirmChannel: jest.fn().mockResolvedValue({ id: 'cch' }),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return conn;
}

const FAST_RETRY = { baseMs: 1, maxMs: 10, maxInitialRetries: 3 };

const waitTick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('AmqpConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('lazy connect', () => {
    it('does not connect on construction', () => {
      new AmqpConnection({ url: 'amqp://test' });
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('connects on first getConnection call', async () => {
      const conn = createMockConn();
      mockConnect.mockResolvedValue(conn);

      const c = new AmqpConnection({ url: 'amqp://test' });
      await c.getConnection();

      expect(mockConnect).toHaveBeenCalledWith('amqp://test');
    });

    it('memoizes the connection across calls', async () => {
      const conn = createMockConn();
      mockConnect.mockResolvedValue(conn);

      const c = new AmqpConnection({ url: 'amqp://test' });
      await c.getConnection();
      await c.getConnection();
      await c.getConnection();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('shares the connect promise between concurrent callers', async () => {
      const conn = createMockConn();
      let resolve!: (v: unknown) => void;
      mockConnect.mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );

      const c = new AmqpConnection({ url: 'amqp://test' });
      const p1 = c.getConnection();
      const p2 = c.getConnection();

      resolve(conn);
      await Promise.all([p1, p2]);

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('channel creation', () => {
    it('createChannel delegates to connection', async () => {
      const conn = createMockConn();
      mockConnect.mockResolvedValue(conn);

      const c = new AmqpConnection({ url: 'amqp://test' });
      await c.createChannel();

      expect(conn.createChannel).toHaveBeenCalled();
    });

    it('createConfirmChannel delegates to connection', async () => {
      const conn = createMockConn();
      mockConnect.mockResolvedValue(conn);

      const c = new AmqpConnection({ url: 'amqp://test' });
      await c.createConfirmChannel();

      expect(conn.createConfirmChannel).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('closes the underlying connection', async () => {
      const conn = createMockConn();
      mockConnect.mockResolvedValue(conn);

      const c = new AmqpConnection({ url: 'amqp://test' });
      await c.getConnection();
      await c.close();

      expect(conn.close).toHaveBeenCalled();
    });

    it('is idempotent', async () => {
      const conn = createMockConn();
      mockConnect.mockResolvedValue(conn);

      const c = new AmqpConnection({ url: 'amqp://test' });
      await c.getConnection();
      await c.close();
      await c.close();

      expect(conn.close).toHaveBeenCalledTimes(1);
    });

    it('no-ops when never connected', async () => {
      const c = new AmqpConnection({ url: 'amqp://test' });
      await expect(c.close()).resolves.toBeUndefined();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('rejects getConnection after close with ConnectionClosedError', async () => {
      const c = new AmqpConnection({ url: 'amqp://test' });
      await c.close();
      await expect(c.getConnection()).rejects.toBeInstanceOf(ConnectionClosedError);
    });
  });

  describe('reconnect', () => {
    it('reconnects after connection close event', async () => {
      const conn1 = createMockConn();
      const conn2 = createMockConn();
      mockConnect.mockResolvedValueOnce(conn1).mockResolvedValueOnce(conn2);

      const c = new AmqpConnection({ url: 'amqp://test' }, FAST_RETRY);
      const reconnected = new Promise<void>((resolve) => c.onReconnect(resolve));

      await c.getConnection();
      conn1.emit('close');

      await reconnected;
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('reconnects after connection error event', async () => {
      const conn1 = createMockConn();
      const conn2 = createMockConn();
      mockConnect.mockResolvedValueOnce(conn1).mockResolvedValueOnce(conn2);

      const c = new AmqpConnection({ url: 'amqp://test' }, FAST_RETRY);
      const reconnected = new Promise<void>((resolve) => c.onReconnect(resolve));

      await c.getConnection();
      conn1.emit('error', new Error('boom'));

      await reconnected;
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('deduplicates close+error events into one reconnect', async () => {
      const conn1 = createMockConn();
      const conn2 = createMockConn();
      mockConnect.mockResolvedValueOnce(conn1).mockResolvedValueOnce(conn2);

      const c = new AmqpConnection({ url: 'amqp://test' }, FAST_RETRY);
      const reconnected = new Promise<void>((resolve) => c.onReconnect(resolve));

      await c.getConnection();
      conn1.emit('error', new Error('boom'));
      conn1.emit('close');

      await reconnected;
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('does not reconnect after explicit close', async () => {
      const conn1 = createMockConn();
      mockConnect.mockResolvedValue(conn1);

      const c = new AmqpConnection({ url: 'amqp://test' }, FAST_RETRY);
      const listener = jest.fn();
      c.onReconnect(listener);

      await c.getConnection();
      await c.close();
      conn1.emit('close');

      await waitTick();

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(listener).not.toHaveBeenCalled();
    });

    it('fires all onReconnect listeners', async () => {
      const conn1 = createMockConn();
      const conn2 = createMockConn();
      mockConnect.mockResolvedValueOnce(conn1).mockResolvedValueOnce(conn2);

      const c = new AmqpConnection({ url: 'amqp://test' }, FAST_RETRY);
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      c.onReconnect(cb1);
      c.onReconnect(cb2);

      await c.getConnection();
      conn1.emit('close');
      await waitTick();

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it('continues firing remaining listeners if one throws', async () => {
      const conn1 = createMockConn();
      const conn2 = createMockConn();
      mockConnect.mockResolvedValueOnce(conn1).mockResolvedValueOnce(conn2);

      const c = new AmqpConnection({ url: 'amqp://test' }, FAST_RETRY);
      const cb1 = jest.fn(() => {
        throw new Error('bad listener');
      });
      const cb2 = jest.fn();
      c.onReconnect(cb1);
      c.onReconnect(cb2);

      await c.getConnection();
      conn1.emit('close');
      await waitTick();

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });
  });

  describe('initial connect failure', () => {
    it('retries initial connect up to maxInitialRetries', async () => {
      mockConnect.mockRejectedValue(new Error('broker down'));

      const c = new AmqpConnection({ url: 'amqp://test' }, FAST_RETRY);
      await expect(c.getConnection()).rejects.toThrow('broker down');

      expect(mockConnect).toHaveBeenCalledTimes(FAST_RETRY.maxInitialRetries);
    });

    it('succeeds if a later attempt recovers', async () => {
      const conn = createMockConn();
      mockConnect
        .mockRejectedValueOnce(new Error('broker down'))
        .mockResolvedValueOnce(conn);

      const c = new AmqpConnection({ url: 'amqp://test' }, FAST_RETRY);
      await c.getConnection();

      expect(mockConnect).toHaveBeenCalledTimes(2);
    });
  });
});
