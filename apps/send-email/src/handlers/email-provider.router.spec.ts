import { Account, AccountConfig } from '../interfaces';
import { MailUtils } from '../mail/mail.utils';
import { IEmailProvider } from './email-provider.interface';
import { EmailProviderRegistry } from './email-provider.registry';
import { EmailProviderRouter, FALLBACK_PROVIDER_ENV } from './email-provider.router';

const mailUtilsStub: Pick<MailUtils, 'getAccountConfig'> = {
  getAccountConfig(accountConfigs: AccountConfig[] | Record<string, unknown>, key: string) {
    if (Array.isArray(accountConfigs)) {
      return accountConfigs.find((c) => c.name === key)?.value;
    }
    return (accountConfigs as Record<string, unknown>)[key] as unknown;
  },
};

function provider(name: string): IEmailProvider {
  return {
    getMetadata: () => ({ name, hasWebhook: true, hasFreeTier: true }),
    createMail: jest.fn(),
    createCampaignBatchMail: jest.fn(),
    createAutomationBatchMail: jest.fn(),
    sendEmail: jest.fn(),
  };
}

function makeAccount(configs: Partial<AccountConfig>[] = []): Account {
  return {
    id: 1,
    accountConfigs: configs.map((c) => ({ accountId: 1, name: '', value: '', ...c }) as AccountConfig & typeof c),
  };
}

describe('EmailProviderRouter', () => {
  let registry: EmailProviderRegistry;
  let router: EmailProviderRouter;
  const sparkpost = provider('sparkpost');
  const sendgrid = provider('sendgrid');
  const mailersend = provider('mailersend');
  const originalEnv = process.env[FALLBACK_PROVIDER_ENV];

  beforeEach(() => {
    registry = new EmailProviderRegistry();
    registry.register(sparkpost);
    registry.register(sendgrid);
    registry.register(mailersend);
    router = new EmailProviderRouter(registry, mailUtilsStub as MailUtils);
    delete process.env[FALLBACK_PROVIDER_ENV];
  });

  afterAll(() => {
    if (originalEnv !== undefined) process.env[FALLBACK_PROVIDER_ENV] = originalEnv;
  });

  // AC5
  it('uses default_email_provider from accountConfigs when set, regardless of ippool', () => {
    const account = makeAccount([{ name: 'default_email_provider', value: 'mailersend' }]);
    const message = { ippool: 'sparkpost-warmup' };

    expect(router.resolveForMessage(account, message)).toBe(mailersend);
  });

  // AC4
  it('falls back to sparkpost when ippool contains "sparkpost" and no default_email_provider is set', () => {
    const account = makeAccount();
    const message = { ippool: 'sparkpost_main' };

    expect(router.resolveForMessage(account, message)).toBe(sparkpost);
  });

  it('falls back to sendgrid when ippool does not contain sparkpost and no default_email_provider', () => {
    const account = makeAccount();
    const message = { ippool: 'whatever' };

    expect(router.resolveForMessage(account, message)).toBe(sendgrid);
  });

  it('uses DEFAULT_EMAIL_PROVIDER env when accountConfigs and ippool give no signal', () => {
    process.env[FALLBACK_PROVIDER_ENV] = 'mailersend';
    const account = makeAccount();
    const message = { ippool: '' };

    expect(router.resolveForMessage(account, message)).toBe(mailersend);
  });

  // AC6
  it('throws when default_email_provider points to a missing provider, listing available ones', () => {
    const account = makeAccount([{ name: 'default_email_provider', value: 'nonexistent' }]);

    expect(() => router.resolveForMessage(account, { ippool: '' })).toThrow(/Available providers: sparkpost, sendgrid, mailersend/);
  });

  it('handles undefined account/message defensively (falls back to sendgrid)', () => {
    expect(router.resolveForMessage(undefined, undefined)).toBe(sendgrid);
  });
});
