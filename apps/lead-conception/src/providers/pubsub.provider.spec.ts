import { PubSubProvider } from './pubsub.provider';

describe('PubSubProvider', () => {
  let provider: PubSubProvider;

  beforeEach(() => {
    // Set up environment for non-production (activates bypass)
    process.env.NODE_ENV = 'test';
    process.env.TOPIC_NAME_TAG_PROCESS = 'test-tag-process-topic';
    process.env.TOPIC_NAME_EVENT_PROCESS = 'test-event-process-topic';
    process.env.TOPIC_NAME_EMC_CAMPAIGN_TRIGGER = 'test-emc-campaign-trigger-topic';
    process.env.SERVICE_ACCOUNT = '{}';

    provider = new PubSubProvider();
  });

  describe('sendEventProcessMessage', () => {
    it('should return a hex message ID in non-production environment', async () => {
      const payload = {
        platform: 'custom_events',
        payload: [
          {
            accountId: '1',
            contactId: 63321184,
            email: 'test@example.com',
            event: 'resubscribed',
            timestamp: Date.now(),
          },
        ],
      };

      const result = await provider.sendEventProcessMessage(payload);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(40); // crypto.randomBytes(20).toString('hex') = 40 chars
    });

    it('should accept custom attributes parameter', async () => {
      const payload = {
        platform: 'custom_events',
        payload: [],
      };
      const customAttributes = { platform: 'custom_events' };

      const result = await provider.sendEventProcessMessage(payload, customAttributes);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should return different message IDs for each call', async () => {
      const payload = { platform: 'custom_events', payload: [] };

      const result1 = await provider.sendEventProcessMessage(payload);
      const result2 = await provider.sendEventProcessMessage(payload);

      expect(result1).not.toBe(result2);
    });
  });

  describe('sendEmcCampaignTriggerMessage', () => {
    it('should return a hex message ID in non-production environment', async () => {
      const payload = {
        event: 'quiz_submitted',
        accountId: 1,
        contactId: 100,
        timestamp: Date.now(),
        properties: { leadId: 1 },
      };

      const result = await provider.sendEmcCampaignTriggerMessage(payload);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(40);
    });

    it('should accept custom attributes parameter', async () => {
      const payload = { event: 'quiz_submitted', accountId: 1 };
      const customAttributes = { source: 'test' };

      const result = await provider.sendEmcCampaignTriggerMessage(payload, customAttributes);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('sendAsyncMessage', () => {
    it('should return a hex message ID in non-production environment', async () => {
      const message = {
        contact: { email: 'test@example.com' },
      } as any;

      const result = await provider.sendAsyncMessage(message);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(40);
    });
  });
});
