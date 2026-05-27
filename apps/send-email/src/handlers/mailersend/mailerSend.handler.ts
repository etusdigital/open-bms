import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MailerSend, EmailParams, Recipient, Sender } from 'mailersend';

// MailerSend re-exports `Personalization` only from a deep submodule
// (lib/modules/Email.module). Mirroring the shape locally avoids the
// path-import and keeps the handler's surface stable across SDK minors.
interface Personalization {
  email: string;
  data: Record<string, any>;
}
import { Account, AutomationContactsBatch, SendEmailMessage } from '../../interfaces';
import { Batch } from '../../mail/mail.interface';
import { MailUtils } from '../../mail/mail.utils';
import { EmailProviderMetadata, IEmailProvider } from '../email-provider.interface';

// MailerSend has no free-form metadata; we encode the same context fields
// SendGrid puts in `categories` (account, message, type, campaign, etc.) into
// MailerSend `tags: string[]` (max 5 tags per email per their API limits).
const MAILERSEND_TAG_LIMIT = 5;

@Injectable()
export class MailerSendHandler implements IEmailProvider {
  constructor(private readonly mailUtils: MailUtils) {}

  getMetadata(): EmailProviderMetadata {
    return {
      name: 'mailersend',
      hasFreeTier: true,
      hasWebhook: true,
      notes: '3000 emails/mês perpétuo (verificado 2026-05)',
    };
  }

  createMail(sendEmailMessage: SendEmailMessage, html: string): EmailParams {
    const categories = this.mailUtils.getCategories(sendEmailMessage);
    const tags = this.toTags(categories, sendEmailMessage.contact?.id);

    const personalization: Personalization[] = [
      {
        email: sendEmailMessage.contact.email,
        data: this.mailUtils.mapVariables(sendEmailMessage.contact, sendEmailMessage.account, sendEmailMessage.message, {}, true),
      },
    ];

    const params = new EmailParams()
      .setFrom(new Sender(sendEmailMessage.message.from.email, sendEmailMessage.message.from.firstName))
      .setTo([new Recipient(sendEmailMessage.contact.email, sendEmailMessage.contact.firstName || '')])
      .setSubject(sendEmailMessage.message.subject)
      .setHtml(this.mailUtils.parseUnsubscriber(html, sendEmailMessage.account))
      .setTags(tags)
      .setPersonalization(personalization);

    if (sendEmailMessage.message.replyTo) {
      params.setReplyTo(new Sender(sendEmailMessage.message.replyTo, sendEmailMessage.message.from.firstName));
    }

    return params;
  }

  createCampaignBatchMail(batch: Batch, htmlContent: string): EmailParams[] {
    const { message, contacts, campaign_id, campaign_test_ab_mode } = batch;
    const utmCampaign = `${batch.campaign_name}_e1_${batch.message.id}`;
    const categories = this.mailUtils.getCategoriesCampaign(message, campaign_id, campaign_test_ab_mode || false, batch.account, utmCampaign);

    let html = htmlContent;
    if (batch.message?.previewText) html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'mailersend',
      utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      isSendgridVariables: false,
    });
    const finalHtml = this.mailUtils.parseUnsubscriber(formatedEmailContent.template, batch.account);

    return contacts.map((contact) => {
      const tags = this.toTags(categories, contact.id);
      return new EmailParams()
        .setFrom(new Sender(message.fromMail, message.fromName))
        .setTo([new Recipient(contact.email, contact.firstName || '')])
        .setSubject(this.mailUtils.parseHandlebarsVariables(message.subject, batch.account))
        .setHtml(finalHtml)
        .setTags(tags)
        .setPersonalization([
          {
            email: contact.email,
            data: this.mailUtils.mapVariables(contact, batch.account, message, formatedEmailContent.replaceLinks, true),
          },
        ]);
    });
  }

  createAutomationBatchMail(batch: AutomationContactsBatch, htmlContent: string): EmailParams[] {
    const { message, contacts } = batch;
    const categories = this.mailUtils.getCategories(batch);

    let html = htmlContent;
    if (batch.message?.previewText) html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'mailersend',
      utmCampaign: batch.utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      dynamicLink: batch.link,
      isSendgridVariables: false,
    });
    const finalHtml = this.mailUtils.parseUnsubscriber(formatedEmailContent.template, batch.account);

    return contacts.map((contact) => {
      const tags = this.toTags(categories, contact.id);
      return new EmailParams()
        .setFrom(new Sender(message.from.email, message.from.firstName))
        .setTo([new Recipient(contact.email, contact.firstName || '')])
        .setSubject(this.mailUtils.parseHandlebarsVariables(message.subject, batch.account))
        .setHtml(finalHtml)
        .setTags(tags)
        .setPersonalization([
          {
            email: contact.email,
            data: this.mailUtils.mapVariables(contact, batch.account, message, formatedEmailContent.replaceLinks, true),
          },
        ]);
    });
  }

  async sendEmail(mail: EmailParams | EmailParams[], account: Account): Promise<unknown> {
    try {
      const apiKey = this.resolveApiKey(account);
      const client = new MailerSend({ apiKey });
      // MailerSend SDK exposes single-email .send and bulk .sendBulk.
      // Routing here keeps the handler payload-agnostic.
      if (Array.isArray(mail)) {
        return await client.email.sendBulk(mail);
      }
      return await client.email.send(mail);
    } catch (e) {
      console.error(`MailerSend not sent error: ${JSON.stringify(e)}`);
      throw new HttpException('Cannot send this email!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private resolveApiKey(account: Account | undefined): string {
    if (account?.accountConfigs) {
      const accountKey = this.mailUtils.getAccountConfig(account.accountConfigs, 'mailersend_key');
      if (accountKey) return accountKey;
    }
    return process.env.MAILERSEND_API_KEY || '';
  }

  // SendGrid-style category strings ('account_42', 'message_5') are flattened
  // into MailerSend's `tags: string[]`, capped at 5 entries (MailerSend limit).
  // contactId/account/message are prioritized: the webhook ingestion side
  // needs them to correlate events back to our DB. Less critical tags (pool,
  // source, utmcampaign) are the first to be dropped when over the limit.
  private toTags(categories: string[], contactId?: number | string): string[] {
    const PRIORITY_PREFIXES = ['account_', 'message_', 'campaign_', 'automation-id_', 'type_'];
    const priority: string[] = [];
    const rest: string[] = [];
    for (const c of categories) {
      if (PRIORITY_PREFIXES.some((p) => c.startsWith(p))) priority.push(c);
      else rest.push(c);
    }
    const tags = contactId !== undefined && contactId !== null ? [`contactId_${contactId}`] : [];
    tags.push(...priority, ...rest);
    return tags.slice(0, MAILERSEND_TAG_LIMIT);
  }
}
