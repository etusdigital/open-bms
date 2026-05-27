import * as sendgrid from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/mail';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Account, AutomationContactsBatch, SendEmailMessage } from '../../interfaces';
import { Batch } from '../../mail/mail.interface';
import { FormatterUtils } from '../../utils/formatter.utils';
import { HtmlToTextService } from '../../html-to-text/html-to-text.service';
import { MailUtils } from '../../mail/mail.utils';
import { EmailProviderMetadata, IEmailProvider } from '../email-provider.interface';
import { getSendGridClient } from './sendgrid-client.helper';

@Injectable()
export class SendGridHandler implements IEmailProvider {
  constructor(
    private readonly formatterUtils: FormatterUtils,
    private readonly htmlToTextService: HtmlToTextService,
    private readonly mailUtils: MailUtils,
  ) {}

  getMetadata(): EmailProviderMetadata {
    return {
      name: 'sendgrid',
      hasFreeTier: true,
      hasWebhook: true,
      notes: '100 emails/dia perpétuo (verificado 2026-05)',
    };
  }

  // Public so callers (MailService delegation, future router) can build the SendGrid payload.
  createMail(sendEmailMessage: SendEmailMessage, html: string): MailDataRequired {
    const categories = this.mailUtils.getCategories(sendEmailMessage);
    const condition = sendEmailMessage.message && sendEmailMessage.message.replyTo;
    const accountName = this.formatterUtils.normalizeString(sendEmailMessage?.account?.name.toLowerCase().slice(0, 15));
    const automationType = sendEmailMessage.automationType === 'email' ? 'automation' : sendEmailMessage.automationType;

    const textContent = this.htmlToTextService.convert(html);

    const disabledClickTrackingVQ = categories.includes('message_555704') && sendEmailMessage.ramdonNumber > 0.33 ? true : false;

    // message 568747: disable open tracking pixel
    if (sendEmailMessage.message.id === 568747) {
      html = html.replace(/<div>sendgrid_open_tracking<\/div>/gi, '');
    }

    const emailFormat: MailDataRequired = {
      from: {
        name: sendEmailMessage.message.from.firstName,
        email: sendEmailMessage.message.from.email,
      },
      subject: sendEmailMessage.message.subject,
      replyTo: condition
        ? {
            email: sendEmailMessage.message.replyTo,
            name: sendEmailMessage.message.from.firstName,
          }
        : undefined,
      content: [
        { type: 'text/plain', value: textContent },
        { type: 'text/html', value: html },
      ],
      categories,
      // SendGrid rejects ip_pool_name="" with 400. Free/Essentials plans have
      // no dedicated pools, so the BMS pool is saved with an empty pool_name
      // and we must omit the field entirely (sends fall back to SendGrid
      // shared IPs). Same rationale at the two batch builders below.
      ...(() => {
        const pool = this.mailUtils.getIppol(sendEmailMessage.message);
        return pool ? { ipPoolName: pool } : {};
      })(),
      trackingSettings: {
        openTracking: {
          enable: sendEmailMessage.message.id !== 568747,
          ...(sendEmailMessage.message.id !== 568747 ? { substitutionTag: 'sendgrid_open_tracking' } : {}),
        },
        ...(disabledClickTrackingVQ ? { clickTracking: { enable: false } } : {}),
      },
      mailSettings: {
        sandboxMode: {
          enable: process.env.SANDBOX_MODE === 'true',
        },
        bypassUnsubscribeManagement: {
          enable: true,
        },
      },
      customArgs: {
        ...(sendEmailMessage.contact ? { contactId: `${sendEmailMessage.contact.id}`, uuid: sendEmailMessage.contact.uuid } : {}),
        ...(sendEmailMessage.account ? { accountId: `${sendEmailMessage.account.id}` } : {}),
        ...this.akrossArgs(sendEmailMessage),
        sent_at: Date.now().toString(),
      },
      ...(sendEmailMessage.sendAt ? { sendAt: sendEmailMessage.sendAt } : {}),
    };

    if (sendEmailMessage.account.id === 6) {
      const personalizations = [
        {
          to: [
            {
              email: sendEmailMessage.contact.email,
              name: sendEmailMessage.contact.firstName || '',
            },
          ],
          substitutions: this.mailUtils.mapVariables(sendEmailMessage.contact, sendEmailMessage.account, sendEmailMessage.message, {}, true),
          customArgs: {
            ...(sendEmailMessage.contact ? { contactId: `${sendEmailMessage.contact.id}`, uuid: sendEmailMessage.contact.uuid } : {}),
            sent_at: Date.now().toString(),
          },
        },
      ];
      emailFormat.personalizations = personalizations;
    } else {
      emailFormat.to = {
        name: sendEmailMessage.contact.firstName || '',
        email: sendEmailMessage.contact.email,
      };
      emailFormat.headers = {
        'Feedback-ID': `id${sendEmailMessage.message.id}:${accountName}:${automationType}:etusbms`,
        'X-Feedback-ID': `id${sendEmailMessage.message.id}:${accountName}:${automationType}:etusbms`,
      };
    }

    return emailFormat;
  }

  createCampaignBatchMail(batch: Batch, htmlContent: string): MailDataRequired {
    const { account, message, contacts, campaign_id, campaign_test_ab_mode, is_campaign_warmup_mode } = batch;

    const ipPoolName = this.mailUtils.getIppol(message);
    const utmCampaign = `${batch.campaign_name}_e1_${batch.message.id}`;

    const categories = this.mailUtils.getCategoriesCampaign(message, campaign_id, campaign_test_ab_mode || false, account, utmCampaign);

    let html = htmlContent;
    if (batch.message && batch.message.previewText) {
      html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    }

    html = this.mailUtils.parseHandlebarsVariables(html, account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'sendgrid',
      utmCampaign: utmCampaign,
      messageId: batch.message.id,
      account: account,
      campaign: batch.campaign,
      isSendgridVariables: true,
    });

    const personalizations = contacts.map((contact) => ({
      to: [
        {
          email: contact.email,
          name: contact.firstName || '',
        },
      ],
      substitutions: this.mailUtils.mapVariables(contact, batch.account, message, formatedEmailContent.replaceLinks, true),
      customArgs: {
        ...(contact ? { contactId: `${contact.id}`, uuid: contact.uuid } : {}),
        ...(batch.account ? { accountId: `${batch.account.id}` } : {}),
        ...(is_campaign_warmup_mode ? { isWarmupCampaign: 'true' } : {}),
        sent_at: Date.now().toString(),
        batch_page: batch.page.toString(),
        batch_schedule_to: `${batch.campaign.scheduleTo}`,
        batch_spread: batch.campaign.spreadSending.toString(),
      },
    }));

    const accountName = this.formatterUtils.normalizeString(account?.name.toLowerCase().slice(0, 15));

    const textContent = this.htmlToTextService.convert(formatedEmailContent.template);

    const mails: MailDataRequired = {
      personalizations,
      from: {
        name: message.fromName,
        email: message.fromMail,
      },
      replyTo: message.replyTo
        ? {
            email: message.replyTo,
            name: message.fromName,
          }
        : undefined,
      subject: this.mailUtils.parseHandlebarsVariables(message.subject, account),
      content: [
        { type: 'text/plain', value: textContent },
        { type: 'text/html', value: formatedEmailContent.template },
      ],
      ...(ipPoolName ? { ipPoolName } : {}),
      categories,
      trackingSettings: {
        openTracking: {
          enable: true,
          substitutionTag: 'sendgrid_open_tracking',
        },
      },
      mailSettings: {
        sandboxMode: {
          enable: process.env.SANDBOX_MODE === 'true',
        },
        bypassUnsubscribeManagement: {
          enable: true,
        },
      },
      headers: {
        'Feedback-ID': `id${batch.message.id}:${accountName}:campaign:etusbms`,
        'X-Feedback-ID': `id${batch.message.id}:${accountName}:campaign:etusbms`,
      },
    };

    return mails;
  }

  createAutomationBatchMail(batch: AutomationContactsBatch, htmlContent: string): MailDataRequired {
    const { message, contacts } = batch;

    const accountName = this.formatterUtils.normalizeString(batch.account?.name.toLowerCase().slice(0, 15));
    const automationType = batch.automationType === 'email' ? 'automation' : batch.automationType;

    const ipPoolName = this.mailUtils.getIppol(message);
    const categories = this.mailUtils.getCategories(batch);

    let html = htmlContent;
    if (batch.message && batch.message.previewText) {
      html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    }

    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'sendgrid',
      utmCampaign: batch.utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      dynamicLink: batch.link,
      isSendgridVariables: true,
    });

    const personalizations = contacts.map((contact) => ({
      to: [
        {
          email: contact.email,
          name: contact.firstName || '',
        },
      ],
      substitutions: this.mailUtils.mapVariables(contact, batch.account, message, formatedEmailContent.replaceLinks, true),
      customArgs: {
        ...(contact ? { contactId: `${contact.id}`, uuid: contact.uuid } : {}),
        sent_at: Date.now().toString(),
      },
    }));

    const textContent = this.htmlToTextService.convert(formatedEmailContent.template);

    const mails: MailDataRequired = {
      personalizations,
      from: {
        name: message.from.firstName,
        email: message.from.email,
      },
      replyTo: message.replyTo
        ? {
            email: message.replyTo,
            name: message.from.firstName,
          }
        : undefined,
      subject: this.mailUtils.parseHandlebarsVariables(message.subject, batch.account),
      content: [
        { type: 'text/plain', value: textContent },
        { type: 'text/html', value: formatedEmailContent.template },
      ],
      ...(ipPoolName ? { ipPoolName } : {}),
      categories,
      trackingSettings: {
        openTracking: {
          enable: true,
          substitutionTag: 'sendgrid_open_tracking',
        },
      },
      mailSettings: {
        sandboxMode: {
          enable: process.env.SANDBOX_MODE === 'true',
        },
        bypassUnsubscribeManagement: {
          enable: true,
        },
      },
      headers: {
        'Feedback-ID': `id${batch.message.id}:${accountName}:${automationType}:etusbms`,
        'X-Feedback-ID': `id${batch.message.id}:${accountName}:${automationType}:etusbms`,
      },
    };

    return mails;
  }

  // sendEmail signature widens IEmailProvider's contract with two SendGrid-specific
  // optional flags (isWarmup, debug). Callers passing only (mail, account) remain valid.
  // The 30+ account-specific key-routing branches are preserved verbatim from
  // legacy MailService.sendMail to avoid regressing tenant traffic (see TD-10).
  async sendEmail(mail: unknown, account: Account, isWarmup = false, debug?: string): Promise<unknown> {
    const sgMail = mail as MailDataRequired;
    if (debug) {
      return sgMail;
    }

    try {
      // Resolution: per-account `sendgrid_key` first (set by tenant admin
      // in /account-settings/sendgrid), falling back to SENDGRID_API_KEY env
      // var which mirrors the global super-admin fallback in system_config.
      // Warmup campaigns always go through the env-var path so warmup IPs
      // never piggyback on a tenant key.
      const accountKey = !isWarmup && account?.accountConfigs ? this.mailUtils.getAccountConfig(account.accountConfigs, 'sendgrid_key') : null;
      const sendgridApiKey = accountKey || process.env.SENDGRID_API_KEY;

      sendgrid.setApiKey(sendgridApiKey);
      // Must run AFTER setApiKey: @sendgrid/client.setApiKey() resets
      // defaultRequest.baseUrl to the global region host, clobbering any
      // earlier override (see @sendgrid/client client.js:46). EVO-1052.
      //
      // Note: this mutates the @sendgrid/mail singleton on every send. OSS
      // ships single-tenant so there's no race between concurrent accounts
      // with different baseUrls; SaaS multi-tenant carries the same shape
      // (per-account key swap was already done via setApiKey on the same
      // singleton), so this isn't a regression.
      const baseUrl = process.env.SENDGRID_API_BASE_URL;
      if (baseUrl) {
        getSendGridClient()?.setDefaultRequest('baseUrl', baseUrl.replace(/\/+$/, ''));
      }
      const response = await sendgrid.send(sgMail);
      return response;
    } catch (error) {
      // Redacted: SendGrid error objects routinely include the full request
      // body (recipient emails, custom args, content). Logging the whole
      // thing would leak PII. Surface only the actionable fields.
      const err = error as {
        code?: string | number;
        message?: string;
        response?: { statusCode?: number; body?: { errors?: unknown } };
      };
      console.log('Sendgrid error', {
        code: err?.code,
        message: err?.message,
        statusCode: err?.response?.statusCode,
        sendgridErrors: err?.response?.body?.errors,
      });
      throw new BadRequestException(`Email not sent error: ${err?.message ?? error}`, err?.message);
    }
  }

  private akrossArgs(sendEmailMessage: SendEmailMessage) {
    if (sendEmailMessage.contact.customFields && sendEmailMessage.contact?.customFields?.AKROSSCLICKID) {
      return {
        akrossClickId: sendEmailMessage.contact.customFields.AKROSSCLICKID,
        isNewContact: `${sendEmailMessage.contact?.customFields?.ISNEW || false}`,
      };
    }
    return {};
  }
}
