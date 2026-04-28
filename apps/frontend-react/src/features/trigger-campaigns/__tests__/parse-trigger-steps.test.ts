import { describe, it, expect } from 'vitest';
import { parseTriggerSteps } from '../parse-trigger-steps';

describe('parseTriggerSteps', () => {
  it('parses events trigger with single email and immediate send', () => {
    const steps = {
      id: 1,
      type: 'trigger',
      settings: {
        id: 4050,
        name: 'plus teste',
        title: 'plus teste',
        type: 'events',
        eventType: 'open',
        applyFrequency: 'unique',
        timePeriod: 0,
        typeMultiply: '',
        conditional: [],
      },
      child: [
        {
          id: 3,
          type: 'email',
          settings: {
            id: 4050,
            title: 'plus teste',
            subject: 'mensagem teste',
            name: 'plus-teste',
            links: [],
          },
          child: [{ id: 2, type: 'end', settings: {}, child: [] }],
        },
      ],
    };

    const result = parseTriggerSteps(steps);

    expect(result.triggerType).toBe('events');
    expect(result.eventType).toBe('open');
    expect(result.frequency).toBe('unique');
    expect(result.triggerMessageId).toBe(4050);
    expect(result.triggerMessageTitle).toBe('plus teste');
    expect(result.sendTiming).toBe('immediate');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe(4050);
    expect(result.messages[0].title).toBe('plus teste');
  });

  it('parses trigger with wait step wrapping email', () => {
    const steps = {
      id: 1,
      type: 'trigger',
      settings: {
        id: 100,
        type: 'events',
        eventType: 'click',
        applyFrequency: 'multiply',
        timePeriod: 0,
        typeMultiply: '',
        conditional: [],
      },
      child: [
        {
          id: 4,
          type: 'wait',
          settings: { timer: 3, timerType: 'hours' },
          child: [
            {
              id: 3,
              type: 'email',
              settings: {
                id: 100,
                title: 'My Email',
                subject: 'Hello',
                name: 'my-email',
                links: [],
              },
              child: [{ id: 2, type: 'end', settings: {}, child: [] }],
            },
          ],
        },
      ],
    };

    const result = parseTriggerSteps(steps);

    expect(result.sendTiming).toBe('wait');
    expect(result.waitValue).toBe(3);
    expect(result.waitUnit).toBe('hours');
    expect(result.messages).toHaveLength(1);
  });

  it('parses randomMessage step into multiple messages', () => {
    const steps = {
      id: 1,
      type: 'trigger',
      settings: {
        id: 0,
        type: 'events',
        eventType: 'open',
        applyFrequency: 'unique',
        timePeriod: 0,
        typeMultiply: '',
        conditional: [],
      },
      child: [
        {
          id: 3,
          type: 'randomMessage',
          settings: {
            messages: [
              { id: 100, title: 'Msg A', subject: 'Sub A', name: 'msg-a', links: [] },
              { id: 200, title: 'Msg B', subject: 'Sub B', name: 'msg-b', links: [] },
            ],
          },
          child: [{ id: 2, type: 'end', settings: {}, child: [] }],
        },
      ],
    };

    const result = parseTriggerSteps(steps);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].title).toBe('Msg A');
    expect(result.messages[1].title).toBe('Msg B');
  });

  it('parses custom_events trigger', () => {
    const steps = {
      id: 1,
      type: 'trigger',
      settings: {
        id: 42,
        name: 'purchase_completed',
        type: 'custom_events',
        applyFrequency: 'multiply-period',
        timePeriod: 10080, // 7 days in minutes
        typeMultiply: 'days',
        conditional: [],
      },
      child: [
        {
          id: 3,
          type: 'email',
          settings: { id: 500, title: 'Welcome', subject: 'Hello', name: 'welcome', links: [] },
          child: [{ id: 2, type: 'end', settings: {}, child: [] }],
        },
      ],
    };

    const result = parseTriggerSteps(steps);

    expect(result.triggerType).toBe('custom_events');
    expect(result.customEvent).toEqual({ id: 42, name: 'purchase_completed' });
    expect(result.frequency).toBe('multiply-period');
    expect(result.timePeriodValue).toBe(7);
    expect(result.timePeriodUnit).toBe('days');
  });

  it('returns defaults for undefined/null steps', () => {
    const result = parseTriggerSteps(undefined);

    expect(result.triggerType).toBe('events');
    expect(result.sendTiming).toBe('immediate');
    expect(result.messages).toEqual([]);
  });
});
