// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RemoveDefaultConfirmDialog } from '../remove-default-confirm-dialog';
import type { ProviderState } from '../use-email-providers';

const ps = (name: string, label: string): ProviderState => ({
  name,
  label,
  configured: true,
  hasFreeTier: true,
  hasWebhook: true,
});

describe('RemoveDefaultConfirmDialog', () => {
  it('renders one radio per configured alternate (excluding the provider being removed)', async () => {
    render(
      <RemoveDefaultConfirmDialog
        open
        providerBeingRemoved="mailersend"
        providerBeingRemovedLabel="MailerSend"
        defaultProvider="mailersend"
        configuredProviders={[ps('mailersend', 'MailerSend'), ps('sparkpost', 'SparkPost'), ps('resend', 'Resend')]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByText('SparkPost')).toBeInTheDocument();
    expect(screen.getByText('Resend')).toBeInTheDocument();
    expect(screen.queryByText('MailerSend', { selector: 'label' })).not.toBeInTheDocument();
  });

  it('shows the blocking message and no confirm action when there are no alternates', async () => {
    render(
      <RemoveDefaultConfirmDialog
        open
        providerBeingRemoved="mailersend"
        providerBeingRemovedLabel="MailerSend"
        defaultProvider="mailersend"
        configuredProviders={[ps('mailersend', 'MailerSend')]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(await screen.findByTestId('remove-default-no-alternates')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Trocar default \+ Remover/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();
  });

  it('clicking "Trocar default + Remover" invokes onConfirm with the selected provider', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <RemoveDefaultConfirmDialog
        open
        providerBeingRemoved="mailersend"
        providerBeingRemovedLabel="MailerSend"
        defaultProvider="mailersend"
        configuredProviders={[ps('mailersend', 'MailerSend'), ps('sparkpost', 'SparkPost')]}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Trocar default \+ Remover/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('sparkpost'));
  });

  it('clicking Cancelar invokes onCancel', async () => {
    const onCancel = vi.fn();
    render(
      <RemoveDefaultConfirmDialog
        open
        providerBeingRemoved="mailersend"
        providerBeingRemovedLabel="MailerSend"
        defaultProvider="mailersend"
        configuredProviders={[ps('mailersend', 'MailerSend'), ps('sparkpost', 'SparkPost')]}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Cancelar/i }));
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
  });

  it('disables both buttons while submitting', async () => {
    render(
      <RemoveDefaultConfirmDialog
        open
        providerBeingRemoved="mailersend"
        providerBeingRemovedLabel="MailerSend"
        defaultProvider="mailersend"
        configuredProviders={[ps('mailersend', 'MailerSend'), ps('sparkpost', 'SparkPost')]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        submitting
      />,
    );
    expect(await screen.findByRole('button', { name: /Aplicando/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeDisabled();
  });
});
