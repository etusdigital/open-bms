import { isAxiosError } from 'axios';
import { extractApiErrorMessage } from '@/lib/api-error';

export type ProviderErrorKind =
  | 'rate-limited'
  | 'ses-sandbox'
  | 'mandrill-invalid-key'
  | 'network'
  | 'unknown';

/**
 * Translate a provider error (axios or unknown) into a single PT-BR string suitable for
 * `toast.error(...)`. Order of checks matters — more specific kinds win over generic ones.
 */
export function mapProviderError(error: unknown, providerLabel: string): string {
  if (isRateLimited(error)) {
    return 'Muitas tentativas. Aguarde 1 minuto antes de tentar novamente.';
  }
  if (isSesSandbox(error)) {
    return `${providerLabel} está em sandbox ou pausado. Solicite production access no AWS Support.`;
  }
  if (isMandrillInvalidKey(error, providerLabel)) {
    return 'Credenciais Mandrill inválidas. Mandrill retorna HTTP 500 para api keys erradas.';
  }
  if (isNetworkError(error)) {
    return `Não foi possível conectar ao ${providerLabel}. Verifique sua rede.`;
  }
  return extractApiErrorMessage(error) ?? `Erro ao comunicar com ${providerLabel}.`;
}

/** Exposed for tests / callers that need the kind without the rendered message. */
export function classifyProviderError(error: unknown, providerLabel: string): ProviderErrorKind {
  if (isRateLimited(error)) return 'rate-limited';
  if (isSesSandbox(error)) return 'ses-sandbox';
  if (isMandrillInvalidKey(error, providerLabel)) return 'mandrill-invalid-key';
  if (isNetworkError(error)) return 'network';
  return 'unknown';
}

function isRateLimited(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 429;
}

function isSesSandbox(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const data = error.response?.data as { sendingEnabled?: unknown; message?: unknown } | undefined;
  if (data && data.sendingEnabled === false) return true;
  const message = typeof data?.message === 'string' ? data.message.toLowerCase() : '';
  return message.includes('sandbox');
}

function isMandrillInvalidKey(error: unknown, providerLabel: string): boolean {
  if (!isAxiosError(error)) return false;
  if (error.response?.status !== 500) return false;
  return providerLabel.toLowerCase().includes('mandrill');
}

function isNetworkError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  return !error.response && error.code === 'ERR_NETWORK';
}
