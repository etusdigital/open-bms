import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SESv2Client, SendEmailCommand, SendBulkEmailCommand } from '@aws-sdk/client-sesv2';
import { Account, AutomationContactsBatch, SendEmailMessage } from '../../interfaces';
import { Batch } from '../../mail/mail.interface';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MailUtils } from '../../mail/mail.utils';
import { EmailProviderMetadata, IEmailProvider } from '../email-provider.interface';

// SES MessageTag keys/values are restricted to A-Z, a-z, 0-9, -, _ (max 256 chars).
// SES allows up to 50 tags per message — we still cap to keep payloads compact.
const SES_TAG_LIMIT = 25;

interface SesMessageTag {
  Name: string;
  Value: string;
}

interface SesSinglePayload {
  FromEmailAddress: string;
  Destination: { ToAddresses: string[] };
  ReplyToAddresses?: string[];
  Content: {
    Simple: {
      Subject: { Data: string };
      Body: { Html: { Data: string }; Text?: { Data: string } };
    };
  };
  EmailTags?: SesMessageTag[];
}

interface SesBulkPayload {
  FromEmailAddress: string;
  ReplyToAddresses?: string[];
  DefaultContent: { Template: { TemplateContent: { Subject: string; Html: string } } };
  BulkEmailEntries: Array<{
    Destination: { ToAddresses: string[] };
    ReplacementEmailContent?: any;
    ReplacementTags?: SesMessageTag[];
  }>;
  DefaultEmailTags?: SesMessageTag[];
}

@Injectable()
export class AmazonSesHandler implements IEmailProvider {
  constructor(
    private readonly formatterUtils: FormatterUtils,
    private readonly mailUtils: MailUtils,
  ) {}

  getMetadata(): EmailProviderMetadata {
    return {
      name: 'ses',
      hasFreeTier: false,
      hasWebhook: true,
      notes: 'No free tier perpetuum: 62000/mês exige rodar em EC2. Fora EC2 $0.10/1000 (verificado 2026-05).',
    };
  }

  // SES SendEmailCommand uses the "Simple" content shape for unstructured HTML.
  // Per-message context (account/message/contact ids) travels via EmailTags
  // because SES has no free-form metadata channel — these tags surface again
  // on the SNS event payload `mail.tags` for downstream correlation.
  createMail(sendEmailMessage: SendEmailMessage, html: string): SesSinglePayload {
    const categories = this.mailUtils.getCategories(sendEmailMessage);
    const finalHtml = this.mailUtils.parseUnsubscriber(html, sendEmailMessage.account);

    const payload: SesSinglePayload = {
      FromEmailAddress: `${sendEmailMessage.message.from.firstName} <${sendEmailMessage.message.from.email}>`,
      Destination: { ToAddresses: [sendEmailMessage.contact.email] },
      Content: {
        Simple: {
          Subject: { Data: sendEmailMessage.message.subject },
          Body: { Html: { Data: finalHtml } },
        },
      },
      EmailTags: this.toTags(categories, sendEmailMessage.contact?.id),
    };
    if (sendEmailMessage.message.replyTo) payload.ReplyToAddresses = [sendEmailMessage.message.replyTo];
    return payload;
  }

  createCampaignBatchMail(batch: Batch, htmlContent: string): SesBulkPayload {
    const { message, contacts, campaign_id, campaign_test_ab_mode } = batch;
    const utmCampaign = `${batch.campaign_name}_e1_${batch.message.id}`;
    const categories = this.mailUtils.getCategoriesCampaign(message, campaign_id, campaign_test_ab_mode || false, batch.account, utmCampaign);

    let html = htmlContent;
    if (batch.message?.previewText) html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'ses',
      utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      isSendgridVariables: false,
    });
    const finalHtml = this.mailUtils.parseUnsubscriber(formatedEmailContent.template, batch.account);

    return {
      FromEmailAddress: `${message.fromName} <${message.fromMail}>`,
      ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
      DefaultContent: {
        Template: {
          TemplateContent: {
            Subject: this.mailUtils.parseHandlebarsVariables(message.subject, batch.account),
            Html: finalHtml,
          },
        },
      },
      BulkEmailEntries: contacts.map((contact) => ({
        Destination: { ToAddresses: [contact.email] },
        ReplacementTags: this.toTags(categories, contact.id),
      })),
      DefaultEmailTags: this.toTags(categories),
    };
  }

  createAutomationBatchMail(batch: AutomationContactsBatch, htmlContent: string): SesBulkPayload {
    const { message, contacts } = batch;
    const categories = this.mailUtils.getCategories(batch);

    let html = htmlContent;
    if (batch.message?.previewText) html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'ses',
      utmCampaign: batch.utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      dynamicLink: batch.link,
      isSendgridVariables: false,
    });
    const finalHtml = this.mailUtils.parseUnsubscriber(formatedEmailContent.template, batch.account);

    return {
      FromEmailAddress: `${message.from.firstName} <${message.from.email}>`,
      ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
      DefaultContent: {
        Template: {
          TemplateContent: {
            Subject: this.mailUtils.parseHandlebarsVariables(message.subject, batch.account),
            Html: finalHtml,
          },
        },
      },
      BulkEmailEntries: contacts.map((contact) => ({
        Destination: { ToAddresses: [contact.email] },
        ReplacementTags: this.toTags(categories, contact.id),
      })),
      DefaultEmailTags: this.toTags(categories),
    };
  }

  async sendEmail(mail: SesSinglePayload | SesBulkPayload, account: Account): Promise<unknown> {
    try {
      const { accessKeyId, secretAccessKey, region } = this.resolveCredentials(account);
      const client = new SESv2Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      // Bulk payloads carry a BulkEmailEntries field; single payloads do not.
      const isBulk = Array.isArray((mail as SesBulkPayload).BulkEmailEntries);
      if (isBulk) {
        // SES SendBulkEmailCommand caps at 50 entries/call. Chunk transparently.
        const SES_BULK_LIMIT = 50;
        const bulk = mail as SesBulkPayload;
        const entries = bulk.BulkEmailEntries;
        const results: unknown[] = [];
        for (let i = 0; i < entries.length; i += SES_BULK_LIMIT) {
          const chunk = entries.slice(i, i + SES_BULK_LIMIT);
          results.push(await client.send(new SendBulkEmailCommand({ ...bulk, BulkEmailEntries: chunk } as any)));
        }
        return results;
      }
      return await client.send(new SendEmailCommand(mail as any));
    } catch (e) {
      console.error(`SES not sent error: ${JSON.stringify(e)}`);
      throw new HttpException('Cannot send this email!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private resolveCredentials(account: Account | undefined): {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  } {
    const fromConfig = (key: string) => (account?.accountConfigs ? this.mailUtils.getAccountConfig(account.accountConfigs, key) : undefined);
    return {
      accessKeyId: fromConfig('ses_access_key_id') || process.env.AWS_SES_ACCESS_KEY_ID || '',
      secretAccessKey: fromConfig('ses_secret_access_key') || process.env.AWS_SES_SECRET_ACCESS_KEY || '',
      region: fromConfig('ses_region') || process.env.AWS_SES_REGION || 'us-east-1',
    };
  }

  // SendGrid-style 'account_42' → SES MessageTag {Name:'account', Value:'42'}.
  // Names/values are sanitized to SES-allowed charset (alpha-numeric / _ / -).
  private toTags(categories: string[], contactId?: number | string): SesMessageTag[] {
    const sanitize = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256);
    const out: SesMessageTag[] = [];
    for (const c of categories) {
      const idx = c.indexOf('_');
      if (idx < 0) continue;
      out.push({ Name: sanitize(c.slice(0, idx)), Value: sanitize(c.slice(idx + 1)) });
    }
    if (contactId !== undefined && contactId !== null) {
      out.push({ Name: 'contactId', Value: sanitize(String(contactId)) });
    }
    return out.slice(0, SES_TAG_LIMIT);
  }
}
