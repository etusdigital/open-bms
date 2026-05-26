import { describe, it, expect } from 'vitest';
import enUS from '@/locales/en-US.json';
import ptBR from '@/locales/pt-BR.json';
import type { BuilderError } from '@/features/segments/builder/builder-validator';

/**
 * The save handler translates conditional validation errors via
 * `t(\`automations.errors.${error.type}\`)`. If a new BuilderError type is
 * added without a matching locale key, the PT-BR UI silently falls back to
 * the English builder-validator string. This test forces locale coverage at
 * compile-time + runtime: the `Record<BuilderError['type'], true>` map fails
 * to type-check the moment a new union member is added without listing it.
 */
const BUILDER_ERROR_TYPES_MAP: Record<BuilderError['type'], true> = {
  missing_period: true,
  empty_card: true,
};

const ALL_BUILDER_ERROR_TYPES = Object.keys(BUILDER_ERROR_TYPES_MAP) as BuilderError['type'][];

describe('conditional validation error locale coverage', () => {
  it.each(ALL_BUILDER_ERROR_TYPES)('has en-US translation for %s', (errorType) => {
    const messages = (enUS as Record<string, Record<string, Record<string, string>>>).automations?.errors;
    expect(messages?.[errorType], `missing en-US key automations.errors.${errorType}`).toBeTruthy();
  });

  it.each(ALL_BUILDER_ERROR_TYPES)('has pt-BR translation for %s', (errorType) => {
    const messages = (ptBR as Record<string, Record<string, Record<string, string>>>).automations?.errors;
    expect(messages?.[errorType], `missing pt-BR key automations.errors.${errorType}`).toBeTruthy();
  });
});
