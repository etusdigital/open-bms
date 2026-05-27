import { IEmailProvider } from './email-provider.interface';
import { EmailProviderEligibilityError, EmailProviderNotFoundError, EmailProviderRegistry } from './email-provider.registry';

function fakeProvider(name: string, hasWebhook = true, hasFreeTier = true): IEmailProvider {
  return {
    getMetadata: () => ({ name, hasWebhook, hasFreeTier }),
    createMail: jest.fn(),
    createCampaignBatchMail: jest.fn(),
    createAutomationBatchMail: jest.fn(),
    sendEmail: jest.fn(),
  };
}

describe('EmailProviderRegistry', () => {
  it('registers and retrieves providers by name', () => {
    const reg = new EmailProviderRegistry();
    const p = fakeProvider('sparkpost');
    reg.register(p);

    expect(reg.has('sparkpost')).toBe(true);
    expect(reg.get('sparkpost')).toBe(p);
    expect(reg.names()).toEqual(['sparkpost']);
  });

  it('throws EmailProviderNotFoundError listing available providers', () => {
    const reg = new EmailProviderRegistry();
    reg.register(fakeProvider('sparkpost'));

    expect(() => reg.get('mailersend')).toThrow(EmailProviderNotFoundError);
    expect(() => reg.get('mailersend')).toThrow(/Available providers: sparkpost/);
  });

  it('rejects providers with empty name', () => {
    const reg = new EmailProviderRegistry();
    expect(() => reg.register(fakeProvider(''))).toThrow(EmailProviderEligibilityError);
  });

  it('rejects duplicate registration of the same name', () => {
    const reg = new EmailProviderRegistry();
    reg.register(fakeProvider('sparkpost'));
    expect(() => reg.register(fakeProvider('sparkpost'))).toThrow(/already registered/);
  });

  describe('assertWebhookCapable (AC1 — eligibility gate)', () => {
    it('passes when every provider has hasWebhook=true', () => {
      const reg = new EmailProviderRegistry();
      reg.register(fakeProvider('sparkpost', true));
      reg.register(fakeProvider('sendgrid', true));
      expect(() => reg.assertWebhookCapable()).not.toThrow();
    });

    it('throws EmailProviderEligibilityError when any provider has hasWebhook=false', () => {
      const reg = new EmailProviderRegistry();
      reg.register(fakeProvider('sparkpost', true));
      reg.register(fakeProvider('rogueprovider', false));
      expect(() => reg.assertWebhookCapable()).toThrow(EmailProviderEligibilityError);
      expect(() => reg.assertWebhookCapable()).toThrow(/rogueprovider/);
    });

    it('passes trivially when registry is empty (no offenders)', () => {
      const reg = new EmailProviderRegistry();
      expect(() => reg.assertWebhookCapable()).not.toThrow();
    });
  });

  it('list() returns metadata for every registered provider', () => {
    const reg = new EmailProviderRegistry();
    reg.register(fakeProvider('sparkpost', true, true));
    reg.register(fakeProvider('ses', true, false));

    expect(reg.list()).toEqual([
      { name: 'sparkpost', hasWebhook: true, hasFreeTier: true },
      { name: 'ses', hasWebhook: true, hasFreeTier: false },
    ]);
  });
});
