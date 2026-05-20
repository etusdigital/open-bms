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

  it('truncates a full ISO string (with Z) to datetime-local format', () => {
    expect(isoToDatetimeLocal('2026-06-01T15:00:00.000Z')).toBe('2026-06-01T15:00');
  });

  it('is idempotent on an already-truncated datetime-local string', () => {
    expect(isoToDatetimeLocal('2026-06-01T15:00')).toBe('2026-06-01T15:00');
  });

  it('returns empty string for an unparseable value', () => {
    expect(isoToDatetimeLocal('not-a-date')).toBe('');
  });
});
