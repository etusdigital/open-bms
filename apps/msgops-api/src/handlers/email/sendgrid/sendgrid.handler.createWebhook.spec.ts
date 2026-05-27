import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';

jest.mock('@sendgrid/mail', () => ({ setApiKey: jest.fn(), sendMultiple: jest.fn() }));

import { SendgridHandler } from './sendgrid.handler';

function makeAxiosResponse(data: unknown) {
  return of({ data });
}

function makeHttpService(overrides: { get?: jest.Mock; patch?: jest.Mock; post?: jest.Mock } = {}) {
  return {
    get: overrides.get ?? jest.fn().mockReturnValue(makeAxiosResponse({ webhooks: [] })),
    patch: overrides.patch ?? jest.fn().mockReturnValue(makeAxiosResponse({})),
    post: overrides.post ?? jest.fn().mockReturnValue(makeAxiosResponse({})),
  };
}

function makeSystemConfigCache(webhookUrlBase = 'https://bms.example.com') {
  return {
    get: jest.fn().mockResolvedValue({ webhookUrlBase, apiBaseUrl: 'https://api.sendgrid.com' }),
  };
}

function makeHandler(httpServiceOverrides: Parameters<typeof makeHttpService>[0] = {}) {
  const httpService = makeHttpService(httpServiceOverrides);
  const systemConfigCache = makeSystemConfigCache();
  const handler = new SendgridHandler(httpService as any, { getByAccountId: jest.fn().mockResolvedValue(null) } as any, { get: jest.fn() } as any, systemConfigCache as any);
  return { handler, httpService, systemConfigCache };
}

const OPTIONS = { apiKey: 'SG.testkey', accountId: 7 };
const EXPECTED_URL = 'https://bms.example.com/bms/events?platform=sendgrid&account=7';

describe('SendgridHandler.createWebhook', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('PATCHes the matching webhook when URL already registered', async () => {
    const { handler, httpService } = makeHandler({
      get: jest.fn().mockReturnValue(makeAxiosResponse({ webhooks: [{ id: 'wh-1', url: EXPECTED_URL }] })),
    });
    const result = await handler.createWebhook(OPTIONS);
    expect(result).toEqual({ url: EXPECTED_URL });
    expect(httpService.patch).toHaveBeenCalledWith(expect.stringContaining('/wh-1'), expect.objectContaining({ url: EXPECTED_URL }), expect.anything());
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('POSTs when no webhooks exist at all', async () => {
    const { handler, httpService } = makeHandler({
      get: jest.fn().mockReturnValue(makeAxiosResponse({ webhooks: [] })),
    });
    await handler.createWebhook(OPTIONS);
    expect(httpService.post).toHaveBeenCalledWith(expect.stringContaining('/user/webhooks/event/settings'), expect.objectContaining({ url: EXPECTED_URL }), expect.anything());
    expect(httpService.patch).not.toHaveBeenCalled();
  });

  it('PATCHes the bms-prod webhook when no URL match (free-plan, named slot)', async () => {
    const { handler, httpService } = makeHandler({
      get: jest.fn().mockReturnValue(
        makeAxiosResponse({
          webhooks: [
            { id: 'wh-other', url: 'https://other.example.com/hook', friendly_name: 'other-service' },
            { id: 'wh-bms', url: 'https://old-bms.example.com/hook', friendly_name: 'bms-prod' },
          ],
        }),
      ),
    });
    await handler.createWebhook(OPTIONS);
    expect(httpService.patch).toHaveBeenCalledWith(expect.stringContaining('/wh-bms'), expect.anything(), expect.anything());
    expect(warnSpy).toHaveBeenCalledWith('SendGrid free-plan: overwriting existing webhook', expect.objectContaining({ targetId: 'wh-bms' }));
  });

  it('falls back to webhooks[0] when no URL match and no bms-prod slot found', async () => {
    const { handler, httpService } = makeHandler({
      get: jest.fn().mockReturnValue(
        makeAxiosResponse({
          webhooks: [{ id: 'wh-first', url: 'https://first.example.com/hook', friendly_name: 'something-else' }],
        }),
      ),
    });
    await handler.createWebhook(OPTIONS);
    expect(httpService.patch).toHaveBeenCalledWith(expect.stringContaining('/wh-first'), expect.anything(), expect.anything());
    expect(warnSpy).toHaveBeenCalledWith('SendGrid free-plan: overwriting existing webhook', expect.objectContaining({ targetId: 'wh-first' }));
  });

  describe('error status mapping', () => {
    function makeFailingHandler(status: number, sgErrors?: Array<{ message: string }>) {
      const axiosError = { response: { status, data: { errors: sgErrors ?? [] } } };
      return makeHandler({
        get: jest.fn().mockReturnValue(throwError(() => axiosError)),
      });
    }

    it('maps SendGrid 401 → HTTP 401 UNAUTHORIZED', async () => {
      const { handler } = makeFailingHandler(401);
      await expect(handler.createWebhook(OPTIONS)).rejects.toSatisfyStatus(HttpStatus.UNAUTHORIZED);
    });

    it('maps SendGrid 403 → HTTP 403 FORBIDDEN', async () => {
      const { handler } = makeFailingHandler(403);
      await expect(handler.createWebhook(OPTIONS)).rejects.toSatisfyStatus(HttpStatus.FORBIDDEN);
    });

    it('maps SendGrid 429 → HTTP 429 TOO_MANY_REQUESTS', async () => {
      const { handler } = makeFailingHandler(429);
      await expect(handler.createWebhook(OPTIONS)).rejects.toSatisfyStatus(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('maps SendGrid 400/422 → HTTP 422 UNPROCESSABLE_ENTITY', async () => {
      const { handler } = makeFailingHandler(422, [{ message: 'url is invalid' }]);
      const err = await handler.createWebhook(OPTIONS).catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect((err as HttpException).message).toBe('url is invalid');
    });

    it('maps SendGrid 5xx → HTTP 502 BAD_GATEWAY', async () => {
      const { handler } = makeFailingHandler(503);
      await expect(handler.createWebhook(OPTIONS)).rejects.toSatisfyStatus(HttpStatus.BAD_GATEWAY);
    });

    it('maps network error (no response) → HTTP 502 BAD_GATEWAY', async () => {
      const { handler } = makeHandler({
        get: jest.fn().mockReturnValue(throwError(() => new Error('connect ETIMEDOUT'))),
      });
      await expect(handler.createWebhook(OPTIONS)).rejects.toSatisfyStatus(HttpStatus.BAD_GATEWAY);
    });
  });
});

expect.extend({
  toSatisfyStatus(received: unknown, expectedStatus: HttpStatus) {
    const pass = received instanceof HttpException && received.getStatus() === expectedStatus;
    return {
      pass,
      message: () =>
        pass
          ? `Expected exception NOT to have status ${expectedStatus}`
          : `Expected HttpException with status ${expectedStatus}, got ${received instanceof HttpException ? received.getStatus() : String(received)}`,
    };
  },
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toSatisfyStatus(status: HttpStatus): R;
    }
  }
}
