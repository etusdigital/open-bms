import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { Account, AutomationContactsBatch, SendEmailMessage } from '../../interfaces';
import { Batch } from '../../mail/mail.interface';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MailUtils } from '../../mail/mail.utils';
import { EmailProviderMetadata, IEmailProvider } from '../email-provider.interface';

// Resend exposes free-form `tags: { name, value }[]` (max 10 entries) and
// per-email `headers`. We use tags to mirror SendGrid categories so the
// webhook receiver can extract account/message/campaign context.
const RESEND_TAG_LIMIT = 10;

interface ResendEmailPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  reply_to?: string;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
}

@Injectable()
export class ResendHandler implements IEmailProvider {
  constructor(
    private readonly formatterUtils: FormatterUtils,
    private readonly mailUtils: MailUtils,
  ) {}

  getMetadata(): EmailProviderMetadata {
    return {
      name: 'resend',
      hasFreeTier: true,
      hasWebhook: true,
      notes: '3000/mês ou 100/dia free tier (verificado 2026-05)',
    };
  }

  createMail(sendEmailMessage: SendEmailMessage, html: string): ResendEmailPayload {
    const categories = this.mailUtils.getCategories(sendEmailMessage);
    const fromName = sendEmailMessage.message.from.firstName;
    const fromEmail = sendEmailMessage.message.from.email;
    const finalHtml = this.mailUtils.parseUnsubscriber(html, sendEmailMessage.account);

    const payload: ResendEmailPayload = {
      from: `${fromName} <${fromEmail}>`,
      to: sendEmailMessage.contact.email,
      subject: sendEmailMessage.message.subject,
      html: finalHtml,
      tags: this.toTags(categories, sendEmailMessage.contact?.id),
      headers: { 'X-Entity-Ref-ID': `${sendEmailMessage.contact?.id ?? ''}` },
    };
    if (sendEmailMessage.message.replyTo) payload.reply_to = sendEmailMessage.message.replyTo;
    return payload;
  }

  createCampaignBatchMail(batch: Batch, htmlContent: string): ResendEmailPayload[] {
    const { message, contacts, campaign_id, campaign_test_ab_mode } = batch;
    const utmCampaign = `${batch.campaign_name}_e1_${batch.message.id}`;
    const categories = this.mailUtils.getCategoriesCampaign(message, campaign_id, campaign_test_ab_mode || false, batch.account, utmCampaign);

    let html = htmlContent;
    if (batch.message?.previewText) html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'resend',
      utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      isSendgridVariables: false,
    });
    const finalHtml = this.mailUtils.parseUnsubscriber(formatedEmailContent.template, batch.account);

    return contacts.map((contact) => ({
      from: `${message.fromName} <${message.fromMail}>`,
      to: contact.email,
      subject: this.mailUtils.parseHandlebarsVariables(message.subject, batch.account),
      html: finalHtml,
      reply_to: message.replyTo || undefined,
      tags: this.toTags(categories, contact.id),
      headers: { 'X-Entity-Ref-ID': `${contact.id}` },
    }));
  }

  createAutomationBatchMail(batch: AutomationContactsBatch, htmlContent: string): ResendEmailPayload[] {
    const { message, contacts } = batch;
    const categories = this.mailUtils.getCategories(batch);

    let html = htmlContent;
    if (batch.message?.previewText) html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'resend',
      utmCampaign: batch.utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      dynamicLink: batch.link,
      isSendgridVariables: false,
    });
    const finalHtml = this.mailUtils.parseUnsubscriber(formatedEmailContent.template, batch.account);

    return contacts.map((contact) => ({
      from: `${message.from.firstName} <${message.from.email}>`,
      to: contact.email,
      subject: this.mailUtils.parseHandlebarsVariables(message.subject, batch.account),
      html: finalHtml,
      reply_to: message.replyTo || undefined,
      tags: this.toTags(categories, contact.id),
      headers: { 'X-Entity-Ref-ID': `${contact.id}` },
    }));
  }

  async sendEmail(mail: ResendEmailPayload | ResendEmailPayload[], account: Account): Promise<unknown> {
    try {
      const apiKey = this.resolveApiKey(account);
      const client = new Resend(apiKey);
      // Resend's batch limit is 100/call; chunk transparently for callers.
      if (Array.isArray(mail)) {
        const RESEND_BATCH_LIMIT = 100;
        const results: unknown[] = [];
        for (let i = 0; i < mail.length; i += RESEND_BATCH_LIMIT) {
          const chunk = mail.slice(i, i + RESEND_BATCH_LIMIT);
          results.push(await client.batch.send(chunk as any));
        }
        return results;
      }
      return await client.emails.send(mail as any);
    } catch (e) {
      console.error(`Resend not sent error: ${JSON.stringify(e)}`);
      throw new HttpException('Cannot send this email!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private resolveApiKey(account: Account | undefined): string {
    if (account?.accountConfigs) {
      const accountKey = this.mailUtils.getAccountConfig(account.accountConfigs, 'resend_key');
      if (accountKey) return accountKey;
    }
    return process.env.RESEND_API_KEY || '';
  }

  // SendGrid-style strings ('account_42') split into Resend's {name, value}
  // tag format. Resend tag names/values are restricted to ASCII alphanumeric,
  // _, - (≤256 chars). Any non-conforming value is collapsed to an underscore.
  private toTags(categories: string[], contactId?: number | string): { name: string; value: string }[] {
    const sanitize = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256);
    const out: { name: string; value: string }[] = [];
    for (const c of categories) {
      const idx = c.indexOf('_');
      if (idx < 0) continue;
      out.push({ name: sanitize(c.slice(0, idx)), value: sanitize(c.slice(idx + 1)) });
    }
    if (contactId !== undefined && contactId !== null) {
      out.push({ name: 'contactId', value: sanitize(String(contactId)) });
    }
    return out.slice(0, RESEND_TAG_LIMIT);
  }
}
