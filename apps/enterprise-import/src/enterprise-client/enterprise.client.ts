import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { EnterpriseApi4xxError, EnterpriseApi404Error, EnterpriseApi5xxError, EnterpriseApiTimeoutError } from './errors';

// Resposta paginada normalizada. Diferentes endpoints do Enterprise expõem
// shapes ligeiramente diferentes — adapte aqui se necessário.
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

  // Por job: cria axios instance com baseURL + auth por API KEY. Não
  // compartilhamos entre jobs porque baseURL e apiKey mudam.
  //
  // IMPORTANTE: o BMS autentica API key gerenciada pelo header `x-api-key`
  // (authz.service.getHeaderApiKey). `Authorization: Bearer` cai no caminho de
  // JWT de usuário → a API key seria validada como JWT → 401 "Invalid token".
  // Mandamos `x-api-key`; não é preciso usuário logado.
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

  // ---- Account-scope endpoints ----
  getAccountSettings(accountId: number, provider: string): Promise<Record<string, any> | null> {
    return this.requestWithRetry({
      method: 'GET',
      url: `/accounts/${accountId}/settings/${provider}`,
      tolerate404: true,
    });
  }

  listTags(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/tags', params);
  }

  listCustomFields(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/custom-fields', params);
  }

  listLabels(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/labels', params);
  }

  // `/users` é key-scoped (retorna os usuários da conta dona da API key) —
  // confirmado contra o Enterprise real. O antigo `/accounts/{id}/users`
  // exigia o id da conta no Enterprise (que o worker não tem em account-scope)
  // → 404/403.
  listUsers(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/users', params);
  }

  // Algumas versões do Enterprise não expõem `/emails-templates` (404).
  // Toleramos: retorna página vazia → importer pula sem falhar o job.
  listEmailTemplates(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/emails-templates', params, true);
  }

  listContacts(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/contacts', params);
  }

  listCustomEvents(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/custom-events', params);
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

  // Task 10: endpoint adicionado em statistics.controller.
  // Se Enterprise estiver em versão antiga sem essa rota, statistics importer
  // trata 404 como skip (vide riscos no spec).
  exportStatistics(params: { accountId: number; from: string; to: string; page: number; itemsPerPage: number }): Promise<{
    results: any[];
    page: number;
    totalItems: number;
    itemsPerPage: number;
  }> {
    return this.requestWithRetry({
      method: 'GET',
      url: '/statistics/admin/export',
      params,
    });
  }

  // ---- Instance-scope endpoints ----
  listAllAccounts(params: PageParams): Promise<PagedResponse<any>> {
    return this.paged('/accounts/all', params);
  }

  getInstanceConfig(): Promise<Record<string, any>> {
    return this.requestWithRetry({ method: 'GET', url: '/admin/system-config' });
  }

  // -------------------------------------------------------------------------

  private async paged(url: string, params: PageParams & Record<string, any>, tolerate404 = false): Promise<PagedResponse<any>> {
    const data = await this.requestWithRetry({ method: 'GET', url, params, tolerate404 });
    // tolerate404 → requestWithRetry devolve null no 404: trata como vazio
    // (importer encerra o loop sem erro).
    if (data == null) return { results: [], page: params.page ?? 1, totalItems: 0, itemsPerPage: 0 };
    // Normalização defensiva: aceita {results,page,totalItems} ou só array.
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
    // Loop com short-circuit em 4xx; 5xx/timeout/network: até 5 tentativas com backoff exp.
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

        // 5xx, timeout, ou erro de rede: retry com backoff
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
