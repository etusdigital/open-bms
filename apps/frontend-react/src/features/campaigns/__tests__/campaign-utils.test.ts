import { describe, it, expect } from 'vitest';
import { replaceSpecialChars, isoToDatetimeLocal } from '../utils';

describe('replaceSpecialChars', () => {
  it('converts accented string to slug', () => {
    expect(replaceSpecialChars('Minha Campanha de Verão')).toBe('minha-campanha-de-verao');
  });

  it('returns empty string for empty input', () => {
    expect(replaceSpecialChars('')).toBe('');
  });

  it('handles multiple spaces and special characters', () => {
    expect(replaceSpecialChars('Hello   World!!!')).toBe('hello-world');
  });

  it('collapses multiple hyphens', () => {
    expect(replaceSpecialChars('a---b')).toBe('a-b');
  });

  it('trims leading/trailing hyphens', () => {
    expect(replaceSpecialChars('--test--')).toBe('test-');
  });

  it('lowercases the result', () => {
    expect(replaceSpecialChars('UPPER CASE')).toBe('upper-case');
  });

  it('handles accented characters (é, ã, ç, etc.)', () => {
    expect(replaceSpecialChars('Promoção Especial')).toBe('promocao-especial');
  });
});

describe('isoToDatetimeLocal', () => {
  it('returns empty string for undefined', () => {
    expect(isoToDatetimeLocal(undefined)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(isoToDatetimeLocal('')).toBe('');
  });

  it('reconstructs a full ISO string (UTC instant) into local datetime-local format', () => {
    // 18:00 UTC is 15:00 in America/Sao_Paulo (the pinned test timezone).
    // A verbatim truncate would wrongly yield "2026-06-01T18:00".
    expect(isoToDatetimeLocal('2026-06-01T18:00:00.000Z')).toBe('2026-06-01T15:00');
  });

  it('produces a value that maps back to the same instant as the ISO', () => {
    const iso = '2026-06-01T18:00:00.000Z';
    const local = isoToDatetimeLocal(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // The naive local string, parsed in the local timezone, is the same instant.
    expect(new Date(local).getTime()).toBe(new Date(iso).getTime());
  });

  it('is idempotent on an already-truncated datetime-local string', () => {
    expect(isoToDatetimeLocal('2026-06-01T15:00')).toBe('2026-06-01T15:00');
  });

  it('returns empty string for an unparseable value', () => {
    expect(isoToDatetimeLocal('not-a-date')).toBe('');
  });
});
