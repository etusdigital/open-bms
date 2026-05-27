// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ColumnVisibilityDialog } from '../column-visibility-dialog';
import type { ColumnVisibility } from '../use-column-visibility';

const defaultVisibility: ColumnVisibility = {
  lastCountEmail: true,
  lastCountWebPush: true,
  lastCountMobilePush: true,
  lastCountPhone: true,
  lastCountWhatsapp: true,
};

describe('ColumnVisibilityDialog', () => {
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      // Suppress Radix UI DialogContent missing Description warning
      if (typeof args[0] === 'string' && args[0].includes('Missing `Description`')) return;
      originalWarn(...args);
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  it('renders the settings trigger button', () => {
    const onSave = vi.fn();
    render(<ColumnVisibilityDialog visibility={defaultVisibility} onSave={onSave} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('opens dialog when button is clicked', async () => {
    const onSave = vi.fn();
    render(<ColumnVisibilityDialog visibility={defaultVisibility} onSave={onSave} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    // i18n key or translated text
    expect(screen.getByText(/personalização|customization|customizeTitle/i)).toBeInTheDocument();
  });

  it('shows all channel toggles in the dialog', async () => {
    const onSave = vi.fn();
    render(<ColumnVisibilityDialog visibility={defaultVisibility} onSave={onSave} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    // All 5 channel switches should be present
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(5);
  });

  it('reflects current visibility state in toggles', async () => {
    const onSave = vi.fn();
    const visibility: ColumnVisibility = {
      ...defaultVisibility,
      lastCountWebPush: false,
      lastCountPhone: false,
    };

    render(<ColumnVisibilityDialog visibility={visibility} onSave={onSave} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    const switches = screen.getAllByRole('switch');
    // Count checked switches (3 of 5 should be checked)
    const checkedCount = switches.filter((s) => s.getAttribute('data-state') === 'checked').length;
    expect(checkedCount).toBe(3);
  });

  it('calls onSave with updated visibility when Save is clicked', async () => {
    const onSave = vi.fn();
    render(<ColumnVisibilityDialog visibility={defaultVisibility} onSave={onSave} />);

    // Open dialog
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    // Toggle the first switch (E-mail) off
    const switches = screen.getAllByRole('switch');
    await act(async () => {
      fireEvent.click(switches[0]);
    });

    // Click Save
    await act(async () => {
      fireEvent.click(screen.getByText(/salvar|save/i));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedVisibility = onSave.mock.calls[0][0];
    expect(savedVisibility.lastCountEmail).toBe(false);
    // Others should remain true
    expect(savedVisibility.lastCountWebPush).toBe(true);
    expect(savedVisibility.lastCountMobilePush).toBe(true);
    expect(savedVisibility.lastCountPhone).toBe(true);
    expect(savedVisibility.lastCountWhatsapp).toBe(true);
  });

  it('does not call onSave when Cancel is clicked', async () => {
    const onSave = vi.fn();
    render(<ColumnVisibilityDialog visibility={defaultVisibility} onSave={onSave} />);

    // Open dialog
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    // Toggle a switch
    const switches = screen.getAllByRole('switch');
    await act(async () => {
      fireEvent.click(switches[0]);
    });

    // Click Cancel
    await act(async () => {
      fireEvent.click(screen.getByText(/cancelar|cancel/i));
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('resets draft when dialog is reopened', async () => {
    const onSave = vi.fn();
    render(<ColumnVisibilityDialog visibility={defaultVisibility} onSave={onSave} />);

    // Open, toggle, cancel
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    const switches = screen.getAllByRole('switch');
    await act(async () => {
      fireEvent.click(switches[0]);
    }); // turn off E-mail
    await act(async () => {
      fireEvent.click(screen.getByText(/cancelar|cancel/i));
    });

    // Reopen — E-mail should be checked again (reset to prop value)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    const switchesAgain = screen.getAllByRole('switch');
    expect(switchesAgain[0].getAttribute('data-state')).toBe('checked');
  });
});
