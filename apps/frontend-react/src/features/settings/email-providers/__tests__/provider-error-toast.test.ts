import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { mapProviderError, classifyProviderError } from '../provider-error-toast';

function buildAxiosError(opts: { status?: number; data?: unknown; code?: string } = {}): AxiosError {
  const err = new AxiosError('axios-fail', opts.code);
  if (opts.status !== undefined) {
    err.response = {
      status: opts.status,
      statusText: '',
      data: opts.data,
      headers: {},
      config: { headers: new AxiosHeaders() } as never,
    };
  }
  return err;
}

describe('mapProviderError', () => {
  it('maps HTTP 429 to the rate-limited message', () => {
    const err = buildAxiosError({ status: 429, data: { message: 'limit' } });
    expect(mapProviderError(err, 'Resend')).toBe('Muitas tentativas. Aguarde 1 minuto antes de tentar novamente.');
    expect(classifyProviderError(err, 'Resend')).toBe('rate-limited');
  });

  it('maps SES sendingEnabled:false to the sandbox message', () => {
    const err = buildAxiosError({ status: 400, data: { sendingEnabled: false } });
    const msg = mapProviderError(err, 'Amazon SES');
    expect(msg).toContain('Amazon SES');
    expect(msg).toContain('sandbox');
    expect(msg).toContain('production access');
    expect(classifyProviderError(err, 'Amazon SES')).toBe('ses-sandbox');
  });

  it('maps response message containing "sandbox" to the sandbox message', () => {
    const err = buildAxiosError({ status: 400, data: { message: 'Account is in SANDBOX mode' } });
    expect(mapProviderError(err, 'Amazon SES')).toContain('sandbox');
  });

  it('maps Mandrill HTTP 500 to the invalid-key message', () => {
    const err = buildAxiosError({ status: 500, data: { message: 'Internal' } });
    expect(mapProviderError(err, 'Mandrill')).toBe(
      'Credenciais Mandrill inválidas. Mandrill retorna HTTP 500 para api keys erradas.',
    );
    expect(classifyProviderError(err, 'Mandrill')).toBe('mandrill-invalid-key');
  });

  it('does NOT map HTTP 500 for non-Mandrill providers as Mandrill-invalid', () => {
    const err = buildAxiosError({ status: 500, data: { message: 'boom' } });
    expect(mapProviderError(err, 'SparkPost')).toBe('boom');
  });

  it('maps ERR_NETWORK to the network message', () => {
    const err = buildAxiosError({ code: 'ERR_NETWORK' });
    expect(mapProviderError(err, 'SparkPost')).toBe('Não foi possível conectar ao SparkPost. Verifique sua rede.');
    expect(classifyProviderError(err, 'SparkPost')).toBe('network');
  });

  it('falls back to extractApiErrorMessage when present', () => {
    const err = buildAxiosError({ status: 400, data: { message: 'Configure as credenciais do MailerSend antes de defini-lo como default.' } });
    expect(mapProviderError(err, 'MailerSend')).toBe(
      'Configure as credenciais do MailerSend antes de defini-lo como default.',
    );
  });

  it('falls back to generic message when no axios error data is present', () => {
    const err = new Error('boom');
    expect(mapProviderError(err, 'Resend')).toBe('Erro ao comunicar com Resend.');
    expect(classifyProviderError(err, 'Resend')).toBe('unknown');
  });

  it('falls back to generic message for non-Error unknown values', () => {
    expect(mapProviderError({ weird: true }, 'SparkPost')).toBe('Erro ao comunicar com SparkPost.');
  });
});
