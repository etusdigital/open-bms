// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/lib/i18n';

vi.mock('../../use-settings', () => ({
  useAccountId: () => 42,
  useRefreshAccountConfigs: () => vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../sendgrid-account-gateway', () => ({
  accountSendgridGateway: {
    get: vi.fn(),
    save: vi.fn().mockResolvedValue({ source: 'account', fromDomain: 'mail.acme.com' }),
    test: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SendgridFormModal } from '../sendgrid-form-modal';
import { accountSendgridGateway } from '../sendgrid-account-gateway';

const VALID_KEY = 'SG.' + 'x'.repeat(50);
const save = accountSendgridGateway.save as ReturnType<typeof vi.fn>;
const get = accountSendgridGateway.get as ReturnType<typeof vi.fn>;

function renderModal(mode: 'create' | 'edit' = 'create') {
  return render(<SendgridFormModal open mode={mode} onOpenChange={vi.fn()} onSaved={vi.fn()} />);
}

describe('SendgridFormModal (EVO-1466)', () => {
  beforeEach(() => {
    save.mockClear();
    get.mockReset();
    get.mockResolvedValue({ source: 'account', apiKeyMasked: 'SG.****...zzzz', webhookUrl: null, fromDomain: 'mail.acme.com' });
  });

  it('create: Save is disabled until both API key and a valid domain are filled', () => {
    renderModal('create');
    const saveBtn = screen.getByTestId('sendgrid-save-button');
    expect(saveBtn).toBeDisabled();

    fireEvent.change(screen.getByTestId('sendgrid-api-key-input'), { target: { value: VALID_KEY } });
    expect(saveBtn).toBeDisabled(); // domain still missing

    fireEvent.change(screen.getByTestId('sendgrid-from-domain-input'), { target: { value: 'mail.acme.com' } });
    expect(saveBtn).not.toBeDisabled();
  });

  it('create: an invalid domain keeps Save disabled (client-side validation)', () => {
    renderModal('create');
    fireEvent.change(screen.getByTestId('sendgrid-api-key-input'), { target: { value: VALID_KEY } });
    fireEvent.change(screen.getByTestId('sendgrid-from-domain-input'), { target: { value: 'not a domain' } });
    expect(screen.getByTestId('sendgrid-save-button')).toBeDisabled();
  });

  it('create: submits apiKey + trimmed fromDomain', async () => {
    renderModal('create');
    fireEvent.change(screen.getByTestId('sendgrid-api-key-input'), { target: { value: VALID_KEY } });
    fireEvent.change(screen.getByTestId('sendgrid-from-domain-input'), { target: { value: '  mail.acme.com  ' } });
    fireEvent.click(screen.getByTestId('sendgrid-save-button'));
    await waitFor(() => expect(save).toHaveBeenCalledWith(42, { apiKey: VALID_KEY, fromDomain: 'mail.acme.com' }));
  });

  it('create: shows an inline reason under the domain field when invalid', () => {
    renderModal('create');
    fireEvent.change(screen.getByTestId('sendgrid-from-domain-input'), { target: { value: 'not a domain' } });
    expect(screen.getByTestId('sendgrid-from-domain-error')).toBeInTheDocument();
  });

  it('edit: prefills the current domain and submits a metadata-only update (no apiKey)', async () => {
    renderModal('edit');
    await waitFor(() => expect((screen.getByTestId('sendgrid-from-domain-input') as HTMLInputElement).value).toBe('mail.acme.com'));
    // Save should be enabled with no API key typed (metadata-only edit).
    expect(screen.getByTestId('sendgrid-save-button')).not.toBeDisabled();
    fireEvent.change(screen.getByTestId('sendgrid-from-domain-input'), { target: { value: 'news.acme.com' } });
    fireEvent.click(screen.getByTestId('sendgrid-save-button'));
    await waitFor(() => expect(save).toHaveBeenCalledWith(42, { fromDomain: 'news.acme.com' }));
  });

  it('edit: shows the masked key with NO password input by default (nothing to autofill)', async () => {
    renderModal('edit');
    await waitFor(() => expect(screen.getByTestId('sendgrid-masked-key')).toHaveTextContent('SG.****...zzzz'));
    // No key <input> exists until the user opts to rotate — this is what stops
    // browser/password-manager autofill from blocking save.
    expect(screen.queryByTestId('sendgrid-api-key-input')).not.toBeInTheDocument();
  });

  it('edit: "Trocar chave" reveals the key input and rotating sends apiKey + fromDomain', async () => {
    renderModal('edit');
    await waitFor(() => expect(screen.getByTestId('sendgrid-masked-key')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('sendgrid-change-key'));
    const keyInput = screen.getByTestId('sendgrid-api-key-input');
    fireEvent.change(keyInput, { target: { value: VALID_KEY } });
    fireEvent.click(screen.getByTestId('sendgrid-save-button'));
    await waitFor(() => expect(save).toHaveBeenCalledWith(42, { apiKey: VALID_KEY, fromDomain: 'mail.acme.com' }));
  });
});
