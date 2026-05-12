// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import '@/lib/i18n';
import { ProviderCard } from '../provider-card';

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
    warning: vi.fn(),
  },
}));

vi.mock('../../use-settings', () => ({
  useAccountId: () => 42,
}));

function makeGateway(overrides: Partial<{
  get: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  test: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    get: vi.fn().mockResolvedValue({ source: 'none', apiKeyMasked: null }),
    save: vi.fn().mockResolvedValue({ source: 'account', apiKeyMasked: 'mlsn.***xxx' }),
    remove: vi.fn().mockResolvedValue(undefined),
    test: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

const baseConfig = {
  placeholder: 'mlsn.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  prefix: 'mlsn.',
  minLength: 30,
  helperText: 'helper',
};

function setup(props: Partial<Parameters<typeof ProviderCard>[0]> = {}) {
  const gateway = props.gateway ?? makeGateway();
  const utils = render(
    <ProviderCard
      providerName="mailersend"
      providerLabel="MailerSend"
      apiKeyConfig={baseConfig}
      gateway={gateway as never}
      {...props}
    />,
  );
  return { ...utils, gateway };
}

describe('ProviderCard', () => {
  beforeEach(() => {
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it('renders Not configured state when gateway.get returns source: none', async () => {
    setup();
    await waitFor(() => expect(screen.queryByText(/Não configurado|Not configured/i)).toBeInTheDocument());
  });

  it('renders Configured state with masked key when gateway.get returns source: account', async () => {
    const gateway = makeGateway({
      get: vi.fn().mockResolvedValue({ source: 'account', apiKeyMasked: 'mlsn.***bbb' }),
    });
    setup({ gateway: gateway as never });
    await waitFor(() => expect(screen.getByText('mlsn.***bbb')).toBeInTheDocument());
  });

  it('disables Test button when apiKey lacks the required prefix', async () => {
    setup();
    await waitFor(() => screen.getByPlaceholderText(baseConfig.placeholder));
    const input = screen.getByPlaceholderText(baseConfig.placeholder) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'wrong-prefix-but-30-chars-yyyyyy' } });
    const testButton = screen.getByRole('button', { name: /Testar|Test/i });
    expect(testButton).toBeDisabled();
  });

  it('disables Test button when apiKey is too short', async () => {
    setup();
    await waitFor(() => screen.getByPlaceholderText(baseConfig.placeholder));
    const input = screen.getByPlaceholderText(baseConfig.placeholder) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'mlsn.short' } });
    const testButton = screen.getByRole('button', { name: /Testar|Test/i });
    expect(testButton).toBeDisabled();
  });

  it('calls gateway.test and shows success toast on ok:true', async () => {
    const { gateway } = setup();
    await waitFor(() => screen.getByPlaceholderText(baseConfig.placeholder));
    const input = screen.getByPlaceholderText(baseConfig.placeholder) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'mlsn.aaaaaaaaaaaaaaaaaaaaaaaaaaaabbb' } });
    fireEvent.click(screen.getByRole('button', { name: /Testar|Test/i }));
    await waitFor(() => expect(gateway.test).toHaveBeenCalledWith(42, 'mlsn.aaaaaaaaaaaaaaaaaaaaaaaaaaaabbb'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('shows error toast with errorMessage when test returns ok:false', async () => {
    const gateway = makeGateway({ test: vi.fn().mockResolvedValue({ ok: false, errorMessage: 'Bad creds.' }) });
    setup({ gateway: gateway as never });
    await waitFor(() => screen.getByPlaceholderText(baseConfig.placeholder));
    fireEvent.change(screen.getByPlaceholderText(baseConfig.placeholder), {
      target: { value: 'mlsn.aaaaaaaaaaaaaaaaaaaaaaaaaaaabbb' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Testar|Test/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Bad creds.'));
  });

  it('calls gateway.save and onChange on submit', async () => {
    const onChange = vi.fn();
    const { gateway } = setup({ onChange });
    await waitFor(() => screen.getByPlaceholderText(baseConfig.placeholder));
    fireEvent.change(screen.getByPlaceholderText(baseConfig.placeholder), {
      target: { value: 'mlsn.aaaaaaaaaaaaaaaaaaaaaaaaaaaabbb' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar|Save/i }));
    await waitFor(() =>
      expect(gateway.save).toHaveBeenCalledWith(42, { apiKey: 'mlsn.aaaaaaaaaaaaaaaaaaaaaaaaaaaabbb' }),
    );
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('calls gateway.remove when delete button clicked', async () => {
    const gateway = makeGateway({
      get: vi.fn().mockResolvedValue({ source: 'account', apiKeyMasked: 'mlsn.***bbb' }),
    });
    const { gateway: g } = setup({ gateway: gateway as never });
    await waitFor(() => screen.getByText('mlsn.***bbb'));
    fireEvent.click(screen.getByRole('button', { name: /Remover|Remove/i }));
    await waitFor(() => expect(g.remove).toHaveBeenCalledWith(42));
  });

  it('renders banner tooltip trigger with aria-label when banner prop provided', async () => {
    setup({ banner: { variant: 'warning', text: 'Watch out!' } });
    await waitFor(() => {
      const trigger = screen.getByTestId('provider-card-mailersend-banner');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-label', 'Watch out!');
    });
  });

  describe('rate-limit cooldown', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    function buildRateLimitedError(): AxiosError {
      const err = new AxiosError('rate limited');
      err.response = {
        status: 429,
        statusText: 'Too Many Requests',
        data: { message: 'Muitas tentativas' },
        headers: {},
        config: { headers: new AxiosHeaders() } as never,
      };
      return err;
    }

    it('disables the Test button and shows countdown label after a 429 response', async () => {
      const gateway = makeGateway({ test: vi.fn().mockRejectedValue(buildRateLimitedError()) });
      setup({ gateway: gateway as never });
      await waitFor(() => screen.getByPlaceholderText(baseConfig.placeholder));
      fireEvent.change(screen.getByPlaceholderText(baseConfig.placeholder), {
        target: { value: 'mlsn.aaaaaaaaaaaaaaaaaaaaaaaaaaaabbb' },
      });

      fireEvent.click(screen.getByTestId('provider-card-mailersend-test'));

      await waitFor(() => expect(toastError).toHaveBeenCalled());
      const testButton = screen.getByTestId('provider-card-mailersend-test');
      expect(testButton).toBeDisabled();
      expect(testButton).toHaveTextContent(/Aguarde\s+60s/);

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('provider-card-mailersend-test')).toHaveTextContent(/Aguarde\s+59s/);
    });

    it('re-enables the Test button after the cooldown expires', async () => {
      const gateway = makeGateway({ test: vi.fn().mockRejectedValue(buildRateLimitedError()) });
      setup({ gateway: gateway as never });
      await waitFor(() => screen.getByPlaceholderText(baseConfig.placeholder));
      fireEvent.change(screen.getByPlaceholderText(baseConfig.placeholder), {
        target: { value: 'mlsn.aaaaaaaaaaaaaaaaaaaaaaaaaaaabbb' },
      });
      fireEvent.click(screen.getByTestId('provider-card-mailersend-test'));
      await waitFor(() => expect(screen.getByTestId('provider-card-mailersend-test')).toBeDisabled());

      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });

      expect(screen.getByTestId('provider-card-mailersend-test')).not.toBeDisabled();
      expect(screen.getByTestId('provider-card-mailersend-test')).not.toHaveTextContent(/Aguarde/);
    });

    it('does NOT start a cooldown for non-rate-limit errors', async () => {
      const networkErr = new AxiosError('boom', 'ERR_NETWORK');
      const gateway = makeGateway({ test: vi.fn().mockRejectedValue(networkErr) });
      setup({ gateway: gateway as never });
      await waitFor(() => screen.getByPlaceholderText(baseConfig.placeholder));
      fireEvent.change(screen.getByPlaceholderText(baseConfig.placeholder), {
        target: { value: 'mlsn.aaaaaaaaaaaaaaaaaaaaaaaaaaaabbb' },
      });
      fireEvent.click(screen.getByTestId('provider-card-mailersend-test'));

      await waitFor(() => expect(toastError).toHaveBeenCalled());
      const testButton = screen.getByTestId('provider-card-mailersend-test');
      expect(testButton).not.toBeDisabled();
      expect(testButton).not.toHaveTextContent(/Aguarde/);
    });
  });
});
