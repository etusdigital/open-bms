import { describe, it, expect } from 'vitest';
import ptBR from '@/locales/pt-BR.json';
import enUS from '@/locales/en-US.json';
import esES from '@/locales/es-ES.json';

type AnyObject = Record<string, unknown>;

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  const out: string[] = [];
  for (const key of Object.keys(obj as AnyObject)) {
    const next = prefix ? `${prefix}.${key}` : key;
    out.push(...flattenKeys((obj as AnyObject)[key], next));
  }
  return out;
}

const ptKeys = new Set(flattenKeys(ptBR));
const enKeys = new Set(flattenKeys(enUS));
const esKeys = new Set(flattenKeys(esES));

function diff(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const k of a) if (!b.has(k)) out.push(k);
  return out.sort();
}

describe('locales key parity', () => {
  it('en-US has every key in pt-BR', () => {
    const missing = diff(ptKeys, enKeys);
    expect(missing, `missing in en-US:\n${missing.join('\n')}`).toEqual([]);
  });

  it('en-US has no extra keys not in pt-BR', () => {
    const extra = diff(enKeys, ptKeys);
    expect(extra, `extra in en-US:\n${extra.join('\n')}`).toEqual([]);
  });

  it('es-ES has every key in pt-BR', () => {
    const missing = diff(ptKeys, esKeys);
    expect(missing, `missing in es-ES:\n${missing.join('\n')}`).toEqual([]);
  });

  it('es-ES has no extra keys not in pt-BR', () => {
    const extra = diff(esKeys, ptKeys);
    expect(extra, `extra in es-ES:\n${extra.join('\n')}`).toEqual([]);
  });
});
