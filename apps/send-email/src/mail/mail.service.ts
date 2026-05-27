import { MailDataRequired } from '@sendgrid/mail';
import { Injectable } from '@nestjs/common';
import { Batch } from './mail.interface';
import { StorageService } from '../storage/storage.service';
import { Account, AutomationContactsBatch, SendEmailMessage } from '../interfaces';
import { TrackerService } from '../tracker/tracker.service';
import { SparkPostHandler } from '../handlers/sparkpost/sparkPost.handler';
import { SendGridHandler } from '../handlers/sendgrid/sendGrid.handler';
import { IEmailProvider } from '../handlers/email-provider.interface';

// Thin delegation layer kept for backwards compatibility with existing call sites
// (BatchService, AppService). Concrete sending logic lives in the *Handler classes
// behind IEmailProvider. Routing decisions (sparkpost vs sendgrid vs new providers)
// belong to the orchestrators (AppService / BatchService) via EmailProviderRouter,
// not here — keeping MailService router-free avoids circular dependencies between
// MailModule and EmailProvidersModule.
@Injectable()
export class MailService {
  constructor(
    private readonly sparkPostHandler: SparkPostHandler,
    private readonly sendGridHandler: SendGridHandler,
    private readonly storageService: StorageService,
    private readonly trackerService: TrackerService,
  ) {}

  async sendBatch(batch: Batch | AutomationContactsBatch, provider: IEmailProvider, debug: string) {
    const providerName = provider.getMetadata().name;

    if ('campaign_id' in batch) {
      const { message } = batch;
      const htmlContent = message.content ? message.content : await this.storageService.getHtml(message.bucketName, message.fileName);

      const mails = provider.createCampaignBatchMail(batch, htmlContent);

      // SendGrid send accepts (mail, account, isWarmup, debug); other providers
      // ignore the extra args via the optional-parameter contract on IEmailProvider.
      if (providerName === 'sendgrid') {
        return await this.sendGridHandler.sendEmail(mails, batch.account, batch.campaign?.isWarmup, debug);
      }
      return await provider.sendEmail(mails, batch.account);
    }

    const { message } = batch;
    const htmlContent = message.content ? message.content : await this.storageService.getHtml(message.location.bucketName, message.location.fileName);

    const mails = provider.createAutomationBatchMail(batch, htmlContent);

    if (providerName === 'sendgrid') {
      this.trackerService.logDebug(
        `[${batch.messageId}] Sending email in batch to ${batch.contacts.length} contacts. Categories: ${(mails as MailDataRequired).categories.join(', ')}`,
      );
      return await this.sendGridHandler.sendEmail(mails, batch.account, false, debug);
    }

    return await provider.sendEmail(mails, batch.account);
  }

  async sendMail(mail: MailDataRequired, account?: Account, isWarmup = false, debug?: string) {
    return this.sendGridHandler.sendEmail(mail, account, isWarmup, debug);
  }

  createMail(sendEmailMessage: SendEmailMessage, html: string): MailDataRequired {
    return this.sendGridHandler.createMail(sendEmailMessage, html);
  }

  parseBatchToMailDataRequired(batch: Batch, htmlContent: string): MailDataRequired {
    return this.sendGridHandler.createCampaignBatchMail(batch, htmlContent);
  }

  parseAutomationBatchToMailDataRequired(batch: AutomationContactsBatch, htmlContent: string): MailDataRequired {
    return this.sendGridHandler.createAutomationBatchMail(batch, htmlContent);
  }
}
