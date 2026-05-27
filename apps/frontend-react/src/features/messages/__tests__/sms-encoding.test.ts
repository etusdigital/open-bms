import { describe, it, expect } from 'vitest';
import { isGsm7, isGsm7Extended, isGsm7Only, calculateSmsSegments } from '../utils/sms-encoding';

describe('isGsm7', () => {
  it('returns true for basic GSM-7 characters', () => {
    expect(isGsm7('A')).toBe(true);
    expect(isGsm7('z')).toBe(true);
    expect(isGsm7('0')).toBe(true);
    expect(isGsm7(' ')).toBe(true);
    expect(isGsm7('@')).toBe(true);
    expect(isGsm7('$')).toBe(true);
  });

  it('returns false for extended GSM-7 characters', () => {
    expect(isGsm7('{')).toBe(false);
    expect(isGsm7('}')).toBe(false);
    expect(isGsm7('€')).toBe(false);
  });

  it('returns false for unicode characters', () => {
    expect(isGsm7('😀')).toBe(false);
    expect(isGsm7('中')).toBe(false);
    expect(isGsm7('ã')).toBe(false);
  });
});

describe('isGsm7Extended', () => {
  it('returns true for extended GSM-7 characters', () => {
    expect(isGsm7Extended('^')).toBe(true);
    expect(isGsm7Extended('{')).toBe(true);
    expect(isGsm7Extended('}')).toBe(true);
    expect(isGsm7Extended('\\')).toBe(true);
    expect(isGsm7Extended('[')).toBe(true);
    expect(isGsm7Extended('~')).toBe(true);
    expect(isGsm7Extended(']')).toBe(true);
    expect(isGsm7Extended('|')).toBe(true);
    expect(isGsm7Extended('€')).toBe(true);
  });

  it('returns false for basic GSM-7 characters', () => {
    expect(isGsm7Extended('A')).toBe(false);
    expect(isGsm7Extended(' ')).toBe(false);
  });
});

describe('isGsm7Only', () => {
  it('returns true for a basic GSM-7 string', () => {
    expect(isGsm7Only('Hello World! 123')).toBe(true);
  });

  it('returns true for string with extended chars', () => {
    expect(isGsm7Only('Price: 10€')).toBe(true);
  });

  it('returns false when string has unicode', () => {
    expect(isGsm7Only('Hello 😀')).toBe(false);
  });

  it('returns false for Portuguese accented chars not in GSM-7', () => {
    expect(isGsm7Only('ã')).toBe(false);
    expect(isGsm7Only('õ')).toBe(false);
  });

  it('returns true for empty string', () => {
    expect(isGsm7Only('')).toBe(true);
  });
});

describe('calculateSmsSegments', () => {
  it('returns 0 segments for empty string', () => {
    const result = calculateSmsSegments('');
    expect(result).toEqual({
      chars: 0,
      limit: 160,
      segments: 0,
      encoding: 'gsm7',
      charsInCurrentSegment: 0,
    });
  });

  it('returns 1 segment for short GSM-7 message', () => {
    const result = calculateSmsSegments('Hello World');
    expect(result.encoding).toBe('gsm7');
    expect(result.segments).toBe(1);
    expect(result.chars).toBe(11);
    expect(result.limit).toBe(160);
  });

  it('returns 1 segment for exactly 160 GSM-7 chars', () => {
    const text = 'A'.repeat(160);
    const result = calculateSmsSegments(text);
    expect(result.segments).toBe(1);
    expect(result.limit).toBe(160);
  });

  it('returns 2 segments for 161 GSM-7 chars (limit drops to 153)', () => {
    const text = 'A'.repeat(161);
    const result = calculateSmsSegments(text);
    expect(result.segments).toBe(2);
    expect(result.limit).toBe(153);
  });

  it('counts extended GSM-7 chars as 2 septets', () => {
    // 158 basic chars + 1 extended char (€) = 160 septets = 1 segment
    const text = 'A'.repeat(158) + '€';
    const result = calculateSmsSegments(text);
    expect(result.chars).toBe(160); // 158 + 2 septets
    expect(result.segments).toBe(1);
  });

  it('forces unicode when non-GSM-7 char is present', () => {
    const result = calculateSmsSegments('Hello 😀');
    expect(result.encoding).toBe('unicode');
    expect(result.limit).toBe(70);
    expect(result.segments).toBe(1);
  });

  it('uses 70 char limit for single unicode SMS', () => {
    const text = 'ã'.repeat(70);
    const result = calculateSmsSegments(text);
    expect(result.encoding).toBe('unicode');
    expect(result.segments).toBe(1);
    expect(result.limit).toBe(70);
  });

  it('uses 67 char limit for multi-part unicode SMS', () => {
    const text = 'ã'.repeat(71);
    const result = calculateSmsSegments(text);
    expect(result.encoding).toBe('unicode');
    expect(result.segments).toBe(2);
    expect(result.limit).toBe(67);
  });

  it('counts emoji surrogate pairs as 2 code units in unicode mode', () => {
    // 6 x 😀 = 12 UTF-16 code units (each emoji is a surrogate pair)
    const text = '😀'.repeat(6);
    const result = calculateSmsSegments(text);
    expect(result.encoding).toBe('unicode');
    expect(result.chars).toBe(12);
    expect(result.limit).toBe(70);
    expect(result.segments).toBe(1);
    expect(result.charsInCurrentSegment).toBe(12);
  });

  it('fits exactly 35 surrogate-pair emojis in 1 segment', () => {
    const text = '😀'.repeat(35);
    const result = calculateSmsSegments(text);
    expect(result.chars).toBe(70);
    expect(result.segments).toBe(1);
    expect(result.charsInCurrentSegment).toBe(70);
  });

  it('splits 36 surrogate-pair emojis into 2 segments', () => {
    const text = '😀'.repeat(36);
    const result = calculateSmsSegments(text);
    expect(result.chars).toBe(72);
    expect(result.limit).toBe(67);
    expect(result.segments).toBe(2);
    expect(result.charsInCurrentSegment).toBe(5);
  });

  it('returns charsInCurrentSegment for empty string', () => {
    const result = calculateSmsSegments('');
    expect(result.charsInCurrentSegment).toBe(0);
  });

  it('returns charsInCurrentSegment for single-segment GSM-7', () => {
    const result = calculateSmsSegments('Hello');
    expect(result.charsInCurrentSegment).toBe(5);
  });

  it('returns charsInCurrentSegment for multi-segment GSM-7', () => {
    const text = 'A'.repeat(161);
    const result = calculateSmsSegments(text);
    expect(result.charsInCurrentSegment).toBe(8); // 161 - 153
  });

  it('returns charsInCurrentSegment for multi-segment unicode', () => {
    const text = 'ã'.repeat(71);
    const result = calculateSmsSegments(text);
    expect(result.charsInCurrentSegment).toBe(4); // 71 - 67
  });

  it('handles null/undefined gracefully', () => {
    const result = calculateSmsSegments(null as unknown as string);
    expect(result.segments).toBe(0);
  });

  it('calculates correct segments for a long GSM-7 message', () => {
    // 306 chars / 153 per segment = 2 segments
    const text = 'A'.repeat(306);
    const result = calculateSmsSegments(text);
    expect(result.segments).toBe(2);
    expect(result.limit).toBe(153);
  });

  it('calculates 3 segments for 307 GSM-7 chars', () => {
    const text = 'A'.repeat(307);
    const result = calculateSmsSegments(text);
    expect(result.segments).toBe(3);
  });
});
