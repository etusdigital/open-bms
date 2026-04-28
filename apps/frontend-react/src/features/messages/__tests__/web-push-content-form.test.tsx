import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { FormWrapper } from './form-test-utils';
import { webPushFormSchema } from '../message-schema';

const { WebPushContentForm } = await import('../components/web-push-content-form');

function renderForm(defaultValues?: Record<string, unknown>) {
  return renderWithRouter(
    <FormWrapper
      schema={webPushFormSchema}
      defaultValues={{
        title: '',
        description: '',
        subject: '',
        content: '',
        url: '',
        image: '',
        expiryPushEnabled: false,
        expiryPushFilter: 'day',
        ...defaultValues,
      }}
    >
      <WebPushContentForm />
    </FormWrapper>,
  );
}

describe('WebPushContentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders subject field with character counter', async () => {
    await renderForm();
    expect(screen.getByLabelText(/assunto/i)).toBeInTheDocument();
    expect(screen.getByText('0/60')).toBeInTheDocument();
  });

  it('renders content textarea', async () => {
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

  it('renders notification expiration checkbox', async () => {
    await renderForm();
    expect(screen.getByText(/expiração da notificação/i)).toBeInTheDocument();
  });
});
