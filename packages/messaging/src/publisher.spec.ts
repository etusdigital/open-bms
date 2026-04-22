import * as amqplib from 'amqplib';
import {
  AmqpPublisher,
  PublisherClosedError,
  SerializationError,
} from './publisher';
import { DLX, EXCHANGES } from './exchanges';

jest.mock('amqplib');
const mockConnect = amqplib.connect as jest.Mock;

function createMockChannel() {
  const handlers: Record<string, Array<(arg?: unknown) => void>> = {};
  const ch = {
    on: jest.fn((event: string, handler: (arg?: unknown) => void) => {
      (handlers[event] ??= []).push(handler);
      return ch;
    }),
    emit(event: string, arg?: unknown) {
      for (const h of handlers[event] ?? []) h(arg);
    },
    assertExchange: jest.fn().mockResolvedValue({ exchange: 'x' }),
    publish: jest.fn().mockReturnValue(true),
    waitForConfirms: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return ch;
}

function createMockConn(channel: ReturnType<typeof createMockChannel>) {
  const handlers: Record<string, Array<(arg?: unknown) => void>> = {};
  const conn = {
    on: jest.fn((event: string, handler: (arg?: unknown) => void) => {
      (handlers[event] ??= []).push(handler);
      return conn;
    }),
    emit(event: string, arg?: unknown) {
      for (const h of handlers[event] ?? []) h(arg);
    },
    createChannel: jest.fn(),
    createConfirmChannel: jest.fn().mockResolvedValue(channel),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return conn;
}

const FAST_RETRY = { baseMs: 1, maxMs: 10, maxInitialRetries: 3 };

type MockChannel = ReturnType<typeof createMockChannel>;
type MockConn = ReturnType<typeof createMockConn>;

function setup(): { channel: MockChannel; conn: MockConn; publisher: AmqpPublisher } {
  const channel = createMockChannel();
  const conn = createMockConn(channel);
  mockConnect.mockResolvedValue(conn);
  const publisher = new AmqpPublisher({ url: 'amqp://test' }, FAST_RETRY);
  return { channel, conn, publisher };
}

describe('AmqpPublisher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('happy path', () => {
    it('asserts DLX and exchange on first publish, then publishes with confirm', async () => {
      const { channel, publisher } = setup();

      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send',
        payload: { to: 'a@b.com' },
      });

      expect(channel.assertExchange).toHaveBeenCalledWith(DLX, 'topic', {
        durable: true,
      });
      expect(channel.assertExchange).toHaveBeenCalledWith(
        EXCHANGES.email,
        'topic',
        { durable: true },
      );
      expect(channel.assertExchange).toHaveBeenCalledTimes(2);
      expect(channel.publish).toHaveBeenCalledTimes(1);
      expect(channel.publish).toHaveBeenCalledWith(
        EXCHANGES.email,
        'email.send',
        expect.any(Buffer),
        expect.objectContaining({
          persistent: true,
          contentType: 'application/json',
        }),
      );
      expect(channel.waitForConfirms).toHaveBeenCalledTimes(1);
    });

    it('does not re-assert exchange on subsequent publishes', async () => {
      const { channel, publisher } = setup();

      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send',
        payload: {},
      });
      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send.batch',
        payload: {},
      });
      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.error',
        payload: {},
      });

      // DLX once + email once across three publishes
      expect(channel.assertExchange).toHaveBeenCalledTimes(2);
      expect(channel.publish).toHaveBeenCalledTimes(3);
    });

    it('serializes payload as a JSON buffer', async () => {
      const { channel, publisher } = setup();

      const payload = { to: 'a@b.com', subject: 'hi', items: [1, 2, 3] };
      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send',
        payload,
      });

      const [, , body] = channel.publish.mock.calls[0] as [
        string,
        string,
        Buffer,
      ];
      expect(body).toBeInstanceOf(Buffer);
      expect(JSON.parse(body.toString('utf8'))).toEqual(payload);
    });
  });

  describe('publish options', () => {
    it('defaults persistent to true', async () => {
      const { channel, publisher } = setup();

      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send',
        payload: {},
      });

      const opts = channel.publish.mock.calls[0]?.[3] as { persistent: boolean };
      expect(opts.persistent).toBe(true);
    });

    it('honors explicit persistent=false', async () => {
      const { channel, publisher } = setup();

      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send',
        payload: {},
        persistent: false,
      });

      const opts = channel.publish.mock.calls[0]?.[3] as { persistent: boolean };
      expect(opts.persistent).toBe(false);
    });

    it('forwards headers to the broker', async () => {
      const { channel, publisher } = setup();

      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send',
        payload: {},
        headers: { 'x-correlation-id': 'abc-123', 'x-attempt': 1 },
      });

      const opts = channel.publish.mock.calls[0]?.[3] as {
        headers: Record<string, unknown>;
      };
      expect(opts.headers).toEqual({
        'x-correlation-id': 'abc-123',
        'x-attempt': 1,
      });
    });
  });

  describe('serialization failures', () => {
    it('rejects bigint payload with SerializationError', async () => {
      const { channel, publisher } = setup();

      await expect(
        publisher.publish({
          exchange: EXCHANGES.email,
          routingKey: 'email.send',
          payload: { n: 1n },
        }),
      ).rejects.toBeInstanceOf(SerializationError);

      expect(channel.publish).not.toHaveBeenCalled();
      expect(channel.waitForConfirms).not.toHaveBeenCalled();
    });

    it('rejects circular payload with SerializationError', async () => {
      const { channel, publisher } = setup();

      const circular: Record<string, unknown> = {};
      circular.self = circular;

      await expect(
        publisher.publish({
          exchange: EXCHANGES.email,
          routingKey: 'email.send',
          payload: circular,
        }),
      ).rejects.toBeInstanceOf(SerializationError);

      expect(channel.publish).not.toHaveBeenCalled();
    });

    it('rejects undefined payload with SerializationError', async () => {
      const { channel, publisher } = setup();

      await expect(
        publisher.publish({
          exchange: EXCHANGES.email,
          routingKey: 'email.send',
          payload: undefined,
        }),
      ).rejects.toBeInstanceOf(SerializationError);

      expect(channel.publish).not.toHaveBeenCalled();
    });
  });

  describe('broker failures', () => {
    it('rejects when waitForConfirms rejects (broker nack)', async () => {
      const { channel, publisher } = setup();
      channel.waitForConfirms.mockRejectedValue(new Error('broker nack'));

      await expect(
        publisher.publish({
          exchange: EXCHANGES.email,
          routingKey: 'email.send',
          payload: {},
        }),
      ).rejects.toThrow('broker nack');
    });
  });

  describe('close', () => {
    it('closes channel and underlying connection', async () => {
      const { channel, conn, publisher } = setup();

      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send',
        payload: {},
      });
      await publisher.close();

      expect(channel.close).toHaveBeenCalledTimes(1);
      expect(conn.close).toHaveBeenCalledTimes(1);
    });

    it('is idempotent', async () => {
      const { channel, conn, publisher } = setup();

      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send',
        payload: {},
      });
      await publisher.close();
      await publisher.close();

      expect(channel.close).toHaveBeenCalledTimes(1);
      expect(conn.close).toHaveBeenCalledTimes(1);
    });

    it('no-ops when never published', async () => {
      const { channel, conn, publisher } = setup();

      await publisher.close();

      expect(channel.close).not.toHaveBeenCalled();
      expect(conn.close).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('rejects publish after close with PublisherClosedError', async () => {
      const { publisher } = setup();

      await publisher.close();

      await expect(
        publisher.publish({
          exchange: EXCHANGES.email,
          routingKey: 'email.send',
          payload: {},
        }),
      ).rejects.toBeInstanceOf(PublisherClosedError);
    });
  });

  describe('channel recovery', () => {
    it('re-asserts exchange on new channel after channel close event', async () => {
      const channel1 = createMockChannel();
      const channel2 = createMockChannel();
      const conn = createMockConn(channel1);
      conn.createConfirmChannel
        .mockResolvedValueOnce(channel1)
        .mockResolvedValueOnce(channel2);
      mockConnect.mockResolvedValue(conn);

      const publisher = new AmqpPublisher({ url: 'amqp://test' }, FAST_RETRY);

      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send',
        payload: {},
      });

      expect(channel1.assertExchange).toHaveBeenCalledTimes(2);

      channel1.emit('close');

      await publisher.publish({
        exchange: EXCHANGES.email,
        routingKey: 'email.send',
        payload: {},
      });

      expect(channel2.assertExchange).toHaveBeenCalledTimes(2);
      expect(channel2.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrent publish', () => {
    it('deduplicates assertExchange across concurrent first publishes', async () => {
      const { channel, publisher } = setup();

      await Promise.all([
        publisher.publish({
          exchange: EXCHANGES.email,
          routingKey: 'email.send',
          payload: { i: 1 },
        }),
        publisher.publish({
          exchange: EXCHANGES.email,
          routingKey: 'email.send.batch',
          payload: { i: 2 },
        }),
        publisher.publish({
          exchange: EXCHANGES.email,
          routingKey: 'email.error',
          payload: { i: 3 },
        }),
      ]);

      // DLX once + email once despite 3 concurrent publishes
      expect(channel.assertExchange).toHaveBeenCalledTimes(2);
      expect(channel.publish).toHaveBeenCalledTimes(3);
    });

    it('deduplicates assertExchange across concurrent publishes to different exchanges', async () => {
      const { channel, publisher } = setup();

      await Promise.all([
        publisher.publish({
          exchange: EXCHANGES.email,
          routingKey: 'email.send',
          payload: {},
        }),
        publisher.publish({
          exchange: EXCHANGES.events,
          routingKey: 'event.received.sendgrid',
          payload: {},
        }),
        publisher.publish({
          exchange: EXCHANGES.email,
          routingKey: 'email.send.batch',
          payload: {},
        }),
      ]);

      // DLX once + email once + events once = 3
      expect(channel.assertExchange).toHaveBeenCalledTimes(3);
      expect(channel.publish).toHaveBeenCalledTimes(3);
    });
  });
});
