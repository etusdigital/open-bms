import type { Handler } from './types';

export interface HttpBridgeConfig {
  endpoint: string;
  token: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export function createHttpBridgeHandler(config: HttpBridgeConfig): Handler {
  const doFetch = config.fetchImpl ?? fetch;

  return async (payload, ctx) => {
    const res = await doFetch(config.endpoint, {
      method: 'POST',
      headers: {
        ...config.headers,
        'X-Internal-Token': config.token,
        'Content-Type': 'application/json',
        'X-Bms-Attempt': String(ctx.attempt),
        'X-Bms-Routing-Key': ctx.routingKey,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 429) return 'requeue';
    if (res.status >= 500) return 'nack';
    return 'ack';
  };
}
