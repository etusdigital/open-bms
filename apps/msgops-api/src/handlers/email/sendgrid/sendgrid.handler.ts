import { HttpException, HttpStatus, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ClsService } from 'nestjs-cls';
import { AxiosResponse } from 'axios';
import { SingleSend } from './single-send';
import sendgrid from '@sendgrid/mail';
import { AccountConfigsProvider } from '../../../providers/account-configs.provider';
import { SendgridSettingsWebhook } from '../../../interfaces/sendgrid.interface';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import type { SendgridSystemSettings } from '../../../lib/integrations-config-file';
import { SENDGRID_KEY } from '../../../modules/admin-integrations/sendgrid/admin-sendgrid.service';

const API_KEY_CACHE_TTL_MS = 60_000;
const DEFAULT_BASE = 'https://api.sendgrid.com';

@Injectable()
export class SendgridHandler {
  private apiKeyCache = new Map<number, { value: string; loadedAt: number }>();

  constructor(
    private readonly httpService: HttpService,
    private readonly accountConfigsProvider: AccountConfigsProvider,
    private readonly cls: ClsService,
    private readonly systemConfigCache: SystemConfigCacheProvider,
  ) {}

  private async getSystemConfig(): Promise<SendgridSystemSettings | null> {
    return (await this.systemConfigCache.get<SendgridSystemSettings>(SENDGRID_KEY)) ?? null;
  }

  private async getApiBaseUrl(): Promise<string> {
    const cfg = await this.getSystemConfig();
    return (cfg?.apiBaseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
  }

  private async getUri(): Promise<string> {
    return `${await this.getApiBaseUrl()}/v3`;
  }

  // Resolves the SendGrid API key to use for an outbound call: strictly
  // per-account `accounts_configs.sendgrid_key`. There is no platform-wide
  // fallback — multi-tenant deploys must have each tenant paste their own
  // key in /settings (per-account tab). If the account has no key set,
  // outbound SendGrid calls return undefined and the caller surfaces a
  // clear error rather than silently using a shared key.
  //
  // accountId resolves from the explicit argument first, then ClsService
  // (request-scoped accountId).
  private async loadApiKey(accountId?: number): Promise<string | undefined> {
    const resolvedAccountId = accountId ?? (this.cls.get('accountId') as number | undefined);
    if (!resolvedAccountId) return undefined;

    const cached = this.readCache(resolvedAccountId);
    if (cached) return cached;
    const row = await this.accountConfigsProvider.getByAccountId(resolvedAccountId, 'sendgrid_key');
    if (row?.value) {
      this.writeCache(resolvedAccountId, row.value);
      return row.value;
    }
    return undefined;
  }

  private readCache(key: number): string | undefined {
    const entry = this.apiKeyCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.loadedAt > API_KEY_CACHE_TTL_MS) {
      this.apiKeyCache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private writeCache(key: number, value: string): void {
    this.apiKeyCache.set(key, { value, loadedAt: Date.now() });
  }

  // The @sendgrid/mail library hits api.sendgrid.com directly; this redirects
  // it to the same base URL the rest of the handler uses (mock or real).
  // The base must point at the host without /v3 — the library appends
  // /v3/mail/send itself.
  private async applySendgridLibBaseUrl(): Promise<void> {
    const cfg = await this.getSystemConfig();
    const base = cfg?.apiBaseUrl;
    if (!base) return;
    const client = (sendgrid as unknown as { client?: { setDefaultRequest?: (k: string, v: string) => void } }).client;
    client?.setDefaultRequest?.('baseUrl', base.replace(/\/+$/, ''));
  }

  // Drops a single account's cached key (call after AccountSettingsService
  // saves/deletes a per-account key). Pass nothing to clear everything.
  public invalidateApiKeyCache(accountId?: number): void {
    if (accountId === undefined) {
      this.apiKeyCache.clear();
      return;
    }
    this.apiKeyCache.delete(accountId);
  }

  // Builds the webhook URL the SendGrid event hook will POST to. Reads
  // webhookUrlBase from system_config (managed via /super-admin/integrations/sendgrid).
  // The field is labeled "Base URL" in the UI, so accept just the public host
  // (e.g. `https://my-tunnel.ngrok-free.app`) and append the event-receiver's
  // canonical path + the platform/account query that the gateway needs to
  // route the callback. If the user pasted a fuller URL we tolerate it: an
  // existing path is preserved, an existing `platform=` query is preserved,
  // we always append `account=<id>` last.
  private async buildWebhookUrl(accountId: number): Promise<string> {
    const cfg = await this.getSystemConfig();
    const base = cfg?.webhookUrlBase;
    if (!base) {
      throw new UnprocessableEntityException('SendGrid webhookUrlBase não configurado em /super-admin/integrations/sendgrid.');
    }
    const trimmed = base.replace(/\/+$/, '');
    const url = new URL(/^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/bms/events';
    }
    if (!url.searchParams.has('platform')) {
      url.searchParams.set('platform', 'sendgrid');
    }
    url.searchParams.set('account', String(accountId));
    return url.toString();
  }

  // Registers (or updates) the SendGrid event webhook against the supplied
  // API key. The URL is built from SENDGRID_WEBHOOK_URL_BASE plus
  // `&account=<accountId>` so each tenant's webhook lands distinguishable on
  // the gateway side. SendGrid's multi-webhook API enforces URL uniqueness,
  // so this method lists existing webhooks and PATCHes the matching one
  // instead of POSTing a duplicate. Caller passes the freshly-saved apiKey
  // explicitly so we don't depend on cache state mid-save. Returns the
  // webhook URL that was registered so the caller can persist it for display
  // in the UI.
  public async createWebhook(options: { apiKey: string; accountId: number }): Promise<{ url: string }> {
    const url = await this.buildWebhookUrl(options.accountId);
    const payload: SendgridSettingsWebhook = {
      enabled: true,
      url,
      friendly_name: 'bms-prod',
      bounce: true,
      click: true,
      deferred: true,
      delivered: true,
      dropped: true,
      group_resubscribe: true,
      group_unsubscribe: true,
      open: true,
      processed: true,
      spam_report: true,
      unsubscribe: true,
    };
    const headers = {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const base = await this.getUri();
      const existing = await this.httpService
        .get<{ webhooks?: Array<{ id: string; url: string; friendly_name?: string }> }>(`${base}/user/webhooks/event/settings/all`, { headers })
        .toPromise();
      const webhooks = existing?.data?.webhooks ?? [];
      const match = webhooks.find((w) => w.url === url);

      if (match) {
        await this.httpService.patch(`${base}/user/webhooks/event/settings/${match.id}`, payload, { headers }).toPromise();
      } else if (webhooks.length > 0) {
        // Free/limited plans cap webhook count — overwrite an existing one.
        // Prefer the slot we previously registered (by friendly_name) before falling back to the first entry.
        const target = webhooks.find((w) => w.friendly_name === 'bms-prod') ?? webhooks[0];
        console.warn('SendGrid free-plan: overwriting existing webhook', { targetId: target.id, targetUrl: target.url, newUrl: url });
        await this.httpService.patch(`${base}/user/webhooks/event/settings/${target.id}`, payload, { headers }).toPromise();
      } else {
        await this.httpService.post(`${base}/user/webhooks/event/settings`, payload, { headers }).toPromise();
      }
      return { url };
    } catch (error) {
      const axiosError = error as { response?: { data?: { errors?: Array<{ message: string }> }; status?: number } };
      const sgMessage = axiosError?.response?.data?.errors?.[0]?.message;
      const sgStatus = axiosError?.response?.status;
      console.error('SendGrid webhook registration failed', { sgStatus, sgMessage });
      let httpStatus: HttpStatus;
      if (!sgStatus) {
        httpStatus = HttpStatus.BAD_GATEWAY;
      } else if (sgStatus === 401) {
        httpStatus = HttpStatus.UNAUTHORIZED;
      } else if (sgStatus === 403) {
        httpStatus = HttpStatus.FORBIDDEN;
      } else if (sgStatus === 429) {
        httpStatus = HttpStatus.TOO_MANY_REQUESTS;
      } else if (sgStatus >= 400 && sgStatus < 500) {
        httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;
      } else {
        httpStatus = HttpStatus.BAD_GATEWAY;
      }
      throw new HttpException(sgMessage ?? 'Erro ao registrar webhook na SendGrid', httpStatus, { cause: error });
    }
  }

  public async getSiloOptions() {
    const apiKey = await this.loadApiKey();
    if (!apiKey) return [];
    const result = await this.httpService
      .get(`${await this.getUri()}/send_ips/pools`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();
    return result?.data?.result || [];
  }

  public async getIPsByAccount() {
    const apiKey = await this.loadApiKey();
    const result = await this.httpService
      .get(`${await this.getUri()}/ips`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();
    return result.data;
  }

  public async getIPs() {
    const apiKey = await this.loadApiKey();
    const result = await this.httpService
      .get(`${await this.getUri()}/ips`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();
    return result.data;
  }

  async getStatsByCategories(fromDate: Date, untilDate: Date, categories: Array<string>) {
    try {
      const apiKey = await this.loadApiKey();
      const startDate = fromDate.toISOString().slice(0, 10);
      const endDate = untilDate.toISOString().slice(0, 10);
      const cats = categories.map((cat) => `categories=${cat}`).join('&');
      const result = await this.httpService
        .get(`${await this.getUri()}/categories/stats?start_date=${startDate}&end_date=${endDate}&${cats}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        })
        .toPromise();

      return await result.data;
    } catch {
      return [];
    }
  }

  async createSingleSend(singleSend: SingleSend) {
    const senderId = await this.getSenderByNameEmail(singleSend.message.fromName, singleSend.message.fromEmail);
    const singlesend = this.singleSendObject(singleSend);
    singlesend.email_config.sender_id = senderId[0];

    try {
      const apiKey = await this.loadApiKey();
      const response = await this.httpService
        .post(`${await this.getUri()}/marketing/singlesends`, singlesend, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        })
        .toPromise();
      singleSend.id = response.data.id;
      if (!singleSend.id) throw new HttpException(response.data.result_message, HttpStatus.INTERNAL_SERVER_ERROR);

      return singleSend;
    } catch (e) {
      console.error(e);
      throw new HttpException('Cannot create single send for specified parameters!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async sendSingle(id: string, sendAt: Date) {
    try {
      const scheduleDate = !sendAt || sendAt < new Date() ? 'now' : sendAt;
      const apiKey = await this.loadApiKey();

      const result = await this.httpService
        .put(
          `${await this.getUri()}/marketing/singlesends/${id}/schedule`,
          { send_at: scheduleDate },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        )
        .toPromise();

      const singleSend = result.data;

      return {
        id,
        schedule_date: singleSend.send_at,
        status: singleSend.status,
      };
    } catch (e) {
      console.error(e);

      throw new HttpException('Cannot get campaign for specified id!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getCampaignById(id: any) {
    const apiKey = await this.loadApiKey();
    const result = await this.httpService
      .get(`${await this.getUri()}/marketing/singlesends/${id}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();

    const campaign = result.data;

    return {
      id: campaign.id,
      schedule_date: campaign.send_at,
      name: campaign.name,
      status: campaign.status,
    };
  }

  async unscheduleSingleSend(id: string): Promise<AxiosResponse<any>> {
    try {
      const apiKey = await this.loadApiKey();
      const response = await this.httpService
        .delete(`${await this.getUri()}/marketing/singlesends/${id}/schedule`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        })
        .toPromise();
      return response;
    } catch (e) {
      console.error(e);
      throw new HttpException('Cannot update single send for specified parameters!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateSingleSend(singleSend: SingleSend) {
    await this.unscheduleSingleSend(singleSend.id);

    const updatedSend = this.singleSendObject(singleSend);
    const senderId = await this.getSenderByNameEmail(singleSend.message.fromName, singleSend.message.fromEmail);

    updatedSend.email_config.sender_id = senderId[0];
    updatedSend['send_at'] = singleSend.scheduledTo;

    try {
      const apiKey = await this.loadApiKey();
      const response = await this.httpService
        .patch(`${await this.getUri()}/marketing/singlesends/${singleSend.id}`, updatedSend, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        })
        .toPromise();

      singleSend.id = response.data.id;
      if (!singleSend.id) throw new HttpException(response.data.result_message, HttpStatus.INTERNAL_SERVER_ERROR);

      return singleSend;
    } catch (e) {
      console.error(e);
      throw new HttpException('Cannot update single send for specified parameters!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async sendCampaign(sendCampaignDto: any): Promise<Array<any>> {
    const sentCampaigns: Array<any> = [];

    sendCampaignDto.messages.forEach(async (message) => {
      const lists = message.audiences.map((audience) => audience.id);
      const listsIds = lists.flat();

      if (listsIds && listsIds.length) {
        message.silos.forEach(async (silo) => {
          const segments = silo.segments.map((segment) => segment.segmentIdExternal);
          const segmentsIds = segments.flat();

          if (segmentsIds && segmentsIds.length) {
            if (!silo.campaignIdExternal) {
              let content = message.content;
              if (silo.append) {
                content += ` ${silo.append}`;
              }

              const createdSingleSend = await this.createSingleSend({
                title: sendCampaignDto.title,
                segmentsIds,
                scheduledTo: sendCampaignDto.scheduleTo,
                message: {
                  name: message.subject,
                  content,
                  subject: message.subject,
                  fromEmail: silo.fromMail,
                  fromName: silo.fromName,
                  ipPool: silo.siloIdExternal,
                },
              });

              if (createdSingleSend) {
                await this.sendSingle(createdSingleSend.id, createdSingleSend.scheduledTo);

                const updatedSentCampaign = {
                  activeCampaignAccountId: null,
                  campaignId: createdSingleSend.id,
                  error: false,
                  version: message.version,
                  apiKey: null,
                };

                sentCampaigns.push(updatedSentCampaign);
              }
            } else {
              const updatedCampaign = await this.updateSingleSend({
                id: silo.campaignIdExternal,
                listsIds,
                segmentsIds,
                title: sendCampaignDto.title,
                scheduledTo: sendCampaignDto.scheduleTo,
                message: {
                  name: message.subject,
                  content: message.content,
                  subject: message.subject,
                  fromEmail: silo.fromMail,
                  fromName: silo.fromName,
                  ipPool: silo.siloIdExternal,
                },
              });

              if (updatedCampaign) {
                await this.sendSingle(updatedCampaign.id, sendCampaignDto.scheduleTo);
              }

              const updatedSentCampaign = {
                campaignId: updatedCampaign.id,
                version: message.version,
                activeCampaignAccountId: null,
                apiKey: null,
                error: false,
              };

              sentCampaigns.push(updatedSentCampaign);
            }
          }
        });
      } else {
        return {
          activeCampaignAccountId: null,
          version: message.version,
          error: true,
          apiKey: null,
        };
      }
    });

    return sentCampaigns;
  }

  async getVerifiedSenders() {
    try {
      const apiKey = await this.loadApiKey();
      const result = await this.httpService
        .get(`${await this.getUri()}/verified_senders`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        })
        .toPromise();
      return result.data.results;
    } catch (e) {
      console.error(e);
      throw new HttpException('Cannot get senders', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getSenderByNameEmail(name: string, email: string) {
    const senders: any[] = await this.getVerifiedSenders();
    return senders.filter((sender) => sender.from_email == email && sender.from_name === name).map((filtered) => filtered.id);
  }

  singleSendObject(singleSend: SingleSend) {
    return {
      name: singleSend.title,
      send_to: {
        list_ids: singleSend.listsIds || [],
        segment_ids: singleSend.segmentsIds || [],
        all: false,
      },
      email_config: {
        subject: singleSend.message.subject,
        html_content: singleSend.message.content,
        suppression_group_id: 16157,
        sender_id: singleSend.message.senderId,
        ip_pool: singleSend.message.ipPool,
      },
    };
  }

  createSingleCustomEmail(
    seedList: Array<string>,
    fromName: string,
    fromMail: string,
    messageSubject: string,
    messageHtmlContent: string,
    ippool: string,
  ): sendgrid.MailDataRequired {
    return {
      to: seedList,
      from: {
        name: fromName,
        email: fromMail,
      },
      subject: messageSubject,
      content: [
        {
          type: 'text/html',
          value: messageHtmlContent,
        },
      ],
      categories: ['msgops', 'test_glockapps'],
      ipPoolName: ippool,
    };
  }

  async sendSingleCustomEmail(seedList: Array<string>, fromName: string, fromMail: string, messageSubject: string, messageHtmlContent: string, ippool: string): Promise<any> {
    try {
      const apiKey = await this.loadApiKey();
      const cfg = await this.getSystemConfig();
      // Order matters: setApiKey() resets defaultRequest.baseUrl to the
      // global region host as a side effect (@sendgrid/client client.js:46),
      // so the override has to land AFTER. Same fix as mail.service.ts (EVO-1052).
      sendgrid.setApiKey(apiKey);
      await this.applySendgridLibBaseUrl();

      const resolvedIpPool = ippool || cfg?.ipPool || '';
      const mail = this.createSingleCustomEmail(seedList, fromName, fromMail, messageSubject, messageHtmlContent, resolvedIpPool);
      const response = await sendgrid.sendMultiple(mail);

      console.log(`Email sent response: ${JSON.stringify(response)}`);
      return response;
    } catch (e) {
      console.log(`Email not sent error: ${e}`);
      throw new HttpException('Cannot send this email!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async sendInternalEmail(to: Array<string>, fromName: string, fromMail: string, subject: string, htmlContent: string): Promise<any> {
    try {
      const cfg = await this.getSystemConfig();
      if (!cfg?.apiKey) {
        throw new UnprocessableEntityException('SendGrid system-level API key não configurado em /super-admin/integrations/sendgrid.');
      }
      // Same EVO-1052 ordering: setApiKey first, override after.
      sendgrid.setApiKey(cfg.apiKey);
      await this.applySendgridLibBaseUrl();

      const mail = this.createSingleCustomEmail(to, fromName, fromMail, subject, htmlContent, '');
      const response = await sendgrid.sendMultiple(mail);

      console.log(`Internal email sent response: ${JSON.stringify(response)}`);
      return response;
    } catch (e) {
      console.log(`Internal email not sent error: ${e}`);
      throw new HttpException('Cannot send internal email!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
