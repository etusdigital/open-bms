import { describe, it, expect } from 'vitest';
import { campaignFormSchema, CAMPAIGN_TITLE_MAX, CAMPAIGN_DESCRIPTION_MAX } from '../campaign-schema';

const validBase = {
  title: 'My Campaign',
  type: 'simple' as const,
  messageType: 'email' as const,
};

describe('campaignFormSchema', () => {
  describe('title validation', () => {
    it('accepts valid title', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, title: 'Valid Title' });
      expect(result.success).toBe(true);
    });

    it('rejects empty title', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, title: '' });
      expect(result.success).toBe(false);
    });

    it('rejects title exceeding max length', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        title: 'a'.repeat(CAMPAIGN_TITLE_MAX + 1),
      });
      expect(result.success).toBe(false);
    });

    it('accepts title at max length', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        title: 'a'.repeat(CAMPAIGN_TITLE_MAX),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('description validation', () => {
    it('accepts empty description', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, description: '' });
      expect(result.success).toBe(true);
    });

    it('rejects description exceeding max length', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        description: 'a'.repeat(CAMPAIGN_DESCRIPTION_MAX + 1),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('testabAudiencePercent boundaries', () => {
    it('accepts minimum value (5)', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, testabAudiencePercent: 5 });
      expect(result.success).toBe(true);
    });

    it('accepts maximum value (100)', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, testabAudiencePercent: 100 });
      expect(result.success).toBe(true);
    });

    it('rejects value below minimum (4)', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, testabAudiencePercent: 4 });
      expect(result.success).toBe(false);
    });

    it('rejects value above maximum (101)', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, testabAudiencePercent: 101 });
      expect(result.success).toBe(false);
    });
  });

  describe('testabCriteria enum', () => {
    it('accepts open', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, testabCriteria: 'open' });
      expect(result.success).toBe(true);
    });

    it('accepts click', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, testabCriteria: 'click' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid criteria', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, testabCriteria: 'bounce' });
      expect(result.success).toBe(false);
    });
  });

  describe('recurring campaign requires frequency', () => {
    it('fails when recurring has no frequency', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'recurring',
        recurrenceSettings: { frequency: null },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const freqIssue = result.error.issues.find((i) => i.path.includes('frequency'));
        expect(freqIssue).toBeDefined();
        expect(freqIssue?.message).toBe('campaigns.recurrenceFrequencyRequired');
      }
    });

    it('passes when recurring has frequency', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'recurring',
        recurrenceSettings: { frequency: 1, interval: 1 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('weekly recurring requires weekDays', () => {
    it('fails when weekly has empty weekDays', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'recurring',
        recurrenceSettings: { frequency: 2, weekDays: [], interval: 1 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const weekDaysIssue = result.error.issues.find((i) => i.path.includes('weekDays'));
        expect(weekDaysIssue).toBeDefined();
        expect(weekDaysIssue?.message).toBe('campaigns.weekDaysRequired');
      }
    });

    it('passes when weekly has weekDays', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'recurring',
        recurrenceSettings: { frequency: 2, weekDays: [1, 3, 5], interval: 1 },
      });
      expect(result.success).toBe(true);
    });

    it('does not require weekDays for daily frequency', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'recurring',
        recurrenceSettings: { frequency: 1, weekDays: [], interval: 1 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('testAB/split require at least 2 messages', () => {
    it('fails testAB with 0 valid messages', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'testAB',
        campaignMessage: [{}],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgIssue = result.error.issues.find((i) => i.path.includes('campaignMessage'));
        expect(msgIssue).toBeDefined();
        expect(msgIssue?.message).toBe('campaigns.minTwoMessages');
      }
    });

    it('fails testAB with 1 valid message', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'testAB',
        campaignMessage: [{ id: 1, title: 'A' }, {}],
      });
      expect(result.success).toBe(false);
    });

    it('passes testAB with 2 valid messages', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'testAB',
        campaignMessage: [
          { id: 1, title: 'A' },
          { id: 2, title: 'B' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('fails split with 1 valid message', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'split',
        campaignMessage: [{ id: 1, title: 'A' }],
      });
      expect(result.success).toBe(false);
    });

    it('does not require 2 messages for simple type', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'simple',
        campaignMessage: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('defaults', () => {
    it('defaults spreadSending to 60', () => {
      const result = campaignFormSchema.parse(validBase);
      expect(result.spreadSending).toBe(60);
    });

    it('defaults testabAudiencePercent to 10', () => {
      const result = campaignFormSchema.parse(validBase);
      expect(result.testabAudiencePercent).toBe(10);
    });

    it('defaults testabCriteria to open', () => {
      const result = campaignFormSchema.parse(validBase);
      expect(result.testabCriteria).toBe('open');
    });

    it('defaults testabSentAfterTest to true', () => {
      const result = campaignFormSchema.parse(validBase);
      expect(result.testabSentAfterTest).toBe(true);
    });

    it('defaults isRateLimit to true', () => {
      const result = campaignFormSchema.parse(validBase);
      expect(result.isRateLimit).toBe(true);
    });
  });

  describe('type enum', () => {
    it('accepts type simple', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, type: 'simple' });
      expect(result.success).toBe(true);
    });

    it('accepts type testAB (with 2 messages)', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'testAB',
        campaignMessage: [
          { id: 1, title: 'A' },
          { id: 2, title: 'B' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('accepts type split (with 2 messages)', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'split',
        campaignMessage: [
          { id: 1, title: 'A' },
          { id: 2, title: 'B' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('accepts type recurring (with frequency)', () => {
      const result = campaignFormSchema.safeParse({
        ...validBase,
        type: 'recurring',
        recurrenceSettings: { frequency: 1, interval: 1 },
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid type', () => {
      const result = campaignFormSchema.safeParse({ ...validBase, type: 'trigger' });
      expect(result.success).toBe(false);
    });
  });

  describe('messageType enum', () => {
    for (const mt of ['email', 'sms', 'web-push', 'mobile-push', 'whatsapp'] as const) {
      it(`accepts messageType ${mt}`, () => {
        const result = campaignFormSchema.safeParse({ ...validBase, messageType: mt });
        expect(result.success).toBe(true);
      });
    }
  });
});
