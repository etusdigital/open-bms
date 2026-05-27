// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import i18n, { LANGUAGE_STORAGE_KEY } from '@/lib/i18n';
import { LanguageSwitcher } from '@/features/settings/components/language-switcher';

async function setLanguage(lng: string) {
  await act(async () => {
    await i18n.changeLanguage(lng);
  });
}

beforeEach(async () => {
  localStorage.clear();
  await setLanguage('pt-BR');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await setLanguage('pt-BR');
});

describe('LanguageSwitcher', () => {
  it('renders the three language options with translated labels', async () => {
    render(<LanguageSwitcher />);
    expect(screen.getByTestId('language-option-pt-BR')).toHaveTextContent('Português (Brasil)');
    expect(screen.getByTestId('language-option-en-US')).toHaveTextContent('Inglês (EUA)');
    expect(screen.getByTestId('language-option-es-ES')).toHaveTextContent('Espanhol (Espanha)');
  });

  it('marks the active language with aria-pressed and a check icon', () => {
    render(<LanguageSwitcher />);
    const pt = screen.getByTestId('language-option-pt-BR');
    const en = screen.getByTestId('language-option-en-US');
    expect(pt).toHaveAttribute('aria-pressed', 'true');
    expect(en).toHaveAttribute('aria-pressed', 'false');
    expect(pt.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(en.querySelector('svg[aria-hidden="true"]')).toBeNull();
  });

  it('changes the language when an option is clicked and migrates the check', async () => {
    const spy = vi.spyOn(i18n, 'changeLanguage');
    render(<LanguageSwitcher />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('language-option-en-US'));
    });
    expect(spy).toHaveBeenCalledWith('en-US');
    expect(i18n.language).toBe('en-US');
    const en = screen.getByTestId('language-option-en-US');
    const pt = screen.getByTestId('language-option-pt-BR');
    expect(en).toHaveAttribute('aria-pressed', 'true');
    expect(pt).toHaveAttribute('aria-pressed', 'false');
  });

  it('persists the new language in localStorage', async () => {
    render(<LanguageSwitcher />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('language-option-en-US'));
    });
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en-US');
  });

  it('calls onSelect when provided', async () => {
    const onSelect = vi.fn();
    render(<LanguageSwitcher onSelect={onSelect} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('language-option-es-ES'));
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps the UI functional when localStorage throws (private browsing)', async () => {
    const throwDom = () => {
      throw new DOMException('blocked');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(throwDom);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(throwDom);

    render(<LanguageSwitcher />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('language-option-en-US'));
    });
    expect(i18n.language).toBe('en-US');
    expect(screen.getByTestId('language-option-en-US')).toHaveAttribute('aria-pressed', 'true');
  });
});
