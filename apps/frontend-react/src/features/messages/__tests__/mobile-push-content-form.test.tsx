import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { FormWrapper } from './form-test-utils';
import { mobilePushFormSchema } from '../message-schema';

const { MobilePushContentForm } = await import('../components/mobile-push-content-form');

function renderForm(defaultValues?: Record<string, unknown>) {
  return renderWithRouter(
    <FormWrapper
      schema={mobilePushFormSchema}
      defaultValues={{
        title: '',
        description: '',
        subject: '',
        content: '',
        url: '',
        image: '',
        notificationSound: 'default',
        expiryPushEnabled: false,
        expiryPushFilter: 'day',
        ...defaultValues,
      }}
    >
      <MobilePushContentForm />
    </FormWrapper>,
  );
}

describe('MobilePushContentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders subject field with character counter', async () => {
    await renderForm();
    expect(screen.getByLabelText(/assunto/i)).toBeInTheDocument();
    expect(screen.getByText('0/60')).toBeInTheDocument();
  });

  it('renders content field', async () => {
    await renderForm();
    expect(screen.getByLabelText(/conteúdo/i)).toBeInTheDocument();
  });

  it('renders redirect URL field', async () => {
    await renderForm();
    expect(screen.getByLabelText(/url de redirecionamento/i)).toBeInTheDocument();
  });

  it('renders image upload field', async () => {
    await renderForm();
    expect(screen.getByText(/imagem/i)).toBeInTheDocument();
  });

  it('renders notification sound selector', async () => {
    await renderForm();
    expect(screen.getByText(/som da notificação/i)).toBeInTheDocument();
  });

  it('renders notification expiration checkbox', async () => {
    await renderForm();
    expect(screen.getByText(/expiração da notificação/i)).toBeInTheDocument();
  });

  describe('merge field picker', () => {
    it('renders merge field buttons for subject and content', async () => {
      await renderForm();
      const mergeButtons = screen.getAllByLabelText(/campos/i);
      expect(mergeButtons).toHaveLength(2);
    });

    it('opens merge fields modal when subject merge button is clicked', async () => {
      await renderForm();
      const mergeButtons = screen.getAllByLabelText(/campos/i);
      fireEvent.click(mergeButtons[0]);
      expect(screen.getByRole('heading', { name: /campos de mesclagem/i })).toBeInTheDocument();
    });

    it('shows insert buttons instead of copy buttons in modal', async () => {
      await renderForm();
      const mergeButtons = screen.getAllByLabelText(/campos/i);
      fireEvent.click(mergeButtons[0]);
      const insertButtons = screen.getAllByText(/inserir/i);
      expect(insertButtons.length).toBeGreaterThan(0);
    });

    it('inserts merge field tag into subject on click', async () => {
      await renderForm();
      const mergeButtons = screen.getAllByLabelText(/campos/i);
      fireEvent.click(mergeButtons[0]);
      // Click the first insert button (firstName → %FIRSTNAME%)
      const insertButtons = screen.getAllByLabelText(/inserir campo/i);
      fireEvent.click(insertButtons[0]);
      expect(screen.getByLabelText(/assunto/i)).toHaveValue('%FIRSTNAME%');
    });
  });
});
