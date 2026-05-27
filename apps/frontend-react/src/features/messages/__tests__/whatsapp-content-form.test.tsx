import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { FormWrapper } from './form-test-utils';
import { whatsappFormSchema } from '../message-schema';

const { WhatsAppContentForm } = await import('../components/whatsapp-content-form');

function renderForm(props?: { disabled?: boolean; defaultValues?: Record<string, unknown> }) {
  return renderWithRouter(
    <FormWrapper
      schema={whatsappFormSchema}
      defaultValues={{
        title: '',
        description: '',
        content: '',
        footer: '',
        headerType: 'none',
        headerContent: '',
        whatsappType: 'text',
        callToActionText: '',
        callToActionUrl: '',
        ...props?.defaultValues,
      }}
    >
      <WhatsAppContentForm disabled={props?.disabled} />
    </FormWrapper>,
  );
}

describe('WhatsAppContentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders header type selector', async () => {
    await renderForm();
    expect(screen.getByText(/tipo de cabeçalho/i)).toBeInTheDocument();
  });

  it('renders body text textarea', async () => {
    await renderForm();
    expect(screen.getByLabelText(/texto da mensagem/i)).toBeInTheDocument();
  });

  it('renders footer field', async () => {
    await renderForm();
    expect(screen.getByLabelText(/rodapé/i)).toBeInTheDocument();
  });

  it('renders content type selector', async () => {
    await renderForm();
    expect(screen.getByText(/tipo de conteúdo/i)).toBeInTheDocument();
  });

  it('does not show CTA fields by default (text type)', async () => {
    await renderForm();
    expect(screen.queryByLabelText(/texto do botão/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/url do botão/i)).not.toBeInTheDocument();
  });

  it('shows disabled warning when disabled prop is true', async () => {
    await renderForm({ disabled: true });
    expect(screen.getByText(/formulário está desabilitado|form is disabled/i)).toBeInTheDocument();
  });

  describe('header file upload trash button', () => {
    it('shows file input when header type is image', async () => {
      await renderForm({ defaultValues: { headerType: 'image' } });
      expect(screen.getByText(/escolher arquivo/i)).toBeInTheDocument();
    });

    it('does not show trash button when no file is uploaded', async () => {
      await renderForm({ defaultValues: { headerType: 'image' } });
      expect(screen.queryByLabelText(/remover/i)).not.toBeInTheDocument();
    });

    it('shows trash button when image header has content', async () => {
      await renderForm({
        defaultValues: { headerType: 'image', headerContent: 'data:image/png;base64,abc' },
      });
      expect(screen.getByLabelText(/remover/i)).toBeInTheDocument();
    });

    it('clears header content when trash button is clicked', async () => {
      await renderForm({
        defaultValues: { headerType: 'image', headerContent: 'data:image/png;base64,abc' },
      });
      const trashButton = screen.getByLabelText(/remover/i);
      fireEvent.click(trashButton);
      await waitFor(() => {
        expect(screen.queryByLabelText(/remover/i)).not.toBeInTheDocument();
      });
    });

    it('shows trash button when video header has content', async () => {
      await renderForm({
        defaultValues: { headerType: 'video', headerContent: 'data:video/mp4;base64,abc' },
      });
      expect(screen.getByLabelText(/remover/i)).toBeInTheDocument();
    });
  });
});
