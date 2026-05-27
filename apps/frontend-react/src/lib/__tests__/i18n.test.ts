// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Must reset modules between tests so i18n re-initializes
describe('i18n language persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('defaults to pt-BR when no saved language', async () => {
    const { default: i18n } = await import('../i18n');
    expect(i18n.language).toBe('pt-BR');
  });

  it('restores language from localStorage on init', async () => {
    localStorage.setItem('bms-language', 'en-US');
    const { default: i18n } = await import('../i18n');
    expect(i18n.language).toBe('en-US');
  });

  it('ignores invalid language in localStorage and defaults to pt-BR', async () => {
    localStorage.setItem('bms-language', 'invalid-lang');
    const { default: i18n } = await import('../i18n');
    expect(i18n.language).toBe('pt-BR');
  });

  it('saves language to localStorage when changed', async () => {
    const { default: i18n } = await import('../i18n');
    await i18n.changeLanguage('en-US');
    expect(localStorage.getItem('bms-language')).toBe('en-US');
  });

  it('saveLanguage writes to localStorage', async () => {
    const { saveLanguage } = await import('../i18n');
    saveLanguage('en-US');
    expect(localStorage.getItem('bms-language')).toBe('en-US');
  });

  it('LANGUAGE_STORAGE_KEY is bms-language', async () => {
    const { LANGUAGE_STORAGE_KEY } = await import('../i18n');
    expect(LANGUAGE_STORAGE_KEY).toBe('bms-language');
  });
});
