import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import mailchimp from '@mailchimp/mailchimp_transactional';
import { Account, AutomationContactsBatch, SendEmailMessage } from '../../interfaces';
import { Batch } from '../../mail/mail.interface';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MailUtils } from '../../mail/mail.utils';
import { EmailProviderMetadata, IEmailProvider } from '../email-provider.interface';

// Mandrill `metadata` is a free-form key/value map (max 200 user metadata
// fields per account, 10 keys per message). We mirror SendGrid categories
// as a flat object so the webhook receiver can extract the same context.
const MANDRILL_METADATA_LIMIT = 10;

interface MandrillMessage {
  message: {
    from_email: string;
    from_name?: string;
    subject: string;
    html: string;
    to: Array<{ email: string; name?: string; type?: 'to' | 'cc' | 'bcc' }>;
    headers?: Record<string, string>;
    metadata?: Record<string, string>;
    tags?: string[];
    track_opens?: boolean;
    track_clicks?: boolean;
  };
  async?: boolean;
}

@Injectable()
export class MandrillHandler implements IEmailProvider {
  constructor(
    private readonly formatterUtils: FormatterUtils,
    private readonly mailUtils: MailUtils,
  ) {}

  getMetadata(): EmailProviderMetadata {
    return {
      name: 'mandrill',
      hasFreeTier: false,
      hasWebhook: true,
      notes: 'No free tier: $20/25k blocks. Mandrill é experimental no BMS — discontinuação anunciada várias vezes pela MailChimp (verificado 2026-05).',
    };
  }

  createMail(sendEmailMessage: SendEmailMessage, html: string): MandrillMessage {
    const categories = this.mailUtils.getCategories(sendEmailMessage);
    const finalHtml = this.mailUtils.parseUnsubscriber(html, sendEmailMessage.account);

    return {
      message: {
        from_email: sendEmailMessage.message.from.email,
        from_name: sendEmailMessage.message.from.firstName,
        subject: sendEmailMessage.message.subject,
        html: finalHtml,
        to: [
          {
            email: sendEmailMessage.contact.email,
            name: sendEmailMessage.contact.firstName,
            type: 'to',
          },
        ],
        headers: sendEmailMessage.message.replyTo ? { 'Reply-To': sendEmailMessage.message.replyTo } : undefined,
        metadata: this.toMetadata(categories, sendEmailMessage.contact?.id),
        track_opens: true,
        track_clicks: true,
      },
    };
  }

  createCampaignBatchMail(batch: Batch, htmlContent: string): MandrillMessage {
    const { message, contacts, campaign_id, campaign_test_ab_mode } = batch;
    const utmCampaign = `${batch.campaign_name}_e1_${batch.message.id}`;
    const categories = this.mailUtils.getCategoriesCampaign(message, campaign_id, campaign_test_ab_mode || false, batch.account, utmCampaign);

    let html = htmlContent;
    if (batch.message?.previewText) html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'mandrill',
      utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      isSendgridVariables: false,
    });
    const finalHtml = this.mailUtils.parseUnsubscriber(formatedEmailContent.template, batch.account);

    return {
      message: {
        from_email: message.fromMail,
        from_name: message.fromName,
        subject: this.mailUtils.parseHandlebarsVariables(message.subject, batch.account),
        html: finalHtml,
        // Mandrill supports multiple `to` recipients with `merge_vars` for
        // per-recipient substitution; for parity with SendGrid we treat
        // each contact as its own row in `to[]` with shared metadata.
        to: contacts.map((c) => ({ email: c.email, name: c.firstName, type: 'to' as const })),
        headers: message.replyTo ? { 'Reply-To': message.replyTo } : undefined,
        metadata: this.toMetadata(categories),
        track_opens: true,
        track_clicks: true,
      },
    };
  }

  createAutomationBatchMail(batch: AutomationContactsBatch, htmlContent: string): MandrillMessage {
    const { message, contacts } = batch;
    const categories = this.mailUtils.getCategories(batch);

    let html = htmlContent;
    if (batch.message?.previewText) html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'mandrill',
      utmCampaign: batch.utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      dynamicLink: batch.link,
      isSendgridVariables: false,
    });
    const finalHtml = this.mailUtils.parseUnsubscriber(formatedEmailContent.template, batch.account);

    return {
      message: {
        from_email: message.from.email,
        from_name: message.from.firstName,
        subject: this.mailUtils.parseHandlebarsVariables(message.subject, batch.account),
        html: finalHtml,
        to: contacts.map((c) => ({ email: c.email, name: c.firstName, type: 'to' as const })),
        headers: message.replyTo ? { 'Reply-To': message.replyTo } : undefined,
        metadata: this.toMetadata(categories),
        track_opens: true,
        track_clicks: true,
      },
    };
  }

  async sendEmail(mail: MandrillMessage, account: Account): Promise<unknown> {
    try {
      const apiKey = this.resolveApiKey(account);
      const client = mailchimp(apiKey);
      // Mandrill's transactional SDK exposes messages.send accepting the
      // { message, async? } envelope — we pass through with async=false so
      // the upstream caller can react to per-recipient send errors.
      return await client.messages.send(mail);
    } catch (e) {
      console.error(`Mandrill not sent error: ${JSON.stringify(e)}`);
      throw new HttpException('Cannot send this email!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private resolveApiKey(account: Account | undefined): string {
    if (account?.accountConfigs) {
      const accountKey = this.mailUtils.getAccountConfig(account.accountConfigs, 'mandrill_key');
      if (accountKey) return accountKey;
    }
    return process.env.MANDRILL_API_KEY || '';
  }

  // SendGrid categories ('account_42', 'message_5') become Mandrill metadata
  // entries. Capped at 10 keys per Mandrill's per-message limit; contactId
  // is prioritized so the webhook side never loses correlation.
  private toMetadata(categories: string[], contactId?: number | string): Record<string, string> {
    const meta: Record<string, string> = {};
    if (contactId !== undefined && contactId !== null) meta.contactId = String(contactId);
    for (const c of categories) {
      const idx = c.indexOf('_');
      if (idx < 0) continue;
      const key = c.slice(0, idx);
      const value = c.slice(idx + 1);
      if (Object.keys(meta).length >= MANDRILL_METADATA_LIMIT) break;
      if (!(key in meta)) meta[key] = value;
    }
    return meta;
  }
}
