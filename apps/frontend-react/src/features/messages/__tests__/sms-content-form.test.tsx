import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { FormWrapper } from './form-test-utils';
import { smsFormSchema } from '../message-schema';

// Lazy import to avoid circular dependency issues in tests
const { SmsContentForm } = await import('../components/sms-content-form');

function renderSmsForm(defaultValues?: Record<string, string>) {
  return renderWithRouter(
    <FormWrapper schema={smsFormSchema} defaultValues={{ title: '', description: '', content: '', ...defaultValues }}>
      <SmsContentForm />
    </FormWrapper>,
  );
}

describe('SmsContentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders textarea for SMS content', async () => {
    await renderSmsForm();
    expect(screen.getByPlaceholderText(/digite aqui/i)).toBeInTheDocument();
  });

  it('shows character counter', async () => {
    await renderSmsForm();
    expect(screen.getByText(/0\/160/)).toBeInTheDocument();
  });

  it('updates character counter on input', async () => {
    await renderSmsForm();
    const textarea = screen.getByPlaceholderText(/digite aqui/i);
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    await waitFor(() => {
      expect(screen.getByText(/5\/160/)).toBeInTheDocument();
    });
  });

  it('shows unicode warning for non-GSM7 characters', async () => {
    await renderSmsForm();
    const textarea = screen.getByPlaceholderText(/digite aqui/i);
    fireEvent.change(textarea, { target: { value: 'Olá 😀' } });
    await waitFor(() => {
      expect(screen.getByText(/caracteres especiais|special characters/i)).toBeInTheDocument();
    });
  });

  it('renders SMS preview panel', async () => {
    await renderSmsForm();
    expect(screen.getByText(/pré-visualização/i)).toBeInTheDocument();
  });

  it('renders emoji picker button', async () => {
    await renderSmsForm();
    // The smile icon button should be present
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
