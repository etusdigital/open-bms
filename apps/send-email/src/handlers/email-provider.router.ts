import { Inject, Injectable } from '@nestjs/common';
import { Account } from '../interfaces';
import { Email as MailEmail } from '../mail/mail.interface';
import { MailUtils } from '../mail/mail.utils';
import { IEmailProvider } from './email-provider.interface';
import { EmailProviderRegistry } from './email-provider.registry';
import { EMAIL_PROVIDER_REGISTRY_TOKEN } from './email-provider.tokens';

export const ACCOUNT_CONFIG_DEFAULT_PROVIDER_KEY = 'default_email_provider';
export const FALLBACK_PROVIDER_ENV = 'DEFAULT_EMAIL_PROVIDER';

// Both shapes (single email vs batch) carry an `ippool` string. We accept the
// minimal subset to keep this router independent of the full Email definitions.
type MessageWithIppool = Pick<MailEmail, 'ippool'> | { ippool?: string };

@Injectable()
export class EmailProviderRouter {
  constructor(
    @Inject(EMAIL_PROVIDER_REGISTRY_TOKEN) private readonly registry: EmailProviderRegistry,
    private readonly mailUtils: MailUtils,
  ) {}

  resolveForMessage(account: Account | undefined, message: MessageWithIppool | undefined): IEmailProvider {
    const explicit = this.readDefaultProviderConfig(account);
    if (explicit) {
      return this.registry.get(explicit);
    }

    const ippool = message?.ippool ?? '';
    if (ippool && ippool.includes('sparkpost') && this.registry.has('sparkpost')) {
      return this.registry.get('sparkpost');
    }

    const envFallback = (process.env[FALLBACK_PROVIDER_ENV] || '').trim();
    if (envFallback) {
      return this.registry.get(envFallback);
    }

    if (this.registry.has('sendgrid')) {
      return this.registry.get('sendgrid');
    }

    // Last resort: first registered provider. Surfaces a clear error if registry is empty.
    return this.registry.get(this.registry.names()[0]);
  }

  private readDefaultProviderConfig(account: Account | undefined): string | undefined {
    if (!account?.accountConfigs) return undefined;
    const value = this.mailUtils.getAccountConfig(account.accountConfigs, ACCOUNT_CONFIG_DEFAULT_PROVIDER_KEY);
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    return undefined;
  }
}
