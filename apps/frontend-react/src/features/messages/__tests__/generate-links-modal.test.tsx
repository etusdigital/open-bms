import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { GenerateLinksModal } from '../components/generate-links-modal';

const mockOnOpenChange = vi.fn();

function renderModal(open = true) {
  return renderWithRouter(<GenerateLinksModal open={open} onOpenChange={mockOnOpenChange} />);
}

describe('GenerateLinksModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders title and initial empty input', async () => {
    await renderModal();
    expect(screen.getByRole('heading', { name: /gerar links/i })).toBeInTheDocument();
    expect(screen.getByTestId('link-input-0')).toBeInTheDocument();
  });

  it('adds a new link input when add button is clicked', async () => {
    await renderModal();
    const addButton = screen.getByText(/adicionar/i);
    fireEvent.click(addButton);

    expect(screen.getByTestId('link-input-0')).toBeInTheDocument();
    expect(screen.getByTestId('link-input-1')).toBeInTheDocument();
  });

  it('removes a link input when delete button is clicked', async () => {
    await renderModal();
    // Add a second input
    fireEvent.click(screen.getByText(/adicionar/i));
    expect(screen.getByTestId('link-input-1')).toBeInTheDocument();

    // Remove it — delete buttons only show when more than 1 link
    const deleteButtons = screen.getAllByLabelText(/excluir/i);
    fireEvent.click(deleteButtons[0]);

    expect(screen.queryByTestId('link-input-1')).not.toBeInTheDocument();
  });

  it('does not show delete button when only one link exists', async () => {
    await renderModal();
    expect(screen.queryByLabelText(/excluir/i)).not.toBeInTheDocument();
  });

  it('copies links as JSON when copy button is clicked', async () => {
    await renderModal();
    const input = screen.getByTestId('link-input-0');
    fireEvent.change(input, { target: { value: 'https://example.com' } });

    const copyButton = screen.getByText(/copiar links/i);
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(['https://example.com']));
    });
  });

  it('shows error toast when copying empty links', async () => {
    await renderModal();
    const copyButton = screen.getByText(/copiar links/i);
    fireEvent.click(copyButton);

    // Clipboard should not be called for empty links
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('shows JSON preview of non-empty links', async () => {
    await renderModal();
    const input = screen.getByTestId('link-input-0');
    fireEvent.change(input, { target: { value: 'https://test.com' } });

    expect(screen.getByText('["https://test.com"]')).toBeInTheDocument();
  });

  it('does not render when closed', async () => {
    await renderModal(false);
    expect(screen.queryByRole('heading', { name: /gerar links/i })).not.toBeInTheDocument();
  });
});
