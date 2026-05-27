import { TwilioProvider } from './twilio.provider';

describe('TwilioProvider', () => {
  let provider: TwilioProvider;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    provider = new TwilioProvider('secret', 'sid', 'accountSid');
  });

  describe('constructor', () => {
    it('should skip Twilio client creation in test env', () => {
      const p = new TwilioProvider('s', 'sid', 'asid');
      expect(p).toBeDefined();
    });
  });

  describe('sendSingleSms', () => {
    it('should return undefined in test env', async () => {
      const result = await provider.sendSingleSms('Hello', '+5511999', 'utms', 'service');
      expect(result).toBeUndefined();
    });
  });

  describe('sendSingleWhatsapp', () => {
    it('should return undefined in test env', async () => {
      const result = await provider.sendSingleWhatsapp('msgId', '+5511999', 'utms', 'service', null);
      expect(result).toBeUndefined();
    });

    it('should return undefined in test env with shortCode', async () => {
      const result = await provider.sendSingleWhatsapp('msgId', '+5511999', 'utms', 'service', 'short123');
      expect(result).toBeUndefined();
    });
  });
});
