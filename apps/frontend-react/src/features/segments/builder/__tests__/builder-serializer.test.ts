// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseSteps, serializeSteps } from '../builder-serializer';
import type { BuilderCard, InteractionStepData } from '../types';

describe('builder-serializer', () => {
  describe('parseSteps', () => {
    it('parses empty JSON array', () => {
      const cards = parseSteps('[]');
      expect(cards).toEqual([]);
    });

    it('parses empty string as empty', () => {
      const cards = parseSteps('');
      expect(cards).toEqual([]);
    });

    it('parses single card with one interaction step', () => {
      const json = JSON.stringify([
        [
          {
            type: 'interation',
            event_type: 'email',
            event: 'open',
            conditional_interation: 'yes',
            message: 'any',
            conditional_times_value: '>=',
            custom_times_value: 1,
            time: 7,
          },
        ],
      ]);

      const cards = parseSteps(json);
      expect(cards).toHaveLength(1);
      expect(cards[0].steps).toHaveLength(1);
      expect(cards[0].cardConnector).toBeUndefined();

      const step = cards[0].steps[0] as InteractionStepData;
      expect(step.type).toBe('interation');
      expect(step.event_type).toBe('email');
      expect(step.time).toBe(7);
      expect(step.id).toBeTruthy(); // gets a UUID assigned
    });

    it('parses inter-card conditionalCard entries as cardConnector', () => {
      const json = JSON.stringify([
        [{ type: 'interation', event_type: 'email' }],
        [
          { type: 'conditionalCard', value: 'UNION' },
          { type: 'interation', event_type: 'sms' },
        ],
      ]);

      const cards = parseSteps(json);
      expect(cards).toHaveLength(2);
      expect(cards[0].cardConnector).toBeUndefined();
      expect(cards[1].cardConnector).toBe('UNION');
      // conditionalCard should NOT be in the steps array
      expect(cards[1].steps).toHaveLength(1);
      expect(cards[1].steps[0].type).toBe('interation');
    });

    it('parses intra-step conditional as stepConnector', () => {
      const json = JSON.stringify([
        [
          { type: 'interation', event_type: 'email' },
          { type: 'tag', conditional: 'or', conditional_tag: 'in', tag_id: [1] },
        ],
      ]);

      const cards = parseSteps(json);
      expect(cards[0].steps).toHaveLength(2);
      expect(cards[0].steps[0].stepConnector).toBeUndefined();
      expect(cards[0].steps[1].stepConnector).toBe('or');
    });

    it('preserves unknown step types as UnsupportedStepData', () => {
      const json = JSON.stringify([[{ type: 'some_future_type', foo: 'bar' }]]);

      const cards = parseSteps(json);
      expect(cards[0].steps).toHaveLength(1);
      expect(cards[0].steps[0].type).toBe('unknown');
      if (cards[0].steps[0].type === 'unknown') {
        expect(cards[0].steps[0].originalType).toBe('some_future_type');
        expect(cards[0].steps[0].raw).toHaveProperty('foo', 'bar');
      }
    });

    it('parses lead step type as known', () => {
      const json = JSON.stringify([
        [
          {
            type: 'lead',
            lead_field_key: 'status',
            lead_field_value: 'new',
            conditional_lead_field: '=',
          },
        ],
      ]);

      const cards = parseSteps(json);
      expect(cards[0].steps).toHaveLength(1);
      expect(cards[0].steps[0].type).toBe('lead');
      expect((cards[0].steps[0] as any).lead_field_key).toBe('status');
    });

    it('parses time value 0 as number 0 (not null)', () => {
      const json = JSON.stringify([[{ type: 'interation', event_type: 'email', time: 0 }]]);

      const cards = parseSteps(json);
      const step = cards[0].steps[0] as InteractionStepData;
      expect(step.time).toBe(0);
    });

    it('parses string time "0" as number 0', () => {
      const json = JSON.stringify([[{ type: 'interation', event_type: 'email', time: '0' }]]);

      const cards = parseSteps(json);
      const step = cards[0].steps[0] as InteractionStepData;
      expect(step.time).toBe(0);
    });

    it('preserves string time values like "all" and "custom"', () => {
      const json = JSON.stringify([[{ type: 'interation', event_type: 'email', time: 'all' }]]);

      const cards = parseSteps(json);
      const step = cards[0].steps[0] as InteractionStepData;
      expect(step.time).toBe('all');
    });

    // ─── Interaction action/period normalization ───────────────────────

    it('converts DB field event to action key using conditional_interation (negation)', () => {
      const json = JSON.stringify([
        [
          {
            type: 'interation',
            event_type: 'email',
            event: 'last_open_date',
            conditional_interation: 'not',
            time: 10,
            message: 'any',
          },
        ],
      ]);

      const cards = parseSteps(json);
      const step = cards[0].steps[0] as InteractionStepData;
      // "last_open_date" + "not" → "noopen"
      expect(step.event).toBe('noopen');
    });

    it('converts DB field event to action key using conditional_interation (positive)', () => {
      const json = JSON.stringify([
        [
          {
            type: 'interation',
            event_type: 'email',
            event: 'last_open_date',
            conditional_interation: 'yes',
            time: 30,
            message: 'any',
          },
        ],
      ]);

      const cards = parseSteps(json);
      const step = cards[0].steps[0] as InteractionStepData;
      // "last_open_date" + "yes" → "open"
      expect(step.event).toBe('open');
    });

    it('converts DB field event for SMS channel', () => {
      const json = JSON.stringify([
        [
          {
            type: 'interation',
            event_type: 'sms',
            event: 'sms_last_delivered',
            conditional_interation: 'yes',
          },
        ],
      ]);

      const cards = parseSteps(json);
      const step = cards[0].steps[0] as InteractionStepData;
      expect(step.event).toBe('delivered');
    });

    it('leaves event unchanged if already an action key', () => {
      const json = JSON.stringify([
        [{ type: 'interation', event_type: 'email', event: 'open', conditional_interation: 'yes' }],
      ]);

      const cards = parseSteps(json);
      const step = cards[0].steps[0] as InteractionStepData;
      expect(step.event).toBe('open');
    });

    it('converts non-preset numeric time to custom period', () => {
      const json = JSON.stringify([
        [
          {
            type: 'interation',
            event_type: 'email',
            event: 'last_open_date',
            conditional_interation: 'not',
            time: 10,
          },
        ],
      ]);

      const cards = parseSteps(json);
      const step = cards[0].steps[0] as InteractionStepData;
      expect(step.time).toBe('custom');
      expect(step.time_custom).toBe(10);
    });

    it('keeps preset numeric time values as-is (0, 1, 7, 15)', () => {
      const json = JSON.stringify([[{ type: 'interation', event_type: 'email', time: 7 }]]);

      const cards = parseSteps(json);
      const step = cards[0].steps[0] as InteractionStepData;
      expect(step.time).toBe(7);
      expect(step.time_custom).toBeUndefined();
    });

    it('parses real API data for segment 694 correctly', () => {
      const json =
        '[[{"type":"tag","conditional_tag":"in","tag_id":[175],"tag_info":[{"id":175,"name":"newsletter-cartao-de-credito"}]},{"type":"user_field","conditional":"and","conditional_user_field":"=","user_field_key":"email_provider","user_field_value":"Gmail"},{"type":"interation","conditional":"and","conditional_interation":"not","event":"last_open_date","time":10,"event_type":"email","message":"any","custom_times_value":1}],[{"type":"conditionalCard","value":"INTERSECT"},{"type":"tag","conditional_tag":"in","tag_id":[175],"tag_info":[{"id":175,"name":"newsletter-cartao-de-credito"}]},{"type":"user_field","conditional":"and","conditional_user_field":"=","user_field_key":"email_provider","user_field_value":"Gmail"},{"type":"interation","conditional":"and","conditional_interation":"yes","event":"last_open_date","time":30,"event_type":"email","message":"any","custom_times_value":1,"conditional_times_value":">="}]]';

      const cards = parseSteps(json);
      expect(cards).toHaveLength(2);

      // First card, third step: interation with negation
      const step1 = cards[0].steps[2] as InteractionStepData;
      expect(step1.type).toBe('interation');
      expect(step1.event).toBe('noopen'); // was "last_open_date" + "not"
      expect(step1.time).toBe('custom'); // was 10 (non-preset)
      expect(step1.time_custom).toBe(10);

      // Second card, third step: interation positive
      const step2 = cards[1].steps[2] as InteractionStepData;
      expect(step2.type).toBe('interation');
      expect(step2.event).toBe('open'); // was "last_open_date" + "yes"
      expect(step2.time).toBe('custom'); // was 30 (non-preset)
      expect(step2.time_custom).toBe(30);
    });
    it('parses segment 600 — positive open with preset time 15', () => {
      const json =
        '[[{"type":"user_field","conditional_user_field":"=","user_field_key":"email_provider","user_field_value":"Microsoft"},{"type":"interation","conditional":"and","conditional_interation":"yes","event":"last_open_date","time":15}]]';

      const cards = parseSteps(json);
      const step = cards[0].steps[1] as InteractionStepData;
      expect(step.type).toBe('interation');
      expect(step.event).toBe('open'); // DB field "last_open_date" + "yes" → "open"
      expect(step.conditional_interation).toBe('yes');
      expect(step.time).toBe(15); // preset, stays as number
    });
  });

  describe('serializeSteps', () => {
    it('serializes empty cards to empty array', () => {
      const result = serializeSteps([]);
      expect(result).toEqual([]);
    });

    it('serializes a single card without cardConnector', () => {
      const cards: BuilderCard[] = [
        {
          id: 'card-1',
          steps: [
            {
              id: 'step-1',
              type: 'interation',
              event_type: 'email',
              time: 7,
            },
          ],
        },
      ];

      const result = serializeSteps(cards);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].type).toBe('interation');
      expect(result[0][0].event_type).toBe('email');
      // Should NOT have id or stepConnector in output
      expect(result[0][0]).not.toHaveProperty('id');
      expect(result[0][0]).not.toHaveProperty('stepConnector');
      expect(result[0][0]).not.toHaveProperty('cardConnector');
    });

    it('serializes cardConnector as conditionalCard entry', () => {
      const cards: BuilderCard[] = [
        { id: 'card-1', steps: [{ id: 's1', type: 'interation', event_type: 'email' }] },
        {
          id: 'card-2',
          cardConnector: 'UNION',
          steps: [{ id: 's2', type: 'interation', event_type: 'sms' }],
        },
      ];

      const result = serializeSteps(cards);
      expect(result).toHaveLength(2);
      // Second card should start with conditionalCard
      expect(result[1][0]).toEqual({ type: 'conditionalCard', value: 'UNION' });
      expect(result[1][1].type).toBe('interation');
    });

    it('serializes stepConnector as conditional field', () => {
      const cards: BuilderCard[] = [
        {
          id: 'card-1',
          steps: [
            { id: 's1', type: 'interation', event_type: 'email' },
            { id: 's2', type: 'tag', stepConnector: 'or', conditional_tag: 'in' },
          ],
        },
      ];

      const result = serializeSteps(cards);
      expect(result[0]).toHaveLength(2);
      expect(result[0][0]).not.toHaveProperty('conditional');
      expect(result[0][1].conditional).toBe('or');
      expect(result[0][1]).not.toHaveProperty('stepConnector');
    });

    it('converts action key back to DB field on serialize', () => {
      const cards: BuilderCard[] = [
        {
          id: 'card-1',
          steps: [
            {
              id: 's1',
              type: 'interation',
              event_type: 'email',
              event: 'noopen',
              conditional_interation: 'not',
              time: 'custom',
              time_custom: 10,
              message: 'any',
              custom_times_value: 1,
            },
          ],
        },
      ];

      const result = serializeSteps(cards);
      expect(result[0][0].event).toBe('last_open_date'); // action key → DB field
      expect(result[0][0].time).toBe(10); // custom → raw number
      expect(result[0][0]).not.toHaveProperty('time_custom');
    });

    it('converts positive action key back to DB field on serialize', () => {
      const cards: BuilderCard[] = [
        {
          id: 'card-1',
          steps: [
            {
              id: 's1',
              type: 'interation',
              event_type: 'email',
              event: 'click',
              conditional_interation: 'yes',
              time: 7,
            },
          ],
        },
      ];

      const result = serializeSteps(cards);
      expect(result[0][0].event).toBe('last_click_date');
      expect(result[0][0].time).toBe(7); // preset stays as-is
    });

    it('converts SMS action key to SMS DB field', () => {
      const cards: BuilderCard[] = [
        {
          id: 'card-1',
          steps: [
            {
              id: 's1',
              type: 'interation',
              event_type: 'sms',
              event: 'delivered',
              conditional_interation: 'yes',
              time: 15,
            },
          ],
        },
      ];

      const result = serializeSteps(cards);
      expect(result[0][0].event).toBe('sms_last_delivered');
    });

    it('serializes UnsupportedStepData back to original format', () => {
      const cards: BuilderCard[] = [
        {
          id: 'card-1',
          steps: [
            {
              id: 's1',
              type: 'unknown',
              originalType: 'some_future_type',
              raw: { type: 'some_future_type', foo: 'bar' },
            },
          ],
        },
      ];

      const result = serializeSteps(cards);
      expect(result[0][0].type).toBe('some_future_type');
      expect(result[0][0].foo).toBe('bar');
      expect(result[0][0]).not.toHaveProperty('originalType');
      expect(result[0][0]).not.toHaveProperty('raw');
    });
  });

  describe('round-trip', () => {
    it('preserves data through parse → serialize cycle', () => {
      const original = [
        [
          {
            type: 'interation',
            event_type: 'email',
            event: 'open',
            conditional_interation: 'yes',
            message: 'any',
            conditional_times_value: '>=',
            custom_times_value: 1,
            time: 7,
          },
          {
            type: 'tag',
            conditional: 'or',
            conditional_tag: 'in',
            tag_id: [1, 2],
            tag_info: [
              { id: 1, name: 'VIP' },
              { id: 2, name: 'Active' },
            ],
          },
        ],
        [
          { type: 'conditionalCard', value: 'UNION' },
          {
            type: 'custom_field',
            custom_field_id: 5,
            custom_field_name: 'Score',
            custom_field_type: 'number',
            conditional_custom_field: '>=',
            custom_field_value: 100,
          },
        ],
      ];

      const json = JSON.stringify(original);
      const cards = parseSteps(json);
      const reserialized = serializeSteps(cards);

      // Structure should match
      expect(reserialized).toHaveLength(2);
      expect(reserialized[0]).toHaveLength(2);
      expect(reserialized[1]).toHaveLength(2); // conditionalCard + step

      // First card, first step
      expect(reserialized[0][0].type).toBe('interation');
      expect(reserialized[0][0].event_type).toBe('email');
      expect(reserialized[0][0].time).toBe(7);

      // First card, second step (tag with OR connector)
      expect(reserialized[0][1].conditional).toBe('or');
      expect(reserialized[0][1].type).toBe('tag');
      expect(reserialized[0][1].tag_id).toEqual([1, 2]);

      // Second card (UNION connector + custom_field)
      expect(reserialized[1][0]).toEqual({ type: 'conditionalCard', value: 'UNION' });
      expect(reserialized[1][1].type).toBe('custom_field');
      expect(reserialized[1][1].custom_field_value).toBe(100);
    });

    it('preserves unknown step types through round-trip', () => {
      const original = [[{ type: 'lead', lead_source: 'api', utm_source: 'Facebook' }]];

      const json = JSON.stringify(original);
      const cards = parseSteps(json);
      const reserialized = serializeSteps(cards);

      expect(reserialized[0][0].type).toBe('lead');
      expect(reserialized[0][0].lead_source).toBe('api');
      expect(reserialized[0][0].utm_source).toBe('Facebook');
    });
  });
});
