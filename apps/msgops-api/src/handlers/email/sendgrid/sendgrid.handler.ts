import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ClsService } from 'nestjs-cls';
import { AxiosResponse } from 'axios';
import { SingleSend } from './single-send';
import sendgrid from '@sendgrid/mail';
import { AccountConfigsProvider } from '../../../providers/account-configs.provider';
import { SendgridSettingsWebhook } from '../../../interfaces/sendgrid.interface';

const API_KEY_CACHE_TTL_MS = 60_000;

@Injectable()
export class SendgridHandler {
  private uri: string;
  private apiKeyCache = new Map<number, { value: string; loadedAt: number }>();

  constructor(
    private readonly httpService: HttpService,
    private readonly accountConfigsProvider: AccountConfigsProvider,
    private readonly cls: ClsService,
  ) {
    this.uri = `https://api.sendgrid.com/v3`;
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

  // Drops a single account's cached key (call after AccountSettingsService
  // saves/deletes a per-account key). Pass nothing to clear everything.
  public invalidateApiKeyCache(accountId?: number): void {
    if (accountId === undefined) {
      this.apiKeyCache.clear();
      return;
    }
    this.apiKeyCache.delete(accountId);
  }

  // Builds the webhook URL the SendGrid event hook will POST to. Uses
  // SENDGRID_WEBHOOK_URL_BASE (preferred); falls back to SENDGRID_WEBHOOK_URL
  // (legacy name) for one release. Appends `&account=<id>` so the
  // event-process gateway can route the callback to the right BMS account
  // (the field reaches `events.account` in the SendgridEvent payload).
  private buildWebhookUrl(accountId: number): string {
    const base = process.env.SENDGRID_WEBHOOK_URL_BASE ?? process.env.SENDGRID_WEBHOOK_URL;
    if (!base) {
      throw new HttpException('SENDGRID_WEBHOOK_URL_BASE env var is required to register the SendGrid event webhook', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}account=${accountId}`;
  }

  // Registers the SendGrid event webhook against the supplied API key. The
  // URL is built from SENDGRID_WEBHOOK_URL_BASE plus `&account=<accountId>`
  // so each tenant's webhook lands distinguishable on the gateway side.
  // Caller passes the freshly-saved apiKey explicitly so we don't depend on
  // cache state mid-save. Returns the webhook URL that was registered so the
  // caller can persist it for display in the UI.
  public async createWebhook(options: { apiKey: string; accountId: number }): Promise<{ url: string }> {
    const url = this.buildWebhookUrl(options.accountId);
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

    try {
      await this.httpService
        .post(`${this.uri}/user/webhooks/event/settings`, payload, {
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
        })
        .toPromise();
      return { url };
    } catch (error) {
      console.log('Log - error to create sendgrid webhook', error);
      throw new HttpException('error to create webhook', HttpStatus.INTERNAL_SERVER_ERROR, { cause: error });
    }
  }

  public async getSiloOptions() {
    const apiKey = await this.loadApiKey();
    if (!apiKey) return [];
    const result = await this.httpService
      .get(`${this.uri}/send_ips/pools`, {
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
      .get(`${this.uri}/ips`, {
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
      .get(`${this.uri}/ips`, {
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
        .get(`https://api.sendgrid.com/v3/categories/stats?start_date=${startDate}&end_date=${endDate}&${cats}`, {
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
        .post(`${this.uri}/marketing/singlesends`, singlesend, {
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
          `${this.uri}/marketing/singlesends/${id}/schedule`,
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
      .get(`${this.uri}/marketing/singlesends/${id}`, {
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
        .delete(`${this.uri}/marketing/singlesends/${id}/schedule`, {
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
        .patch(`${this.uri}/marketing/singlesends/${singleSend.id}`, updatedSend, {
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
        .get(`${this.uri}/verified_senders`, {
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
      ipPoolName: ippool || process.env.SENDGRID_IP_POOL,
    };
  }

  async sendSingleCustomEmail(seedList: Array<string>, fromName: string, fromMail: string, messageSubject: string, messageHtmlContent: string, ippool: string): Promise<any> {
    try {
      const apiKey = await this.loadApiKey();
      sendgrid.setApiKey(apiKey);

      const mail = this.createSingleCustomEmail(seedList, fromName, fromMail, messageSubject, messageHtmlContent, ippool);
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
      sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

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
