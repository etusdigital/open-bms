import * as sendgrid from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/mail';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Batch } from './mail.interface';
import { StorageService } from '../storage/storage.service';
import { MailUtils } from './mail.utils';
import { FormatterUtils } from '../utils/formatter.utils';
import { Account, AutomationContactsBatch, SendEmailMessage } from '../interfaces';
import { TrackerService } from '../tracker/tracker.service';
import { SparkPostHandler } from '../handlers/sparkpost/sparkPost.handler';
import { HtmlToTextService } from '../html-to-text/html-to-text.service';
import { SendGridKeyRegistry } from './sendgrid-key-registry';

@Injectable()
export class MailService {
  constructor(
    private readonly formatterUtils: FormatterUtils,
    private readonly htmlToTextService: HtmlToTextService,
    private readonly keyRegistry: SendGridKeyRegistry,
    private readonly mailUtils: MailUtils,
    private readonly sparkPostHandler: SparkPostHandler,
    private readonly storageService: StorageService,
    private readonly trackerService: TrackerService,
  ) {}

  async sendBatch(batch: Batch | AutomationContactsBatch, debug: string) {
    if ('campaign_id' in batch) {
      const { message } = batch;
      const htmlContent = message.content ? message.content : await this.storageService.getHtml(message.bucketName, message.fileName);

      if (batch.message.ippool.includes('sparkpost')) {
        const mails = this.sparkPostHandler.createCampaignBatchMail(batch, htmlContent);
        const results = await this.sparkPostHandler.sendEmail(mails, batch.account);
        return results;
      }

      const mails = this.parseBatchToMailDataRequired(batch, htmlContent);
      return await this.sendMail(mails, batch.account, batch.campaign?.isWarmup, debug);
    }

    const { message } = batch;
    const htmlContent = message.content ? message.content : await this.storageService.getHtml(message.location.bucketName, message.location.fileName);

    if (batch.message.ippool.includes('sparkpost')) {
      const mails = this.sparkPostHandler.createAutomationBatchMail(batch, htmlContent);
      const results = await this.sparkPostHandler.sendEmail(mails, batch.account);
      return results;
    }

    const mails = this.parseAutomationBatchToMailDataRequired(batch, htmlContent);

    this.trackerService.logDebug(`[${batch.messageId}] Sending email in batch to ${batch.contacts.length} contacts. Categories: ${mails.categories.join(', ')}`);

    return await this.sendMail(mails, batch.account, false, debug);
  }

  async sendMail(mail: MailDataRequired, account?: Account, isWarmup = false, debug?: string) {
    if (debug) {
      return mail;
    }

    try {
      // Resolution: per-account `sendgrid_key` first (set by tenant admin
      // in /account-settings/sendgrid), falling back to SENDGRID_API_KEY
      // env var which mirrors the global fallback the super-admin sets in
      // system_config. Warmup campaigns always go through the env-var
      // path so warmup IPs never piggyback on a tenant key.
      const accountKey = !isWarmup && account?.accountConfigs ? this.mailUtils.getAccountConfig(account.accountConfigs, 'sendgrid_key') : null;
      let sendgridApiKey = accountKey || process.env.SENDGRID_API_KEY;

      // temporary fix for replaced keys
      if (account.id === 69) {
        sendgridApiKey = this.keyRegistry.getKey('oseucartao');
      }

      // Unum in
      if (account.id === 149) {
        const randomNumber = Math.random();
        if (mail.categories.includes('type_email') && randomNumber < 0.26) {
          sendgridApiKey = this.keyRegistry.getKey('unum-in-automation');
        }
      }

      // Plusdin
      if (account.id === 1) {
        if (mail.categories.includes('type_campaign')) {
          sendgridApiKey = this.keyRegistry.getKey('plusdin-campaigns');
        }
        if (mail.categories.includes('type_transactional') || (mail.categories.includes('type_email') && this.includesInCategory(mail.categories, '_e1_'))) {
          sendgridApiKey = this.keyRegistry.getKey('plusdin-transactional');
        } else if (mail.categories.includes('type_email')) {
          sendgridApiKey = this.keyRegistry.getKey('plusdin-automations');
        }
      }

      // Plusdin - NOVO
      if (account.id === 235) {
        if (mail.categories.includes('type_campaign')) {
          sendgridApiKey = this.keyRegistry.getKey('plusdin-novo-campaigns');
        }
        if (mail.categories.includes('type_transactional') || (mail.categories.includes('type_email') && this.includesInCategory(mail.categories, '_e1_'))) {
          sendgridApiKey = this.keyRegistry.getKey('plusdin-novo-transactional');
        } else if (mail.categories.includes('type_email')) {
          sendgridApiKey = this.keyRegistry.getKey('plusdin-novo-automations');
        }
      }

      // easy
      if (account.id === 5) {
        if (mail.categories.includes('type_campaign')) {
          sendgridApiKey = this.keyRegistry.getKey('easy-campaigns');
        } else {
          if (this.includesInCategory(mail.categories, 'automation-id_2802')) {
            sendgridApiKey = this.keyRegistry.getKey('easy-automations-1');
          } else if (this.includesInCategory(mail.categories, 'automation-id_2803')) {
            sendgridApiKey = this.keyRegistry.getKey('easy-automations-2');
          } else if (this.includesInCategory(mail.categories, 'automation-id_2804')) {
            sendgridApiKey = this.keyRegistry.getKey('easy-automations-3');
          } else if (mail.categories.includes('type_transactional') || (mail.categories.includes('type_email') && this.includesInCategory(mail.categories, '_e1_'))) {
            sendgridApiKey = this.keyRegistry.getKey('easy-transactional');
          } else if (mail.categories.includes('type_email')) {
            sendgridApiKey = this.keyRegistry.getKey('easy-automations');
          }
        }
      }

      // vouquitar
      if (account.id === 16) {
        if (mail.categories.includes('type_campaign')) {
          sendgridApiKey = this.keyRegistry.getKey('vq-campaigns');
        }
        if (mail.categories.includes('type_transactional') || (mail.categories.includes('type_email') && this.includesInCategory(mail.categories, '_e1_'))) {
          sendgridApiKey = this.keyRegistry.getKey('vq-transactional');
        } else if (mail.categories.includes('type_email')) {
          sendgridApiKey = this.keyRegistry.getKey('vq-automations');
        }
      }

      // Peca o seu
      if (account.id === 10) {
        if (mail.categories.includes('message_210909') || mail.categories.includes('message_210945') || mail.categories.includes('message_218981')) {
          sendgridApiKey = this.keyRegistry.getKey('peca-o-seu');
        }
      }

      // cardfacil
      if (account.id === 2 && mail.categories.includes('type_email')) {
        sendgridApiKey = this.keyRegistry.getKey('cardfacil');
      }

      // mejoresopciones
      if (account.id === 22) {
        const randomNumber = Math.random();
        if (mail.categories.includes('type_email') && randomNumber < 0.5) {
          sendgridApiKey = this.keyRegistry.getKey('mejoresopciones-emp');
        }
      }

      // gotallcards
      if (account.id === 65 && mail.categories.includes('pool_gotallcards_com')) {
        sendgridApiKey = this.keyRegistry.getKey('gotallcards-warmup');
      }

      if (account.id === 6) {
        if (this.includesInCategory(mail.categories, 'automation-id_2892')) {
          sendgridApiKey = this.keyRegistry.getKey('help-automations-1');
        } else if (this.includesInCategory(mail.categories, 'automation-id_2893')) {
          sendgridApiKey = this.keyRegistry.getKey('help-automations-2');
        }
      }

      if (account.id === 150 && this.includesInCategory(mail.categories, 'automation-id_2997')) {
        sendgridApiKey = this.keyRegistry.getKey('unum-us-automation-2');
      }

      if (account.id === 152 && this.includesInCategory(mail.categories, 'automation-id_3028')) {
        sendgridApiKey = this.keyRegistry.getKey('unum-ca-automation');
      }

      sendgrid.setApiKey(sendgridApiKey);
      const response = await sendgrid.send(mail);
      return response;
    } catch (error) {
      console.log('Sendgrid error', JSON.stringify(error));
      throw new BadRequestException(`Email not sent error: ${error}`, error);
    }
  }

  includesInCategory(categories: string[], value: string) {
    return categories.find((item) => item.includes(value));
  }

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
      }, // Use the email address or domain you verified above
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
      ipPoolName: this.mailUtils.getIppol(sendEmailMessage.message),
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

  akrossArgs(sendEmailMessage: SendEmailMessage) {
    if (sendEmailMessage.contact.customFields && sendEmailMessage.contact?.customFields?.AKROSSCLICKID) {
      return {
        akrossClickId: sendEmailMessage.contact.customFields.AKROSSCLICKID,
        isNewContact: `${sendEmailMessage.contact?.customFields?.ISNEW || false}`,
      };
    }
    return {};
  }

  parseBatchToMailDataRequired(batch: Batch, htmlContent: string): MailDataRequired {
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
      ipPoolName,
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

  parseAutomationBatchToMailDataRequired(batch: AutomationContactsBatch, htmlContent: string): MailDataRequired {
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
      ipPoolName,
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
}
