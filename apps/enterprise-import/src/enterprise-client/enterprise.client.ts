import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { EnterpriseApi4xxError, EnterpriseApi404Error, EnterpriseApi5xxError, EnterpriseApiTimeoutError } from './errors';

// Normalized paged response: different Enterprise endpoints expose slightly
// different shapes.
export interface PagedResponse<T> {
  results: T[];
  page: number;
  totalItems?: number;
  itemsPerPage?: number;
}

interface PageParams {
  page?: number;
  itemsPerPage?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000];
const RATE_LIMIT_BACKOFF_MS = 60_000;
const MAX_RATE_LIMIT_RETRIES = 3;

@Injectable()
export class EnterpriseClient {
  private readonly logger = new Logger(EnterpriseClient.name);

  // One axios instance per job (baseURL/apiKey differ per job).
  // BMS authenticates managed API keys via the `x-api-key` header;
  // `Authorization: Bearer` would route to user-JWT validation and 401.
  createSession(baseUrl: string, apiKey: string): EnterpriseSession {
    const http = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: DEFAULT_TIMEOUT_MS,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });
    return new EnterpriseSession(http, this.logger);
  }
}

export class EnterpriseSession {
  constructor(
    private readonly http: AxiosInstance,
    private readonly logger: Logger,
  ) {}

  listTags(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/tags', params);
  }

  listCustomFields(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/custom-fields', params);
  }

  // Bulk contact<->custom-field VALUES (contacts_custom_fields rows). Distinct
  // from listCustomFields, which returns the field definitions.
  //
  // The path is TWO segments on purpose: a single-segment `/contacts/<x>` would
  // collide with `/contacts/:id` on an Enterprise not yet redeployed with this
  // endpoint, returning a 500 (findOneById parses "x" as an int) that defeats
  // tolerate404 and would fail the whole job in a retry loop. A two-segment
  // path matches no `:id` route, so older versions return a clean 404, which
  // tolerate404 turns into an empty page -> the step is skipped, not fatal.
  listContactCustomFields(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/contacts/custom-fields/values', params, true);
  }

  listLabels(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/labels', params);
  }

  // `/users` is key-scoped (returns users of the API key's owning account).
  // `/accounts/{id}/users` would 404/403: account-scope has no Enterprise id.
  listUsers(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/users', params);
  }

  // Path is `/email-template` (singular). tolerate404 is kept defensively so
  // Enterprise versions without this endpoint skip the step without failing.
  listEmailTemplates(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/email-template', params, true);
  }

  listContacts(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/contacts', params);
  }

  listAutomations(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/automations', params);
  }

  listCampaigns(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/campaigns', params);
  }

  listMessages(params: PageParams & { campaignId?: number }): Promise<PagedResponse<any>> {
    return this.paged('/messages', params);
  }

  listAllAccounts(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/accounts/all', params);
  }

  private async paged(url: string, params: PageParams & Record<string, any>, tolerate404 = false): Promise<PagedResponse<any>> {
    const data = await this.requestWithRetry({ method: 'GET', url, params, tolerate404 });
    // tolerate404: requestWithRetry returns null on 404; treat as empty.
    if (data == null) return { results: [], page: params.page ?? 1, totalItems: 0, itemsPerPage: 0 };
    // Accept either {results,page,totalItems} or a bare array.
    if (Array.isArray(data)) return { results: data, page: params.page ?? 1, totalItems: data.length, itemsPerPage: data.length };
    return {
      results: data?.results ?? [],
      page: data?.page ?? params.page ?? 1,
      totalItems: data?.totalItems,
      itemsPerPage: data?.itemsPerPage,
    };
  }

  private async requestWithRetry(opts: { method: 'GET' | 'POST'; url: string; params?: Record<string, any>; tolerate404?: boolean }): Promise<any> {
    let attempt = 0;
    let rateLimitRetries = 0;
    // Short-circuit on 4xx; 5xx/timeout/network retried with exponential backoff.
    while (true) {
      try {
        const res: AxiosResponse = await this.http.request({ method: opts.method, url: opts.url, params: opts.params });
        return res.data;
      } catch (err) {
        const ax = err as AxiosError<any>;
        const status = ax.response?.status;
        const isTimeout = ax.code === 'ECONNABORTED' || ax.code === 'ETIMEDOUT' || /timeout/i.test(ax.message);

        if (status === 404 && opts.tolerate404) return null;

        if (status === 429) {
          if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
            throw new EnterpriseApi4xxError(429, 'rate limit exceeded after retries');
          }
          rateLimitRetries++;
          this.logger.warn(`429 on ${opts.url} — backing off ${RATE_LIMIT_BACKOFF_MS}ms (retry ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES})`);
          await sleep(RATE_LIMIT_BACKOFF_MS);
          continue;
        }

        if (status && status >= 400 && status < 500) {
          if (status === 404) throw new EnterpriseApi404Error(extractMessage(ax));
          throw new EnterpriseApi4xxError(status, extractMessage(ax));
        }

        // 5xx, timeout, or network error: retry with backoff.
        if (attempt >= RETRY_DELAYS_MS.length) {
          if (isTimeout) throw new EnterpriseApiTimeoutError(extractMessage(ax));
          if (status && status >= 500) throw new EnterpriseApi5xxError(status, extractMessage(ax));
          throw ax;
        }
        const delay = RETRY_DELAYS_MS[attempt];
        attempt++;
        this.logger.warn(`${status ?? 'NET'} on ${opts.url} — retry ${attempt}/${RETRY_DELAYS_MS.length} in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractMessage(err: AxiosError<any>): string {
  return err.response?.data?.message || err.response?.data?.error || err.message || 'unknown';
}
