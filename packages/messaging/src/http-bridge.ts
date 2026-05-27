import type { Handler } from './types';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface HttpBridgeConfig {
  endpoint: string;
  token: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  /**
   * Abort the HTTP call after this many ms. A timed-out request returns
   * 'nack' so the Consumer's exponential backoff retry handles it.
   * Default: 30_000 (30s).
   */
  timeoutMs?: number;
}

export function createHttpBridgeHandler(config: HttpBridgeConfig): Handler {
  const doFetch = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (payload, ctx) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await doFetch(config.endpoint, {
        method: 'POST',
        headers: {
          ...config.headers,
          'X-Internal-Token': config.token,
          'Content-Type': 'application/json',
          'X-Bms-Attempt': String(ctx.attempt),
          'X-Bms-Routing-Key': ctx.routingKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        // Timeout — treat as retriable failure
        return 'nack';
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    // Drain the body so undici returns the socket to the keep-alive pool
    try {
      await res.body?.cancel();
    } catch {
      // best effort; body already consumed/closed
    }

    // 429 and 5xx are retriable via Layer 1 (AMQP retry with exponential
    // backoff). Using 'requeue' for 429 would hot-loop on persistent
    // rate limits, so we prefer 'nack' for both.
    if (res.status === 429 || res.status >= 500) return 'nack';
    return 'ack';
  };
}
