import { describe, it, expect } from 'vitest';
import { replaceSpecialChars } from '../utils';

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
