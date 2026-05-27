import { AxiosError } from 'axios';
import { EnterpriseClient } from './enterprise.client';
import { EnterpriseApi4xxError, EnterpriseApi5xxError, EnterpriseApi404Error, EnterpriseApiTimeoutError } from './errors';

// Covers the real retry/backoff semantics of requestWithRetry: 4xx
// short-circuit, tolerated 404, 5xx exponential + exhaustion, 429 backoff
// (fake timers, no real 60s wait), and paged() normalization. The transport
// is injected at a legitimate seam (this.http.request).
describe('EnterpriseClient retry/backoff semantics', () => {
  let client: EnterpriseClient;

  beforeEach(() => {
    client = new EnterpriseClient();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  type Step = { status: number; data?: any } | { error: 'timeout' | 'network' };

  function transport(seq: Step[]) {
    let i = 0;
    return jest.fn(async () => {
      const step = seq[Math.min(i, seq.length - 1)];
      i++;
      if ('error' in step) {
        const err = new Error(step.error) as any;
        err.code = step.error === 'timeout' ? 'ECONNABORTED' : 'ENOTFOUND';
        throw err;
      }
      if (step.status >= 400) {
        const err = new Error(`status ${step.status}`) as AxiosError;
        (err as any).response = { status: step.status, data: step.data ?? { message: 'fail' } };
        throw err;
      }
      return { status: step.status, data: step.data };
    });
  }

  function session(requestFn: jest.Mock) {
    const s = client.createSession('https://x.example.com', 'k');
    (s as any).http = { request: requestFn };
    return s;
  }

  // Resolves sleeps immediately (including the 60s 429 backoff) by invoking
  // the callback synchronously, without waiting real time.
  function autoFlushTimers() {
    jest.spyOn(global, 'setTimeout').mockImplementation(((cb: any) => {
      cb();
      return 0 as any;
    }) as any);
  }

  it('throws on non-429 4xx without retry or sleep', async () => {
    const fn = transport([{ status: 401, data: { message: 'unauthorized' } }]);
    const sleepSpy = jest.spyOn(global, 'setTimeout');
    await expect(session(fn).listTags({ page: 1 })).rejects.toBeInstanceOf(EnterpriseApi4xxError);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  it('tolerated 404 returns empty; non-tolerated 404 throws EnterpriseApi404Error', async () => {
    // listEmailTemplates uses paged(..., tolerate404=true): 404 becomes an
    // empty page so versions lacking the endpoint skip the step without failing.
    expect(await session(transport([{ status: 404 }])).listEmailTemplates({ page: 1 })).toEqual({
      results: [],
      page: 1,
      totalItems: 0,
      itemsPerPage: 0,
    });
    // listContacts uses paged(...) without tolerate404: the 404 propagates.
    await expect(session(transport([{ status: 404 }])).listContacts({ page: 1 })).rejects.toBeInstanceOf(EnterpriseApi404Error);
  });

  it('listEmailTemplates hits /email-template (not /emails-templates)', async () => {
    const fn = transport([{ status: 200, data: [] }]);
    await session(fn).listEmailTemplates({ page: 1 });
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ url: '/email-template' }));
  });

  it('5xx retries 5 times then exhausts into EnterpriseApi5xxError (6 calls)', async () => {
    autoFlushTimers();
    const fn = transport(Array(10).fill({ status: 503 }));
    await expect(session(fn).listTags({ page: 1 })).rejects.toBeInstanceOf(EnterpriseApi5xxError);
    expect(fn).toHaveBeenCalledTimes(6);
  });

  it('timeout exhausts retries into EnterpriseApiTimeoutError', async () => {
    autoFlushTimers();
    const fn = transport(Array(10).fill({ error: 'timeout' as const }));
    await expect(session(fn).listTags({ page: 1 })).rejects.toBeInstanceOf(EnterpriseApiTimeoutError);
    expect(fn).toHaveBeenCalledTimes(6);
  });

  it('429 backs off and resolves on the next success', async () => {
    autoFlushTimers();
    const fn = transport([{ status: 429 }, { status: 429 }, { status: 200, data: { results: [{ id: 1 }] } }]);
    const res = await session(fn).listContacts({ page: 1, itemsPerPage: 10 });
    expect(res.results).toEqual([{ id: 1 }]);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('429 exceeding MAX_RATE_LIMIT_RETRIES throws EnterpriseApi4xxError(429)', async () => {
    autoFlushTimers();
    const fn = transport(Array(10).fill({ status: 429 }));
    await expect(session(fn).listTags({ page: 1 })).rejects.toBeInstanceOf(EnterpriseApi4xxError);
  });

  it('paged() normalizes both a plain array and a {results,...} object', async () => {
    const arr = await session(transport([{ status: 200, data: [{ id: 1 }, { id: 2 }] }])).listTags({ page: 1 });
    expect(arr.results).toHaveLength(2);
    expect(arr.totalItems).toBe(2);
    const obj = await session(transport([{ status: 200, data: { results: [{ id: 9 }], page: 2, totalItems: 50 } }])).listTags({ page: 2 });
    expect(obj.results).toEqual([{ id: 9 }]);
    expect(obj.totalItems).toBe(50);
    expect(obj.page).toBe(2);
  });
});
