import { BINDINGS } from './send-email-consumer.service';

// Wiring contract: the send-email consumer must bind every cross-service
// publish that it owns. EVO-1039 was caused by `campaign-packer` publishing
// `campaign.send` to a Bull queue that no app consumed; this spec is the
// regression fence — it asserts the AMQP `bms.campaigns/campaign.send` triple
// stays bound here, mirroring what `campaign-packer/src/campaign/campaign.
// service.spec.ts` asserts on the publish side.
describe('send-email consumer BINDINGS (contract)', () => {
  it('binds bms.campaigns/campaign.send → /internal/campaigns/send (EVO-1039 fence)', () => {
    const binding = BINDINGS.find((b) => b.exchange === 'bms.campaigns' && b.routingKey === 'campaign.send');
    expect(binding).toBeDefined();
    expect(binding).toMatchObject({
      exchange: 'bms.campaigns',
      routingKey: 'campaign.send',
      queue: 'send-email.campaign.send',
      bridgePath: '/internal/campaigns/send',
    });
  });

  it('binds bms.email/email.send → /internal/email/send', () => {
    const binding = BINDINGS.find((b) => b.exchange === 'bms.email' && b.routingKey === 'email.send');
    expect(binding).toBeDefined();
    expect(binding?.bridgePath).toBe('/internal/email/send');
  });

  it('binds bms.triggers/trigger.process → /internal/automations/process', () => {
    const binding = BINDINGS.find((b) => b.exchange === 'bms.triggers' && b.routingKey === 'trigger.process');
    expect(binding).toBeDefined();
    expect(binding?.bridgePath).toBe('/internal/automations/process');
  });

  it('every binding has a non-empty queue, exchange, routingKey, and bridgePath', () => {
    for (const b of BINDINGS) {
      expect(b.exchange).toMatch(/^bms\./);
      expect(b.routingKey).not.toBe('');
      expect(b.queue).not.toBe('');
      expect(b.bridgePath).toMatch(/^\//);
    }
  });
});
