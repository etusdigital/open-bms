/**
 * GSM-7 encoding utilities for SMS segment calculation.
 * Ported from apps/frontend-vue2/src/util/characters.ts
 */

const GSM7_CHARS = new Set([
  '@',
  '£',
  '$',
  '¥',
  'è',
  'é',
  'ù',
  'ì',
  'ò',
  'Ç',
  '\n',
  'Ø',
  'ø',
  '\r',
  'Å',
  'å',
  'Δ',
  '_',
  'Φ',
  'Γ',
  'Λ',
  'Ω',
  'Π',
  'Ψ',
  'Σ',
  'Θ',
  'Ξ',
  'Æ',
  'æ',
  'ß',
  'É',
  ' ',
  '!',
  '"',
  '#',
  '¤',
  '%',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  '-',
  '.',
  '/',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  ':',
  ';',
  '<',
  '=',
  '>',
  '?',
  '¡',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  'Ä',
  'Ö',
  'Ñ',
  'Ü',
  '§',
  '¿',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  'ä',
  'ö',
  'ñ',
  'ü',
  'à',
]);

const GSM7_EXTENDED_CHARS = new Set(['^', '{', '}', '\\', '[', '~', ']', '|', '€']);

/** Check if a character is in the GSM-7 basic charset */
export function isGsm7(char: string): boolean {
  return GSM7_CHARS.has(char);
}

/** Check if a character is in the GSM-7 extended charset (costs 2 septets) */
export function isGsm7Extended(char: string): boolean {
  return GSM7_EXTENDED_CHARS.has(char);
}

/** Check if a full string can be encoded as GSM-7 */
export function isGsm7Only(text: string): boolean {
  return [...text].every((char) => isGsm7(char) || isGsm7Extended(char));
}

export interface SmsSegmentInfo {
  /** Total character count (septets for GSM-7, UTF-16 code units for unicode) */
  chars: number;
  /** Character limit per segment */
  limit: number;
  /** Number of SMS segments */
  segments: number;
  /** Detected encoding */
  encoding: 'gsm7' | 'unicode';
  /** Characters used in the current (last) segment */
  charsInCurrentSegment: number;
}

/**
 * Calculate SMS segment information for a given text.
 *
 * GSM-7: 160 chars single, 153 chars per segment (7-byte UDH header)
 * Unicode: 70 chars single, 67 chars per segment (6-byte UDH header)
 * GSM-7 extended chars count as 2 septets.
 */
export function calculateSmsSegments(text: string): SmsSegmentInfo {
  if (!text || text.length === 0) {
    return { chars: 0, limit: 160, segments: 0, encoding: 'gsm7', charsInCurrentSegment: 0 };
  }

  const useUnicode = !isGsm7Only(text);

  if (useUnicode) {
    // UCS-2: count UTF-16 code units (.length), not visual characters
    // Surrogate pairs (emojis like 😀) cost 2 code units each — this matches what providers charge
    const charCount = text.length;
    const singleLimit = 70;
    const multiLimit = 67;

    if (charCount <= singleLimit) {
      return {
        chars: charCount,
        limit: singleLimit,
        segments: 1,
        encoding: 'unicode',
        charsInCurrentSegment: charCount,
      };
    }

    const segments = Math.ceil(charCount / multiLimit);
    return {
      chars: charCount,
      limit: multiLimit,
      segments,
      encoding: 'unicode',
      charsInCurrentSegment: charCount - multiLimit * (segments - 1),
    };
  }

  // GSM-7: extended chars cost 2 septets
  let septetCount = 0;
  for (const char of [...text]) {
    septetCount += isGsm7Extended(char) ? 2 : 1;
  }

  const singleLimit = 160;
  const multiLimit = 153;

  if (septetCount <= singleLimit) {
    return {
      chars: septetCount,
      limit: singleLimit,
      segments: 1,
      encoding: 'gsm7',
      charsInCurrentSegment: septetCount,
    };
  }

  const segments = Math.ceil(septetCount / multiLimit);
  return {
    chars: septetCount,
    limit: multiLimit,
    segments,
    encoding: 'gsm7',
    charsInCurrentSegment: septetCount - multiLimit * (segments - 1),
  };
}
