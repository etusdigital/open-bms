import { isAxiosError } from 'axios';
import i18n from '@/lib/i18n';
import { extractApiErrorMessage } from '@/lib/api-error';

export type ProviderErrorKind =
  | 'rate-limited'
  | 'ses-sandbox'
  | 'mandrill-invalid-key'
  | 'network'
  | 'unknown';

export function mapProviderError(error: unknown, providerLabel: string): string {
  if (isRateLimited(error)) {
    return i18n.t('settings.emailProviders.errors.rateLimited');
  }
  if (isSesSandbox(error)) {
    return i18n.t('settings.emailProviders.errors.sesSandbox', { provider: providerLabel });
  }
  if (isMandrillInvalidKey(error, providerLabel)) {
    return i18n.t('settings.emailProviders.errors.mandrillInvalidKey');
  }
  if (isNetworkError(error)) {
    return i18n.t('settings.emailProviders.errors.network', { provider: providerLabel });
  }
  return extractApiErrorMessage(error) ?? i18n.t('settings.emailProviders.errors.unknown', { provider: providerLabel });
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
