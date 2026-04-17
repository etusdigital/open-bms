import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { SingleSend } from './single-send';
import sendgrid from '@sendgrid/mail';
import { AccountConfigsProvider } from '../../../providers/account-configs.provider';
import {
  SendgridDomainAuthentication,
  SendgridDomainAuthenticationResponse,
  SendgridLinkBranding,
  SendgridLinkBrandingResponse,
  SendgridSettingsApiKey,
  SendgridSettingsApiKeyResponse,
  SendgridSettingsUnsubscribe,
  SendgridSettingsWebhook,
  SendgridSubUser,
  SendgridSubUserResponse,
} from '../../../interfaces/sendgrid.interface';
@Injectable()
export class SendgridHandler {
  private uri: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly accountConfigsProvider: AccountConfigsProvider,
  ) {
    this.uri = `https://api.sendgrid.com/v3`;
  }

  public async createSubuser(subuserPayload: SendgridSubUser): Promise<SendgridSubUserResponse> {
    const result = await this.httpService
      .post(`${this.uri}/subusers`, subuserPayload, {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();
    return result.data;
  }

  public async createApiKey(options: { name?: string; scopes?: string[]; subUserName?: string }): Promise<SendgridSettingsApiKeyResponse> {
    const scopes = [
      'alerts.create',
      'alerts.read',
      'alerts.update',
      'alerts.delete',
      'asm.groups.create',
      'asm.groups.read',
      'asm.groups.update',
      'asm.groups.delete',
      'asm.groups.suppressions.create',
      'asm.groups.suppressions.read',
      'asm.groups.suppressions.update',
      'asm.groups.suppressions.delete',
      'asm.suppressions.global.create',
      'asm.suppressions.global.read',
      'asm.suppressions.global.update',
      'asm.suppressions.global.delete',
      'ui.confirm_email',
      'signup.trigger_confirmation',
      'ui.provision',
      'ips.warmup.create',
      'ips.warmup.read',
      'ips.warmup.update',
      'ips.warmup.delete',
      'ips.pools.create',
      'ips.pools.read',
      'ips.pools.update',
      'ips.pools.delete',
      'ips.pools.ips.create',
      'ips.pools.ips.read',
      'ips.pools.ips.update',
      'ips.pools.ips.delete',
      'ips.read',
      'mail.send',
      'mail_settings.read',
      'mail_settings.bcc.create',
      'mail_settings.bcc.read',
      'mail_settings.bcc.update',
      'mail_settings.bcc.delete',
      'mail_settings.address_whitelist.create',
      'mail_settings.address_whitelist.read',
      'mail_settings.address_whitelist.update',
      'mail_settings.address_whitelist.delete',
      'mail_settings.footer.create',
      'mail_settings.footer.read',
      'mail_settings.footer.update',
      'mail_settings.footer.delete',
      'mail_settings.forward_spam.create',
      'mail_settings.forward_spam.read',
      'mail_settings.forward_spam.update',
      'mail_settings.forward_spam.delete',
      'mail_settings.plain_content.create',
      'mail_settings.plain_content.read',
      'mail_settings.plain_content.update',
      'mail_settings.plain_content.delete',
      'mail_settings.spam_check.create',
      'mail_settings.spam_check.read',
      'mail_settings.spam_check.update',
      'mail_settings.spam_check.delete',
      'mail_settings.bounce_purge.create',
      'mail_settings.bounce_purge.read',
      'mail_settings.bounce_purge.update',
      'mail_settings.bounce_purge.delete',
      'mail_settings.forward_bounce.create',
      'mail_settings.forward_bounce.read',
      'mail_settings.forward_bounce.update',
      'mail_settings.forward_bounce.delete',
      'partner_settings.read',
      'partner_settings.new_relic.create',
      'partner_settings.new_relic.read',
      'partner_settings.new_relic.update',
      'partner_settings.new_relic.delete',
      'partner_settings.sendwithus.create',
      'partner_settings.sendwithus.read',
      'partner_settings.sendwithus.update',
      'partner_settings.sendwithus.delete',
      'tracking_settings.read',
      'tracking_settings.click.create',
      'tracking_settings.click.read',
      'tracking_settings.click.update',
      'tracking_settings.click.delete',
      'tracking_settings.subscription.create',
      'tracking_settings.subscription.read',
      'tracking_settings.subscription.update',
      'tracking_settings.subscription.delete',
      'tracking_settings.open.create',
      'tracking_settings.open.read',
      'tracking_settings.open.update',
      'tracking_settings.open.delete',
      'tracking_settings.google_analytics.create',
      'tracking_settings.google_analytics.read',
      'tracking_settings.google_analytics.update',
      'tracking_settings.google_analytics.delete',
      'user.webhooks.event.settings.create',
      'user.webhooks.event.settings.read',
      'user.webhooks.event.settings.update',
      'user.webhooks.event.settings.delete',
      'user.webhooks.event.test.create',
      'user.webhooks.event.test.read',
      'user.webhooks.event.test.update',
      'user.webhooks.event.test.delete',
      'user.webhooks.parse.settings.create',
      'user.webhooks.parse.settings.read',
      'user.webhooks.parse.settings.update',
      'user.webhooks.parse.settings.delete',
      'stats.read',
      'stats.global.read',
      'categories.stats.read',
      'categories.stats.sums.read',
      'devices.stats.read',
      'clients.stats.read',
      'clients.phone.stats.read',
      'clients.tablet.stats.read',
      'clients.webmail.stats.read',
      'clients.desktop.stats.read',
      'geo.stats.read',
      'mailbox_providers.stats.read',
      'browsers.stats.read',
      'user.webhooks.parse.stats.read',
      'suppression.bounces.create',
      'suppression.bounces.read',
      'suppression.bounces.update',
      'suppression.bounces.delete',
      'suppression.blocks.create',
      'suppression.blocks.read',
      'suppression.blocks.update',
      'suppression.blocks.delete',
      'suppression.invalid_emails.create',
      'suppression.invalid_emails.read',
      'suppression.invalid_emails.update',
      'suppression.invalid_emails.delete',
      'suppression.spam_reports.create',
      'suppression.spam_reports.read',
      'suppression.spam_reports.update',
      'suppression.spam_reports.delete',
      'suppression.unsubscribes.create',
      'suppression.unsubscribes.read',
      'suppression.unsubscribes.update',
      'suppression.unsubscribes.delete',
      'templates.create',
      'templates.read',
      'templates.update',
      'templates.delete',
      'templates.versions.create',
      'templates.versions.read',
      'templates.versions.update',
      'templates.versions.delete',
      'templates.versions.activate.create',
      'templates.versions.activate.read',
      'templates.versions.activate.update',
      'templates.versions.activate.delete',
      'user.account.read',
      'user.credits.read',
      'user.email.create',
      'user.email.read',
      'user.email.update',
      'user.email.delete',
      'user.profile.create',
      'user.profile.read',
      'user.profile.update',
      'user.profile.delete',
      'user.password.create',
      'user.password.read',
      'user.password.update',
      'user.password.delete',
      'user.timezone.create',
      'user.timezone.read',
      'user.timezone.update',
      'user.timezone.delete',
      'user.username.create',
      'user.username.read',
      'user.username.update',
      'user.username.delete',
      'user.settings.enforced_tls.read',
      'user.settings.enforced_tls.update',
      'api_keys.create',
      'api_keys.read',
      'api_keys.update',
      'api_keys.delete',
      'email_activity.read',
      'credentials.create',
      'credentials.read',
      'credentials.update',
      'credentials.delete',
      'categories.create',
      'categories.read',
      'categories.update',
      'categories.delete',
      'mail_settings.template.create',
      'mail_settings.template.read',
      'mail_settings.template.update',
      'mail_settings.template.delete',
      'user.multifactor_authentication.create',
      'user.multifactor_authentication.read',
      'user.multifactor_authentication.update',
      'user.multifactor_authentication.delete',
      'newsletter.create',
      'newsletter.read',
      'newsletter.update',
      'newsletter.delete',
      'ui.signup_complete',
      'mail.batch.create',
      'mail.batch.read',
      'mail.batch.update',
      'mail.batch.delete',
      'user.scheduled_sends.create',
      'user.scheduled_sends.read',
      'user.scheduled_sends.update',
      'user.scheduled_sends.delete',
      'access_settings.whitelist.create',
      'access_settings.whitelist.read',
      'access_settings.whitelist.update',
      'access_settings.whitelist.delete',
      'access_settings.activity.read',
      'whitelabel.create',
      'whitelabel.read',
      'whitelabel.update',
      'whitelabel.delete',
      'suppression.create',
      'suppression.read',
      'suppression.update',
      'suppression.delete',
      'v2',
      'teammates.create',
      'teammates.read',
      'teammates.update',
      'teammates.delete',
      'design_library.read',
      'design_library.create',
      'design_library.update',
      'design_library.delete',
      'sso.teammates.create',
      'sso.teammates.update',
      'di.bounce_block_classification.read',
    ];

    const payload: SendgridSettingsApiKey = {
      name: options.name || 'bms-prod',
      scopes: options.scopes || scopes,
    };

    const result = await this.httpService
      .post(`${this.uri}/api_keys`, payload, {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
          ...(options.subUserName && { 'on-behalf-of': options.subUserName }),
        },
      })
      .toPromise();
    return result.data;
  }

  public async createWebhook(options: { settings?: SendgridSettingsWebhook; subUserName?: string }): Promise<SendgridSettingsWebhook> {
    const payload = {
      enabled: true,
      url: `${process.env.SENDGRID_WEBHOOK_URL}&account=${options.subUserName}`,
      friendly_name: 'bms-prod',
      bounce: true,
      click: true,
      deferred: true,
      delivered: true,
      dropped: true,
      friendlyName: '',
      group_resubscribe: true,
      group_unsubscribe: true,
      oauthClientId: '',
      oauthClientSecret: '',
      oauthTokenUrl: '',
      open: true,
      processed: true,
      spam_report: true,
      unsubscribe: true,
      account_status_change: true,
    };

    try {
      const result = await this.httpService
        .post(`${this.uri}/user/webhooks/event/settings`, payload, {
          headers: {
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
            ...(options.subUserName && { 'on-behalf-of': options.subUserName }),
          },
        })
        .toPromise();
      return result.data;
    } catch (error) {
      console.log('Log - error to create sendgrid webhook', error);
      throw new Error('error to create webhook', { cause: error });
    }
  }

  public async updateTrackingSubscription(options: { settings: SendgridSettingsUnsubscribe; subUserName?: string }): Promise<SendgridSettingsUnsubscribe> {
    const result = await this.httpService
      .patch(`${this.uri}/tracking_settings/subscription`, options.settings, {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
          ...(options.subUserName && { 'on-behalf-of': options.subUserName }),
        },
      })
      .toPromise();
    return result.data;
  }

  public async domainAuthentication(options: { settings: SendgridDomainAuthentication; subUserName?: string }): Promise<SendgridDomainAuthenticationResponse> {
    const result = await this.httpService
      .post(`${this.uri}/whitelabel/domains`, options.settings, {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
          ...(options.subUserName && { 'on-behalf-of': options.subUserName }),
        },
      })
      .toPromise();
    return result.data;
  }

  public async linkBranding(options: { settings: SendgridLinkBranding; subUserName?: string }): Promise<SendgridLinkBrandingResponse> {
    const result = await this.httpService
      .post(`${this.uri}/whitelabel/links`, options.settings, {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
          ...(options.subUserName && { 'on-behalf-of': options.subUserName }),
        },
      })
      .toPromise();
    return result.data;
  }

  public async deleteCampaign(campaignIdExternal: string) {
    try {
      const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
      const response = await this.httpService
        .delete(`${this.uri}/marketing/singlesends/${campaignIdExternal}`, {
          headers: {
            Authorization: `Bearer ${sendgriApiKey}`,
            'Content-Type': 'application/json',
          },
        })
        .toPromise();

      if (response.status !== 204) throw new HttpException(response.data.result_message, HttpStatus.INTERNAL_SERVER_ERROR);
    } catch (e) {
      console.error(e);
      throw new HttpException(`Cannot delete single send of id: ${campaignIdExternal}!`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async getSiloOptions() {
    const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
    const result = await this.httpService
      .get(`${this.uri}/send_ips/pools`, {
        headers: {
          Authorization: `Bearer ${sendgriApiKey}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();
    return result?.data?.result || [];
  }

  public async getIPsByAccount() {
    const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
    const result = await this.httpService
      .get(`${this.uri}/ips`, {
        headers: {
          Authorization: `Bearer ${sendgriApiKey}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();
    return result.data;
  }

  public async getIPs() {
    const result = await this.httpService
      .get(`${this.uri}/ips`, {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();
    return result.data;
  }

  public async getAudienceOptions() {
    const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
    const result = await this.httpService
      .get(`${this.uri}/marketing/lists`, {
        headers: {
          Authorization: `Bearer ${sendgriApiKey}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();

    return result.data.result;
  }

  public async getSegmentOptions(ids: string[]) {
    const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
    const uri = `${this.uri}/marketing/segments?parent_list_ids=${ids.join(',')}`;

    const result = await this.httpService
      .get(uri, {
        headers: {
          Authorization: `Bearer ${sendgriApiKey}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();

    return result.data.results;
  }

  async getStatsByCategories(fromDate: Date, untilDate: Date, categories: Array<string>) {
    try {
      const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
      const startDate = fromDate.toISOString().slice(0, 10);
      const endDate = untilDate.toISOString().slice(0, 10);
      const cats = categories.map((cat) => `categories=${cat}`).join('&');
      const result = await this.httpService
        .get(`https://api.sendgrid.com/v3/categories/stats?start_date=${startDate}&end_date=${endDate}&${cats}`, {
          headers: {
            Authorization: `Bearer ${sendgriApiKey}`,
            'Content-Type': 'application/json',
          },
        })
        .toPromise();

      return await result.data;
    } catch {
      return [];
    }
  }

  /**
   * Creates a single send and retrieves an id.
   * @param {SingleSend} singleSend
   * @returns {Promise<object>}
   */
  async createSingleSend(singleSend: SingleSend) {
    const senderId = await this.getSenderByNameEmail(singleSend.message.fromName, singleSend.message.fromEmail);
    const singlesend = this.singleSendObject(singleSend);
    singlesend.email_config.sender_id = senderId[0];

    try {
      const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
      const response = await this.httpService
        .post(`${this.uri}/marketing/singlesends`, singlesend, {
          headers: {
            Authorization: `Bearer ${sendgriApiKey}`,
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
      const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');

      const result = await this.httpService
        .put(
          `${this.uri}/marketing/singlesends/${id}/schedule`,
          { send_at: scheduleDate },
          {
            headers: {
              Authorization: `Bearer ${sendgriApiKey}`,
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
    const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
    const result = await this.httpService
      .get(`${this.uri}/marketing/singlesends/${id}`, {
        headers: {
          Authorization: `Bearer ${sendgriApiKey}`,
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

  /**
   * Cancel schedule single send. Status becomes draft.
   * @param {if} singleSend
   * @returns {Promise<object>}
   */
  async unscheduleSingleSend(id: string): Promise<AxiosResponse<any>> {
    try {
      const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
      const response = await this.httpService
        .delete(`${this.uri}/marketing/singlesends/${id}/schedule`, {
          headers: {
            Authorization: `Bearer ${sendgriApiKey}`,
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

  /**
   * Updates a send and retrieves an id.
   * @param {SingleSend} singleSend
   * @returns {Promise<object>}
   */
  async updateSingleSend(singleSend: SingleSend) {
    await this.unscheduleSingleSend(singleSend.id);

    const updatedSend = this.singleSendObject(singleSend);
    const senderId = await this.getSenderByNameEmail(singleSend.message.fromName, singleSend.message.fromEmail);

    updatedSend.email_config.sender_id = senderId[0];
    updatedSend['send_at'] = singleSend.scheduledTo;

    try {
      const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
      const response = await this.httpService
        .patch(`${this.uri}/marketing/singlesends/${singleSend.id}`, updatedSend, {
          headers: {
            Authorization: `Bearer ${sendgriApiKey}`,
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

  /**
   * Send a campaign.
   * @param {SendCampaignDto} sendCampaignDto
   * @returns {Promise<object>}
   */
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
              // create new
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
              // update
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
      const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
      const result = await this.httpService
        .get(`${this.uri}/verified_senders`, {
          headers: {
            Authorization: `Bearer ${sendgriApiKey}`,
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

  public async getFieldsDefinitions() {
    const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
    const result = await this.httpService
      .get(`${this.uri}/marketing/field_definitions`, {
        headers: {
          Authorization: `Bearer ${sendgriApiKey}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();

    const response = result.data;

    const fields = Object.values(Object.assign({}, response['reserved_fields'], response['custom_fields']));

    return fields.map((field: any) => {
      return {
        id: field.id,
        field: `{{${field.name}}}`,
        name: field.name,
        type: field.field_type,
      };
    });
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
      const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
      sendgrid.setApiKey(sendgriApiKey);

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

  async getSubUsers(_params: any) {
    const result = await this.httpService
      .get(`${this.uri}/subusers`, {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })
      .toPromise();
    return result.data;
  }
}
