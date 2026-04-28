import { describe, it, expect } from 'vitest';
import { toVerifyMethod } from '../types';
import { baseMessageType } from '@/features/messages/types';
import { twoFASettingsSchema, groupNameSchema, validateGroupConfigs } from '../twofa-settings-schema';

describe('toVerifyMethod', () => {
  it('converts channel to uppercase method', () => {
    expect(toVerifyMethod('email')).toBe('EMAIL');
    expect(toVerifyMethod('sms')).toBe('SMS');
    expect(toVerifyMethod('whatsapp')).toBe('WHATSAPP');
  });
});

describe('twoFASettingsSchema', () => {
  it('parses valid settings with array format', () => {
    const input = {
      email: {
        group1: [
          { message: { id: 1, title: 'Msg 1' }, percentage: 60 },
          { message: { id: 2, title: 'Msg 2' }, percentage: 40 },
        ],
      },
      sms: {},
      whatsapp: {},
    };
    const result = twoFASettingsSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email.group1).toHaveLength(2);
      expect(result.data.email.group1[0].percentage).toBe(60);
    }
  });

  it('normalizes legacy single-object format to array with 100%', () => {
    const input = {
      email: {
        legacy: { id: 10, title: 'Legacy Msg' },
      },
      sms: {},
      whatsapp: {},
    };
    const result = twoFASettingsSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email.legacy).toHaveLength(1);
      expect(result.data.email.legacy[0].message.id).toBe(10);
      expect(result.data.email.legacy[0].percentage).toBe(100);
    }
  });

  it('defaults missing channels to empty objects', () => {
    const input = { email: {} };
    const result = twoFASettingsSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sms).toEqual({});
      expect(result.data.whatsapp).toEqual({});
    }
  });

  it('rejects invalid message ref (missing title)', () => {
    const input = {
      email: {
        group1: [{ message: { id: 1 }, percentage: 100 }],
      },
    };
    const result = twoFASettingsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('groupNameSchema', () => {
  it('accepts valid names', () => {
    expect(groupNameSchema.safeParse('group1').success).toBe(true);
    expect(groupNameSchema.safeParse('my-group').success).toBe(true);
    expect(groupNameSchema.safeParse('group_name').success).toBe(true);
    expect(groupNameSchema.safeParse('Group With Spaces').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(groupNameSchema.safeParse('').success).toBe(false);
  });

  it('rejects names with special characters', () => {
    expect(groupNameSchema.safeParse('group@name').success).toBe(false);
    expect(groupNameSchema.safeParse('group!').success).toBe(false);
  });

  it('rejects names starting with special characters', () => {
    expect(groupNameSchema.safeParse('-starts-with-hyphen').success).toBe(false);
    expect(groupNameSchema.safeParse(' starts-with-space').success).toBe(false);
  });
});

describe('baseMessageType', () => {
  it('extracts base type from 2FA types', () => {
    expect(baseMessageType('2FA-email')).toBe('email');
    expect(baseMessageType('2FA-sms')).toBe('sms');
    expect(baseMessageType('2FA-whatsapp')).toBe('whatsapp');
  });

  it('returns regular types unchanged', () => {
    expect(baseMessageType('email')).toBe('email');
    expect(baseMessageType('sms')).toBe('sms');
    expect(baseMessageType('whatsapp')).toBe('whatsapp');
    expect(baseMessageType('web-push')).toBe('web-push');
  });
});

describe('validateGroupConfigs', () => {
  it('returns valid when percentages sum to 100', () => {
    const configs = [
      { message: { id: 1 }, percentage: 60 },
      { message: { id: 2 }, percentage: 40 },
    ];
    const result = validateGroupConfigs(configs);
    expect(result.valid).toBe(true);
    expect(result.total).toBe(100);
  });

  it('returns invalid when sum is not 100', () => {
    const configs = [
      { message: { id: 1 }, percentage: 50 },
      { message: { id: 2 }, percentage: 30 },
    ];
    const result = validateGroupConfigs(configs);
    expect(result.valid).toBe(false);
    expect(result.total).toBe(80);
    expect(result.error).toContain('100%');
  });

  it('returns invalid for empty array', () => {
    const result = validateGroupConfigs([]);
    expect(result.valid).toBe(false);
    expect(result.total).toBe(0);
  });

  it('returns invalid for duplicate message IDs', () => {
    const configs = [
      { message: { id: 1 }, percentage: 50 },
      { message: { id: 1 }, percentage: 50 },
    ];
    const result = validateGroupConfigs(configs);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('once per group');
  });

  it('returns invalid when a slot has zero percentage', () => {
    const configs = [
      { message: { id: 1 }, percentage: 100 },
      { message: { id: 2 }, percentage: 0 },
    ];
    const result = validateGroupConfigs(configs);
    expect(result.valid).toBe(false);
  });
});
