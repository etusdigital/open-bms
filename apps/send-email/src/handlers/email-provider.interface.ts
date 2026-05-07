import { Account, AutomationContactsBatch, SendEmailMessage } from '../interfaces';
import { Batch } from '../mail/mail.interface';

export interface EmailProviderMetadata {
  name: string;
  hasFreeTier: boolean;
  hasWebhook: boolean;
  notes?: string;
}

export interface IEmailProvider {
  getMetadata(): EmailProviderMetadata;
  createMail(sendEmailMessage: SendEmailMessage, html: string): unknown;
  createCampaignBatchMail(batch: Batch, htmlContent: string): unknown;
  createAutomationBatchMail(batch: AutomationContactsBatch, htmlContent: string): unknown;
  sendEmail(mail: unknown, account: Account): Promise<unknown>;
}
