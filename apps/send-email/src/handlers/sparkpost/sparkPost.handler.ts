import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Account, AutomationContactsBatch, SendEmailMessage } from 'src/interfaces';
import { FormatterUtils } from '../../utils/formatter.utils';
import { MailUtils } from '../../mail/mail.utils';
import * as Sparkpost from 'sparkpost';
import { Batch } from 'src/mail/mail.interface';
import { EmailProviderMetadata, IEmailProvider } from '../email-provider.interface';

@Injectable()
export class SparkPostHandler implements IEmailProvider {
  constructor(
    private readonly formatterUtils: FormatterUtils,
    private readonly mailUtils: MailUtils,
  ) {}

  getMetadata(): EmailProviderMetadata {
    return {
      name: 'sparkpost',
      hasFreeTier: true,
      hasWebhook: true,
      notes: '500 emails/mês free tier',
    };
  }

  createMail(sendEmailMessage: SendEmailMessage, html: string) {
    const replyTo = (sendEmailMessage: SendEmailMessage) => {
      if (sendEmailMessage.message && sendEmailMessage.message.replyTo) {
        return `${sendEmailMessage.message.from.firstName} <${sendEmailMessage.message.replyTo}>`;
      }

      return undefined;
    };

    const categories = this.mailUtils.getCategoriesSparkpost(this.mailUtils.getCategories(sendEmailMessage));
    const accountName = this.formatterUtils.normalizeString(sendEmailMessage?.account?.name.toLowerCase().slice(0, 15));
    const automationType = sendEmailMessage.automationType === 'email' ? 'automation' : sendEmailMessage.automationType;

    return {
      options: {
        open_tracking: true,
        click_tracking: true,
        ip_pool: sendEmailMessage.message.ippool,
        ...(sendEmailMessage.sendAt ? { start_time: sendEmailMessage.sendAt } : {}),
      },
      campaign_id: this.sandBoxParseCampaign(this.formatterUtils.slugify(sendEmailMessage.utmCampaign)),
      metadata: {
        ...categories,
        ...(sendEmailMessage.contact?.id ? { contactId: `${sendEmailMessage.contact?.id}` } : {}),
      },
      return_path: sendEmailMessage.message.from.email,
      content: {
        from: {
          name: sendEmailMessage.message.from.firstName,
          email: sendEmailMessage.message.from.email,
        },
        subject: sendEmailMessage.message.subject,
        reply_to: replyTo(sendEmailMessage),
        html: this.mailUtils.parseUnsubscriber(html, sendEmailMessage.account),
        headers: {
          'Feedback-ID': `id${sendEmailMessage.message.id}:${accountName}:${automationType}:etusbms`,
        },
      },
      recipients: [
        {
          address: {
            name: sendEmailMessage.contact.firstName || '',
            email: this.sandBoxParseEmail(sendEmailMessage.contact.email),
          },
        },
      ],
    };
  }

  createCampaignBatchMail(batch: Batch, htmlContent: string) {
    const { message, contacts, campaign_id, campaign_test_ab_mode, is_campaign_warmup_mode } = batch;

    const accountName = this.formatterUtils.normalizeString(batch.account?.name.toLowerCase().slice(0, 15));
    const ipPoolName = this.mailUtils.getIppol(message);
    const utmCampaign = `${batch.campaign_name}_e1_${batch.message.id}`;

    const categories = this.mailUtils.getCategoriesSparkpost(
      this.mailUtils.getCategoriesCampaign(message, campaign_id, campaign_test_ab_mode || false, batch.account, utmCampaign),
    );

    let html = htmlContent;
    if (batch.message && batch.message.previewText) {
      html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    }

    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'sparkpost',
      utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      isSendgridVariables: true,
    });
    const htmlEnhancement = this.mailUtils.parseUnsubscriber(formatedEmailContent.template, batch.account);

    const personalizations = contacts.map((contact) => ({
      address: {
        email: contact.email,
        name: contact.firstName || '',
      },
      substitution_data: this.mailUtils.mapVariables(contact, batch.account, message, formatedEmailContent.replaceLinks, true),
      metadata: {
        ...categories,
        ...(contact.id ? { contactId: `${contact.id}` } : {}),
        ...(is_campaign_warmup_mode ? { isWarmupCampaign: 'true' } : {}),
      },
    }));

    const replyTo = (batch: Batch) => {
      if (batch.message && batch.message.replyTo) {
        return `${batch.message.fromName} <${batch.message.replyTo}>`;
      }

      return undefined;
    };

    return {
      options: {
        open_tracking: true,
        click_tracking: true,
        ip_pool: ipPoolName,
      },
      campaign_id: this.sandBoxParseCampaign(this.formatterUtils.slugify(batch.campaign_name)),
      metadata: categories,
      return_path: batch.message.fromMail,
      content: {
        from: {
          name: batch.message.fromName,
          email: batch.message.fromMail,
        },
        subject: this.mailUtils.parseHandlebarsVariables(batch.message.subject, batch.account),
        reply_to: replyTo(batch),
        html: htmlEnhancement,
        headers: {
          'Feedback-ID': `id${batch.message.id}:${accountName}:campaign:etusbms`,
        },
      },
      recipients: personalizations,
    };
  }

  createAutomationBatchMail(batch: AutomationContactsBatch, htmlContent: string) {
    const { message, contacts } = batch;

    const accountName = this.formatterUtils.normalizeString(batch.account?.name.toLowerCase().slice(0, 15));
    const automationType = batch.automationType === 'email' ? 'automation' : batch.automationType;

    const ipPoolName = this.mailUtils.getIppol(message);
    const categories = this.mailUtils.getCategoriesSparkpost(this.mailUtils.getCategories(batch));

    let html = htmlContent;
    if (batch.message && batch.message.previewText) {
      html = this.mailUtils.createPreviewText(html, batch.message.previewText);
    }

    html = this.mailUtils.parseHandlebarsVariables(html, batch.account);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: html,
      provider: 'sparkpost',
      utmCampaign: batch.utmCampaign,
      messageId: batch.message.id,
      account: batch.account,
      dynamicLink: batch.link,
      isSendgridVariables: true,
    });

    const htmlEnhancement = this.mailUtils.parseUnsubscriber(formatedEmailContent.template, batch.account);

    const personalizations = contacts.map((contact) => ({
      address: {
        email: contact.email,
        name: contact.firstName || '',
      },
      substitution_data: this.mailUtils.mapVariables(contact, batch.account, message, formatedEmailContent.replaceLinks, true),
      metadata: {
        ...categories,
        ...(contact.id ? { contactId: `${contact.id}` } : {}),
      },
    }));

    const replyTo = (batch: AutomationContactsBatch) => {
      if (batch.message && batch.message.replyTo) {
        return `${batch.message.from.firstName} <${batch.message.replyTo}>`;
      }

      return undefined;
    };

    return {
      options: {
        open_tracking: true,
        click_tracking: true,
        ip_pool: ipPoolName,
      },
      campaign_id: this.sandBoxParseCampaign(this.formatterUtils.slugify(batch.message.name)),
      metadata: categories,
      return_path: message.from.email,
      content: {
        from: {
          name: message.from.firstName,
          email: message.from.email,
        },
        subject: this.mailUtils.parseHandlebarsVariables(message.subject, batch.account),
        reply_to: replyTo(batch),
        html: htmlEnhancement,
        headers: {
          'Feedback-ID': `id${batch.message.id}:${accountName}:${automationType}:etusbms`,
        },
      },
      recipients: personalizations,
    };
  }

  async sendEmail(mail, account: Account) {
    try {
      let sparkPostKey = process.env.SPARKPOST_API_KEY;
      if (account && account.accountConfigs) {
        sparkPostKey = this.mailUtils.getAccountConfig(account.accountConfigs, 'sparkpost_key');
      }

      const client = new Sparkpost(sparkPostKey);
      return await client.transmissions.send(mail);
    } catch (e) {
      console.error(`Email not sent error: ${JSON.stringify(e)}`);
      // console.error(`Email not sent error recipients: ${JSON.stringify(mail.recipients)}`);
      throw new HttpException('Cannot send this email!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  sandBoxParseEmail(email: string) {
    if (process.env.SANDBOX_MODE === 'true') {
      email = `${email}.sink.sparkpostmail.com`;
    }

    return email;
  }

  sandBoxParseCampaign(campaign: string) {
    if (process.env.SANDBOX_MODE === 'true') {
      campaign = `sparkpost-performance-test-${campaign}`;
    }

    // campaign_id is limited to 64
    return campaign.slice(0, 64);
  }
}
