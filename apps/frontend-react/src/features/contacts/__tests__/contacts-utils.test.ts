import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTz,
  formatDateTimeTz,
  getContactName,
  getStatusInfo,
  getEventTime,
  getEventLabel,
} from '../contacts-utils';
import type { Contact, HistoryItem } from '../types';

const baseContact: Contact = {
  id: 1,
  email: 'john@example.com',
  isActive: true,
};

describe('formatDate', () => {
  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats a valid date string', () => {
    const result = formatDate('2026-01-15T10:00:00Z');
    expect(result).toBeTruthy();
    expect(result).not.toBe('—');
  });
});

describe('formatDateTz', () => {
  it('returns dash for undefined', () => {
    expect(formatDateTz(undefined)).toBe('—');
  });

  it('returns dash for invalid date', () => {
    expect(formatDateTz('not-a-date')).toBe('—');
  });

  it('formats with explicit timezone and locale', () => {
    const result = formatDateTz('2026-03-15T12:00:00Z', {
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
    });
    expect(result).toContain('2026');
    expect(result).toContain('03');
    expect(result).toContain('15');
  });

  it('formats with UTC timezone', () => {
    const result = formatDateTz('2026-01-01T00:00:00Z', {
      timezone: 'UTC',
      locale: 'en-US',
    });
    expect(result).toContain('2026');
    expect(result).toContain('01');
  });
});

describe('formatDateTimeTz', () => {
  it('returns dash for undefined', () => {
    expect(formatDateTimeTz(undefined)).toBe('—');
  });

  it('returns dash for invalid date', () => {
    expect(formatDateTimeTz('invalid')).toBe('—');
  });

  it('includes time in output', () => {
    const result = formatDateTimeTz('2026-03-15T14:30:00Z', {
      timezone: 'UTC',
      locale: 'en-US',
    });
    expect(result).toContain('2026');
    // Should contain time component
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('getContactName', () => {
  it('returns full name when both parts exist', () => {
    expect(getContactName({ ...baseContact, firstName: 'John', lastName: 'Doe' })).toBe('John Doe');
  });

  it('returns first name only when lastName is missing', () => {
    expect(getContactName({ ...baseContact, firstName: 'John' })).toBe('John');
  });

  it('returns last name only when firstName is missing', () => {
    expect(getContactName({ ...baseContact, lastName: 'Doe' })).toBe('Doe');
  });

  it('returns email when no name parts exist', () => {
    expect(getContactName(baseContact)).toBe('john@example.com');
  });

  it('returns email when name parts are empty strings', () => {
    expect(getContactName({ ...baseContact, firstName: '', lastName: '' })).toBe('john@example.com');
  });
});

describe('getStatusInfo', () => {
  it('returns unsubscribed (outline) for unsubscribed contact', () => {
    const result = getStatusInfo({ ...baseContact, isUnsubscribed: true });
    expect(result).toEqual({ label: 'unsubscribed', variant: 'outline' });
  });

  it('returns bounced (destructive) for bounced contact', () => {
    const result = getStatusInfo({ ...baseContact, hasBounced: true });
    expect(result).toEqual({ label: 'bounced', variant: 'destructive' });
  });

  it('returns blocked (outline) for blocked contact', () => {
    const result = getStatusInfo({ ...baseContact, isBlocked: true });
    expect(result).toEqual({ label: 'blocked', variant: 'outline' });
  });

  it('returns active (default) for active contact', () => {
    const result = getStatusInfo({ ...baseContact, isActive: true });
    expect(result).toEqual({ label: 'active', variant: 'default' });
  });

  it('returns inactive (outline) for inactive contact', () => {
    const result = getStatusInfo({ ...baseContact, isActive: false });
    expect(result).toEqual({ label: 'inactive', variant: 'outline' });
  });

  it('prioritizes unsubscribed over active', () => {
    const result = getStatusInfo({ ...baseContact, isActive: true, isUnsubscribed: true });
    expect(result.label).toBe('unsubscribed');
  });

  it('prioritizes bounced over blocked', () => {
    // unsubscribed > bounced > blocked > active > inactive
    const result = getStatusInfo({ ...baseContact, hasBounced: true, isBlocked: true });
    expect(result.label).toBe('bounced');
  });
});

describe('getEventTime', () => {
  it('returns dash when no time fields exist', () => {
    expect(getEventTime({ type: 'automation' } as HistoryItem)).toBe('—');
  });

  it('uses time field first', () => {
    const item = { type: 'message', time: '2026-01-01T12:00:00Z' } as HistoryItem;
    const result = getEventTime(item);
    expect(result).toBeTruthy();
    expect(result).not.toBe('—');
  });

  it('falls back to created_at', () => {
    const item = { type: 'automation', created_at: '2026-01-01T12:00:00Z' } as HistoryItem;
    const result = getEventTime(item);
    expect(result).not.toBe('—');
  });
});

describe('getEventLabel', () => {
  it('returns automation title for automation type', () => {
    const item = { type: 'automation', automation_title: 'Welcome Flow' } as HistoryItem;
    expect(getEventLabel(item)).toBe('Welcome Flow');
  });

  it('returns fallback for automation without title', () => {
    const item = { type: 'automation' } as HistoryItem;
    expect(getEventLabel(item)).toBe('Automation');
  });

  it('returns event label for custom_event type', () => {
    const item = { type: 'custom_event', event_id: 42 } as HistoryItem;
    expect(getEventLabel(item)).toBe('Event #42');
  });

  it('returns message title for message type', () => {
    const item = { type: 'message', message_title: 'Newsletter #5' } as HistoryItem;
    expect(getEventLabel(item)).toBe('Newsletter #5');
  });

  it('returns fallback for message without title', () => {
    const item = { type: 'message' } as HistoryItem;
    expect(getEventLabel(item)).toBe('Message');
  });
});
