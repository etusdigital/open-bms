import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { ConditionalEmailModal } from '../components/conditional-email-modal';

const mockOnOpenChange = vi.fn();

function renderModal(open = true) {
  return renderWithRouter(<ConditionalEmailModal open={open} onOpenChange={mockOnOpenChange} />);
}

describe('ConditionalEmailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders title and tutorial text when open', async () => {
    await renderModal();
    expect(screen.getByRole('heading', { name: /email condicional/i })).toBeInTheDocument();
    expect(screen.getByText(/tutorial de como adicionar/i)).toBeInTheDocument();
  });

  it('shows the Handlebars conditional example', async () => {
    await renderModal();
    expect(screen.getByText(/\{\{#if customFields\.negativado\}\}/)).toBeInTheDocument();
    expect(screen.getByText(/\{\{else\}\}/)).toBeInTheDocument();
    expect(screen.getByText(/\{\{\/if\}\}/)).toBeInTheDocument();
  });

  it('shows available fields description', async () => {
    await renderModal();
    expect(screen.getByText(/campos disponíveis para utilização/i)).toBeInTheDocument();
    expect(screen.getByText('customFields')).toBeInTheDocument();
    expect(screen.getByText('tags')).toBeInTheDocument();
  });

  it('copies example to clipboard on button click', async () => {
    await renderModal();
    const copyButton = screen.getByLabelText(/copiar exemplo/i);
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('{{#if customFields.negativado}}'),
      );
    });
  });

  it('does not render content when closed', async () => {
    await renderModal(false);
    expect(screen.queryByRole('heading', { name: /email condicional/i })).not.toBeInTheDocument();
  });
});
