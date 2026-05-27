import { describe, it, expect } from 'vitest';
import esES from '@/locales/es-ES.json';

const TODO_PREFIX = '__TODO__ ';

function collectPending(obj: unknown, prefix = '', out: string[] = []): string[] {
  if (typeof obj === 'string') {
    if (obj.startsWith(TODO_PREFIX)) out.push(prefix);
    return out;
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${key}` : key;
      collectPending((obj as Record<string, unknown>)[key], next, out);
    }
  }
  return out;
}

describe('es-ES.json placeholder guard', () => {
  it('has no __TODO__ placeholders remaining', () => {
    const pending = collectPending(esES);
    expect(pending, `pending ES translations:\n${pending.join('\n')}`).toEqual([]);
  });
});
