import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { MergeFieldsModal } from '../components/merge-fields-modal';

const mockOnOpenChange = vi.fn();

function renderModal(open = true) {
  return renderWithRouter(<MergeFieldsModal open={open} onOpenChange={mockOnOpenChange} />);
}

describe('MergeFieldsModal', () => {
  it('renders dialog with title when open', async () => {
    await renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Campos de mesclagem' })).toBeInTheDocument();
  });

  it('renders all 5 tabs', async () => {
    await renderModal();
    expect(screen.getByText('Contato')).toBeInTheDocument();
    expect(screen.getByText('Campos Personalizados')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Mensagem')).toBeInTheDocument();
    expect(screen.getByText('Outros')).toBeInTheDocument();
  });

  it('shows contact fields by default', async () => {
    await renderModal();
    expect(screen.getByText('%FIRSTNAME%')).toBeInTheDocument();
    expect(screen.getByText('%EMAIL%')).toBeInTheDocument();
  });

  it('switches to date tab and shows date fields', async () => {
    await renderModal();
    fireEvent.click(screen.getByText('Data'));
    expect(screen.getByText('%DATETODAY%')).toBeInTheDocument();
    expect(screen.getByText('%DATETOMORROW%')).toBeInTheDocument();
  });

  it('switches to message tab and shows message fields', async () => {
    await renderModal();
    fireEvent.click(screen.getByText('Mensagem'));
    expect(screen.getByText('%MESSAGE_ID%')).toBeInTheDocument();
    expect(screen.getByText('%MESSAGE_NAME%')).toBeInTheDocument();
  });

  it('switches to others tab and shows random fields', async () => {
    await renderModal();
    fireEvent.click(screen.getByText('Outros'));
    expect(screen.getByText('%RANDOM4%')).toBeInTheDocument();
    expect(screen.getByText('%RANDOM12%')).toBeInTheDocument();
  });

  it('has copy buttons for each field', async () => {
    await renderModal();
    const copyButtons = screen.getAllByLabelText('Copiar campo');
    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it('does not render when closed', async () => {
    await renderModal(false);
    expect(screen.queryByText('Campos de mesclagem')).not.toBeInTheDocument();
  });
});
