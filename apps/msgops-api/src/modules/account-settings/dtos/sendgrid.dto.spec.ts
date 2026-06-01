import { getClassSchema } from 'nestjs-joi';
import { SaveAccountSendgridDto } from './sendgrid.dto';

describe('SaveAccountSendgridDto', () => {
  const schema = getClassSchema(SaveAccountSendgridDto);
  const VALID_KEY = 'SG.' + 'x'.repeat(50);

  describe('fromDomain', () => {
    it('requires fromDomain', () => {
      const { error } = schema.validate({ apiKey: VALID_KEY });
      expect(error).toBeDefined();
      expect(error!.details[0].path).toContain('fromDomain');
    });

    it.each(['mail.acme.com', 'acme.com', 'a.b.c.example.co.uk', 'MAIL.ACME.COM'])('accepts valid domain %s', (domain) => {
      const { error } = schema.validate({ apiKey: VALID_KEY, fromDomain: domain });
      expect(error).toBeUndefined();
    });

    it('lowercases + trims the domain', () => {
      const { value, error } = schema.validate({ apiKey: VALID_KEY, fromDomain: '  Mail.Acme.COM  ' });
      expect(error).toBeUndefined();
      expect(value.fromDomain).toBe('mail.acme.com');
    });

    it.each([
      ['no TLD / single label', 'mailexemplo'],
      ['whitespace inside', 'mail exemplo.com'],
      ['trailing dot', 'mail.exemplo.'],
      ['leading dot', '.exemplo.com'],
      ['leading hyphen label', '-mail.com'],
      ['1-char TLD', 'mail.c'],
      ['empty', ''],
    ])('rejects invalid domain (%s)', (_label, domain) => {
      const { error } = schema.validate({ apiKey: VALID_KEY, fromDomain: domain });
      expect(error).toBeDefined();
    });
  });

  describe('apiKey', () => {
    it('is optional (metadata-only edit submits fromDomain alone)', () => {
      const { error } = schema.validate({ fromDomain: 'mail.acme.com' });
      expect(error).toBeUndefined();
    });

    it('still validates the prefix/length when provided', () => {
      const { error } = schema.validate({ apiKey: 'nope', fromDomain: 'mail.acme.com' });
      expect(error).toBeDefined();
      expect(error!.details[0].path).toContain('apiKey');
    });
  });
});
