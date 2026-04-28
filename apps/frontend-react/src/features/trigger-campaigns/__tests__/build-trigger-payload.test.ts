import { describe, it, expect } from 'vitest';
import { buildTriggerPayload } from '../build-trigger-payload';
import type { TriggerCampaignFormValues } from '../trigger-campaign-schema';

const baseForm: TriggerCampaignFormValues = {
  title: 'Test Trigger',
  description: 'A test trigger campaign',
  messageType: 'email',
  triggerType: 'events',
  eventType: 'open',
  frequency: 'unique',
  sendTiming: 'immediate',
  waitValue: 0,
  waitUnit: 'hours',
  timePeriodValue: 1,
  timePeriodUnit: 'days',
  messages: [{ id: 100, title: 'Promo Email', subject: 'Sale!', name: 'promo-email', links: [] }],
};

describe('buildTriggerPayload', () => {
  it('builds correct payload for single message + immediate send', () => {
    const payload = buildTriggerPayload(baseForm);

    expect(payload.type).toBe('trigger');
    expect(payload.messageType).toBe('email');
    expect(payload.title).toBe('Test Trigger');
    expect(payload.description).toBe('A test trigger campaign');
    expect(payload.steps).toBeDefined();
    expect(payload.steps.type).toBe('trigger');
    expect(payload.steps.id).toBe(1);

    // Trigger settings
    const settings = payload.steps.settings;
    expect(settings.type).toBe('events');
    expect(settings.eventType).toBe('open');
    expect(settings.applyFrequency).toBe('unique');
    expect(settings).not.toHaveProperty('conditional');

    // Child: single email step (no wait wrapper)
    const child = payload.steps.child;
    expect(child).toHaveLength(1);
    expect(child[0].type).toBe('email');
    expect(child[0].settings.id).toBe(100);
    expect(child[0].settings.title).toBe('Promo Email');
    expect(child[0].settings.subject).toBe('Sale!');
    // End step
    expect(child[0].child).toHaveLength(1);
    expect(child[0].child[0].type).toBe('end');
  });

  it('builds randomMessage step for multiple messages', () => {
    const form: TriggerCampaignFormValues = {
      ...baseForm,
      messages: [
        { id: 100, title: 'Msg A', subject: 'Subject A', name: 'msg-a', links: [] },
        { id: 200, title: 'Msg B', subject: 'Subject B', name: 'msg-b', links: [] },
      ],
    };

    const payload = buildTriggerPayload(form);
    const child = payload.steps.child;

    expect(child).toHaveLength(1);
    expect(child[0].type).toBe('randomMessage');
    expect(child[0].settings.messages).toHaveLength(2);
    expect(child[0].settings.messages[0].id).toBe(100);
    expect(child[0].settings.messages[1].id).toBe(200);
    expect(child[0].child[0].type).toBe('end');
  });

  it('wraps with wait step when sendTiming is wait', () => {
    const form: TriggerCampaignFormValues = {
      ...baseForm,
      sendTiming: 'wait',
      waitValue: 2,
      waitUnit: 'hours',
    };

    const payload = buildTriggerPayload(form);
    const child = payload.steps.child;

    // Wait step wraps the email step
    expect(child).toHaveLength(1);
    expect(child[0].type).toBe('wait');
    expect(child[0].settings.timer).toBe(2);
    expect(child[0].settings.timerType).toBe('hours');
    // Email step is nested inside wait
    expect(child[0].child).toHaveLength(1);
    expect(child[0].child[0].type).toBe('email');
  });

  it('builds custom_events trigger correctly', () => {
    const form: TriggerCampaignFormValues = {
      ...baseForm,
      triggerType: 'custom_events',
      eventType: undefined,
      customEvent: { id: 42, name: 'purchase_completed' },
    };

    const payload = buildTriggerPayload(form);
    const settings = payload.steps.settings;

    expect(settings.type).toBe('custom_events');
    expect(settings.eventType).toBeUndefined();
    expect(settings.id).toBe(42);
    expect(settings.name).toBe('purchase_completed');
  });

  it('converts timePeriod correctly for multiply-period frequency', () => {
    const form: TriggerCampaignFormValues = {
      ...baseForm,
      frequency: 'multiply-period',
      timePeriodValue: 7,
      timePeriodUnit: 'days',
    };

    const payload = buildTriggerPayload(form);
    const settings = payload.steps.settings;

    expect(settings.applyFrequency).toBe('multiply-period');
    expect(settings.timePeriod).toBe(7 * 24 * 60); // 7 days in minutes
    expect(settings.typeMultiply).toBe('days');
  });

  it('omits conditional when no conditions (AJV minItems:1 compliance)', () => {
    const payload = buildTriggerPayload(baseForm);
    expect(payload.steps.settings).not.toHaveProperty('conditional');
  });

  it('omits conditional when passed empty array', () => {
    const payload = buildTriggerPayload(baseForm, []);
    expect(payload.steps.settings).not.toHaveProperty('conditional');
  });

  it('includes conditional when non-empty', () => {
    const conditions = [
      {
        type: 'tag',
        tag_id: [1],
        conditional_tag: 'in',
        tag_info: [{ id: 1, name: 'VIP', type: 'tag' }],
      },
    ];
    const payload = buildTriggerPayload(baseForm, conditions);
    expect(payload.steps.settings.conditional).toEqual(conditions);
  });

  it('sets scheduleTo and status correctly', () => {
    const payload = buildTriggerPayload(baseForm);

    expect(payload.scheduleTo).toBeDefined();
    expect(payload.status).toBe(1); // Scheduled
  });
});
