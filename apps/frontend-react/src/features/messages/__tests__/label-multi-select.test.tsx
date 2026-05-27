import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { LabelMultiSelect } from '../components/label-multi-select';

vi.mock('../use-messages', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    useLabelsAll: vi.fn().mockReturnValue({
      data: [
        { id: 1, name: 'VIP' },
        { id: 2, name: 'Newsletter' },
        { id: 3, name: 'Promo' },
      ],
      isLoading: false,
    }),
  };
});

// cmdk uses scrollIntoView which isn't available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mockOnChange = vi.fn();

describe('LabelMultiSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders trigger button with placeholder text', async () => {
    await renderWithRouter(<LabelMultiSelect selectedIds={[]} onChange={mockOnChange} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/selecionar labels/i)).toBeInTheDocument();
  });

  it('shows label count when items are selected', async () => {
    await renderWithRouter(<LabelMultiSelect selectedIds={[1, 2]} onChange={mockOnChange} />);
    expect(screen.getByText(/2 labels selecionadas/i)).toBeInTheDocument();
  });

  it('opens popover and shows all labels', async () => {
    await renderWithRouter(<LabelMultiSelect selectedIds={[]} onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getByText('VIP')).toBeInTheDocument();
      expect(screen.getByText('Newsletter')).toBeInTheDocument();
      expect(screen.getByText('Promo')).toBeInTheDocument();
    });
  });

  it('toggles selection when clicking a label', async () => {
    await renderWithRouter(<LabelMultiSelect selectedIds={[]} onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getByText('VIP')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('VIP'));
    expect(mockOnChange).toHaveBeenCalledWith([1]);
  });

  it('removes from selection when clicking already selected label', async () => {
    await renderWithRouter(<LabelMultiSelect selectedIds={[1, 2]} onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('VIP'));
    expect(mockOnChange).toHaveBeenCalledWith([2]);
  });

  it('shows selected labels as badges', async () => {
    await renderWithRouter(<LabelMultiSelect selectedIds={[1, 3]} onChange={mockOnChange} />);
    const badges = screen.getAllByTestId('label-badge');
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent('VIP');
    expect(badges[1]).toHaveTextContent('Promo');
  });

  it('removes label when clicking X on badge', async () => {
    await renderWithRouter(<LabelMultiSelect selectedIds={[1, 2]} onChange={mockOnChange} />);
    const removeButtons = screen.getAllByTestId('label-badge-remove');
    fireEvent.click(removeButtons[0]);
    expect(mockOnChange).toHaveBeenCalledWith([2]);
  });
});
