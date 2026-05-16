import { AxiosError } from 'axios';
import { EnterpriseClient } from './enterprise.client';
import { EnterpriseApi4xxError, EnterpriseApi5xxError, EnterpriseApi404Error, EnterpriseApiTimeoutError } from './errors';

// F19: cobre as semânticas reais de retry/backoff do requestWithRetry —
// 4xx short-circuit, 404 tolerado, 5xx exponencial+exaustão, 429 backoff
// (com fake timers, sem esperar 60s reais) e normalização do paged().
// O transporte é injetado num seam legítimo (this.http.request) — toda a
// lógica de classificação/retry/backoff é exercida de verdade.
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

  // Resolve os sleeps imediatamente (inclusive o backoff de 60s do 429) sem
  // esperar tempo real — invoca o callback na hora.
  function autoFlushTimers() {
    jest.spyOn(global, 'setTimeout').mockImplementation(((cb: any) => {
      cb();
      return 0 as any;
    }) as any);
  }

  it('4xx (não-429) lança 4xx SEM retry nem sleep', async () => {
    const fn = transport([{ status: 401, data: { message: 'unauthorized' } }]);
    const sleepSpy = jest.spyOn(global, 'setTimeout');
    await expect(session(fn).listTags({ page: 1 })).rejects.toBeInstanceOf(EnterpriseApi4xxError);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  it('404 tolerado → vazio; 404 não-tolerado → EnterpriseApi404Error', async () => {
    // listEmailTemplates usa paged(..., tolerate404=true): 404 vira página vazia
    // (algumas versões do Enterprise não expõem /emails-templates).
    expect(await session(transport([{ status: 404 }])).listEmailTemplates({ page: 1 })).toEqual({ results: [], page: 1, totalItems: 0, itemsPerPage: 0 });
    // listContacts usa paged(...) sem tolerate404: 404 não-tolerado propaga.
    await expect(session(transport([{ status: 404 }])).listContacts({ page: 1 })).rejects.toBeInstanceOf(EnterpriseApi404Error);
  });

  it('5xx faz 5 retries e esgota → EnterpriseApi5xxError (6 chamadas)', async () => {
    autoFlushTimers();
    const fn = transport(Array(10).fill({ status: 503 }));
    await expect(session(fn).listTags({ page: 1 })).rejects.toBeInstanceOf(EnterpriseApi5xxError);
    expect(fn).toHaveBeenCalledTimes(6);
  });

  it('timeout esgota retries → EnterpriseApiTimeoutError', async () => {
    autoFlushTimers();
    const fn = transport(Array(10).fill({ error: 'timeout' as const }));
    await expect(session(fn).listTags({ page: 1 })).rejects.toBeInstanceOf(EnterpriseApiTimeoutError);
    expect(fn).toHaveBeenCalledTimes(6);
  });

  it('429 faz backoff e, em sucesso seguinte, resolve', async () => {
    autoFlushTimers();
    const fn = transport([{ status: 429 }, { status: 429 }, { status: 200, data: { results: [{ id: 1 }] } }]);
    const res = await session(fn).listContacts({ page: 1, itemsPerPage: 10 });
    expect(res.results).toEqual([{ id: 1 }]);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('429 estoura MAX_RATE_LIMIT_RETRIES → EnterpriseApi4xxError(429)', async () => {
    autoFlushTimers();
    const fn = transport(Array(10).fill({ status: 429 }));
    await expect(session(fn).listTags({ page: 1 })).rejects.toBeInstanceOf(EnterpriseApi4xxError);
  });

  it('paged() normaliza array puro e objeto {results,...}', async () => {
    const arr = await session(transport([{ status: 200, data: [{ id: 1 }, { id: 2 }] }])).listTags({ page: 1 });
    expect(arr.results).toHaveLength(2);
    expect(arr.totalItems).toBe(2);
    const obj = await session(transport([{ status: 200, data: { results: [{ id: 9 }], page: 2, totalItems: 50 } }])).listTags({ page: 2 });
    expect(obj.results).toEqual([{ id: 9 }]);
    expect(obj.totalItems).toBe(50);
    expect(obj.page).toBe(2);
  });
});
