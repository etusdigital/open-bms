// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@/lib/i18n';
import { DateRangePicker } from '../date-range-picker';

// Fixed "now" so preset ranges ("today", "last 7 days", ...) are deterministic.
const FIXED_NOW = new Date(2026, 3, 10, 12, 0, 0); // 2026-04-10 local noon

function openPopover() {
  fireEvent.click(screen.getByTestId('date-range-trigger'));
}

function getPopover() {
  // Radix popover content lands in a portal on the body
  return document.body.querySelector('[role="dialog"]') as HTMLElement;
}

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trigger', () => {
    it('renders the committed range formatted in pt-BR', () => {
      render(<DateRangePicker from="2026-04-01" to="2026-04-05" onChange={vi.fn()} />);
      const trigger = screen.getByTestId('date-range-trigger');
      expect(trigger).toHaveTextContent('01/04/2026 - 05/04/2026');
    });

    it('shows the default placeholder when no range is set', () => {
      render(<DateRangePicker from="" to="" onChange={vi.fn()} />);
      expect(screen.getByTestId('date-range-trigger')).toHaveTextContent('Selecione o período');
    });

    it('respects a custom placeholder', () => {
      render(<DateRangePicker from="" to="" onChange={vi.fn()} placeholder="Escolha um período" />);
      expect(screen.getByTestId('date-range-trigger')).toHaveTextContent('Escolha um período');
    });

    it('parses YYYY-MM-DD as a local date without timezone shift', () => {
      // In negative-offset timezones, naive new Date('2026-04-01') resolves to 2026-03-31.
      // The component must render the intended date regardless of TZ.
      render(<DateRangePicker from="2026-04-01" to="2026-04-01" onChange={vi.fn()} />);
      expect(screen.getByTestId('date-range-trigger')).toHaveTextContent('01/04/2026 - 01/04/2026');
    });
  });

  describe('popover open/close', () => {
    it('opens when the trigger is clicked', () => {
      render(<DateRangePicker from="2026-04-01" to="2026-04-05" onChange={vi.fn()} />);
      expect(getPopover()).toBeNull();
      openPopover();
      expect(getPopover()).not.toBeNull();
    });

    it('closes and reverts draft when Cancel is clicked', () => {
      const onChange = vi.fn();
      render(<DateRangePicker from="2026-04-01" to="2026-04-05" onChange={onChange} />);
      openPopover();
      const popover = getPopover();
      fireEvent.click(within(popover).getByRole('button', { name: 'Cancelar' }));
      expect(getPopover()).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('calendar selection (draft behavior — core bug fix)', () => {
    it('does not fire onChange or close when only one date is selected', () => {
      const onChange = vi.fn();
      render(<DateRangePicker from="2026-04-01" to="2026-04-05" onChange={onChange} />);
      openPopover();
      const popover = getPopover();

      // Click day "15" in the grid — single click sets `from`
      const day15 = within(popover).getByRole('button', { name: /15 de abril de 2026/ });
      fireEvent.click(day15);

      expect(onChange).not.toHaveBeenCalled();
      expect(getPopover()).not.toBeNull();
    });

    it('stays open after selecting both dates (so the user can adjust them)', () => {
      const onChange = vi.fn();
      render(<DateRangePicker from="2026-04-01" to="2026-04-05" onChange={onChange} />);
      openPopover();
      const popover = getPopover();

      fireEvent.click(within(popover).getByRole('button', { name: /15 de abril de 2026/ }));
      fireEvent.click(within(popover).getByRole('button', { name: /20 de abril de 2026/ }));

      // Popover must still be open and no onChange fired yet — user might want to adjust
      expect(getPopover()).not.toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('commits the draft range and closes when Apply is clicked', () => {
      const onChange = vi.fn();
      // Start with no committed range so calendar clicks build a fresh draft
      // without react-day-picker's "click-outside-existing-range" ambiguity.
      render(<DateRangePicker from="" to="" onChange={onChange} />);
      openPopover();
      const popover = getPopover();

      fireEvent.click(within(popover).getByRole('button', { name: /, 3 de abril de 2026/ }));
      fireEvent.click(within(popover).getByRole('button', { name: /, 8 de abril de 2026/ }));
      fireEvent.click(within(popover).getByRole('button', { name: 'Aplicar' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('2026-04-03', '2026-04-08');
      expect(getPopover()).toBeNull();
    });

    it('Apply is disabled when the draft has no start date', () => {
      render(<DateRangePicker from="" to="" onChange={vi.fn()} />);
      openPopover();
      const popover = getPopover();
      const applyBtn = within(popover).getByRole('button', { name: 'Aplicar' });
      expect(applyBtn).toBeDisabled();
    });

    it('resets draft back to committed range when the popover is reopened', () => {
      const onChange = vi.fn();
      render(<DateRangePicker from="2026-04-01" to="2026-04-05" onChange={onChange} />);

      // Open, pick a new range, then cancel
      openPopover();
      let popover = getPopover();
      fireEvent.click(within(popover).getByRole('button', { name: /15 de abril de 2026/ }));
      fireEvent.click(within(popover).getByRole('button', { name: /20 de abril de 2026/ }));
      fireEvent.click(within(popover).getByRole('button', { name: 'Cancelar' }));

      // Reopen and Apply — should commit the original committed range (01 → 05)
      openPopover();
      popover = getPopover();
      fireEvent.click(within(popover).getByRole('button', { name: 'Aplicar' }));

      expect(onChange).toHaveBeenCalledWith('2026-04-01', '2026-04-05');
    });
  });

  describe('presets', () => {
    it('clicking a preset commits immediately and closes', () => {
      const onChange = vi.fn();
      render(<DateRangePicker from="" to="" onChange={onChange} />);
      openPopover();
      const popover = getPopover();

      fireEvent.click(within(popover).getByText('Hoje'));

      expect(onChange).toHaveBeenCalledWith('2026-04-10', '2026-04-10');
      expect(getPopover()).toBeNull();
    });

    it('"Últimos 7 dias" commits a 7-day range ending today', () => {
      const onChange = vi.fn();
      render(<DateRangePicker from="" to="" onChange={onChange} />);
      openPopover();
      fireEvent.click(within(getPopover()).getByText('Últimos 7 dias'));
      expect(onChange).toHaveBeenCalledWith('2026-04-03', '2026-04-10');
    });

    it('"Ontem" commits yesterday as a same-day range', () => {
      const onChange = vi.fn();
      render(<DateRangePicker from="" to="" onChange={onChange} />);
      openPopover();
      fireEvent.click(within(getPopover()).getByText('Ontem'));
      expect(onChange).toHaveBeenCalledWith('2026-04-09', '2026-04-09');
    });

    it('hides the preset sidebar when presets={[]}', () => {
      render(<DateRangePicker from="" to="" onChange={vi.fn()} presets={[]} />);
      openPopover();
      expect(within(getPopover()).queryByText('Hoje')).toBeNull();
    });
  });

  describe('clearable', () => {
    it('does not render the clear X by default', () => {
      render(<DateRangePicker from="2026-04-01" to="2026-04-05" onChange={vi.fn()} />);
      // The X icon is an svg with no accessible name — look for it by tag inside the trigger
      const trigger = screen.getByTestId('date-range-trigger');
      expect(trigger.querySelector('.lucide-x')).toBeNull();
    });

    it('renders a clear X that fires onChange("","") when clearable and range is set', () => {
      const onChange = vi.fn();
      render(<DateRangePicker from="2026-04-01" to="2026-04-05" onChange={onChange} clearable />);
      const trigger = screen.getByTestId('date-range-trigger');
      const xIcon = trigger.querySelector('.lucide-x') as Element;
      expect(xIcon).not.toBeNull();

      fireEvent.click(xIcon);
      expect(onChange).toHaveBeenCalledWith('', '');
    });

    it('does not render the clear X when clearable but no range is set', () => {
      render(<DateRangePicker from="" to="" onChange={vi.fn()} clearable />);
      const trigger = screen.getByTestId('date-range-trigger');
      expect(trigger.querySelector('.lucide-x')).toBeNull();
    });
  });
});
