import axios from 'axios';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AccountConfigsProvider } from '../../providers/account-configs.provider';
import { SendgridHandler } from '../../handlers/email/sendgrid/sendgrid.handler';
import { validateSendgridApiKey } from '../../lib/sendgrid-validator';
import { SaveAccountSendgridDto } from './dtos/sendgrid.dto';
import { SaveAccountMailersendDto } from './dtos/mailersend.dto';
import { SaveAccountSparkpostDto } from './dtos/sparkpost.dto';
import { SaveAccountResendDto } from './dtos/resend.dto';
import { SaveAccountSesDto } from './dtos/ses.dto';
import { SaveAccountMandrillDto } from './dtos/mandrill.dto';
import { SaveAccountTwilioDto } from './dtos/twilio.dto';
import { SaveAccountPushDto } from './dtos/push.dto';
import { maskApiKey } from '../../lib/sendgrid-mask';
import { maskCredential } from '../../lib/geoip-config-file';
import { enforceTestRateLimit } from '../../lib/test-rate-limit';

const SENDGRID_KEY_NAME = 'sendgrid_key';
const SENDGRID_WEBHOOK_NAME = 'sendgrid_webhook_url';
const SENDGRID_FROM_DOMAIN_NAME = 'sendgrid_from_domain';
const MAILERSEND_KEY_NAME = 'mailersend_key';
const SPARKPOST_KEY_NAME = 'sparkpost_key';
const DEFAULT_EMAIL_PROVIDER_NAME = 'default_email_provider';

// docker-compose.yml seeds vendor env vars with the literal value below so the
// SparkPost SDK (constructed eagerly in DI) does not crash on boot in OSS dev.
// Treat the placeholder as absent for legacy-migration purposes — it does not
// represent a real legacy credential that should be migrated per-account.
const SPARKPOST_ENV_PLACEHOLDER = 'dev-placeholder-not-a-real-key';

function isRealSparkpostEnvValue(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  if (trimmed === SPARKPOST_ENV_PLACEHOLDER) return false;
  return true;
}

// Title-case label used in the user-facing PT-BR error when blocking the
// removal of a provider that is currently set as the account default.
const PROVIDER_LABELS: Record<string, string> = {
  sparkpost: 'SparkPost',
  sendgrid: 'SendGrid',
  mailersend: 'MailerSend',
  resend: 'Resend',
  ses: 'Amazon SES',
  mandrill: 'Mandrill',
};
const RESEND_KEY_NAME = 'resend_key';
const SES_ACCESS_KEY_NAME = 'ses_access_key_id';
const SES_SECRET_KEY_NAME = 'ses_secret_access_key';
const SES_REGION_NAME = 'ses_region';
const MANDRILL_KEY_NAME = 'mandrill_key';
// Twilio account_configs slots (read by the twilio-messaging worker + messages.service).
const TWILIO_SID_ACCOUNT_NAME = 'twilio_sid_account';
const TWILIO_SID_NAME = 'twilio_sid';
const TWILIO_SECRET_NAME = 'twilio_secret';
const TWILIO_AUTH_TOKEN_NAME = 'twilio_auth_account';
const TWILIO_SMS_SERVICE_NAME = 'twilio_sms_service';
const TWILIO_WHATSAPP_SERVICE_NAME = 'twilio_whatsapp_service';
// Push: per-account Firebase service account (shared by mobile + web push).
const FIREBASE_SERVICE_ACCOUNT_NAME = 'firebase_service_account_app';
const TEST_RATE_WINDOW_MS = 60_000;
const TEST_RATE_MAX_PER_WINDOW = 5;

// Per-account scheme only: there is no platform-wide fallback. Either the
// account has its own SendGrid key configured, or it doesn't (and outbound
// email is blocked until one is set).
export type SendgridKeySource = 'account' | 'none';

export interface AccountSendgridView {
  source: SendgridKeySource;
  apiKeyMasked: string | null;
  webhookUrl: string | null;
  fromDomain: string | null;
}

export type MailersendKeySource = 'account' | 'none';

export interface AccountMailersendView {
  source: MailersendKeySource;
  apiKeyMasked: string | null;
}

export type SparkpostKeySource = 'account' | 'none';
export interface AccountSparkpostView {
  source: SparkpostKeySource;
  apiKeyMasked: string | null;
}

export type ResendKeySource = 'account' | 'none';
export interface AccountResendView {
  source: ResendKeySource;
  apiKeyMasked: string | null;
}

export type SesCredentialsSource = 'account' | 'none';
export interface AccountSesView {
  source: SesCredentialsSource;
  accessKeyIdMasked: string | null;
  secretAccessKeyMasked: string | null;
  region: string | null;
}

export type MandrillKeySource = 'account' | 'none';
export interface AccountMandrillView {
  source: MandrillKeySource;
  apiKeyMasked: string | null;
}

export type TwilioConfigSource = 'account' | 'none';
export interface AccountTwilioView {
  source: TwilioConfigSource;
  // Account SID and the Messaging Service SIDs are identifiers, not secrets, so
  // they are returned in full — the UI needs them to round-trip on edit/test.
  // Only apiSecret / authToken are write-only (never returned).
  accountSid: string | null;
  apiSid: string | null;
  smsServiceSid: string | null;
  whatsappServiceSid: string | null;
  hasSecret: boolean;
  hasAuthToken: boolean;
  hasSms: boolean;
  hasWhatsapp: boolean;
}

// Push has a platform fallback (env FIREBASE_SERVICE_ACCOUNT), so the source can
// be 'account' (per-account JSON set), 'platform' (no account config but the
// super-admin/platform env credential is present) or 'none'.
export type PushConfigSource = 'account' | 'platform' | 'none';
export interface AccountPushView {
  source: PushConfigSource;
  serviceAccountMasked: string | null;
}

@Injectable()
export class AccountSettingsService {
  private readonly logger = new Logger(AccountSettingsService.name);
  private readonly testHits = new Map<string, number[]>();
  // Bucket separado do sendgrid (mesmo prefix `mailersend:` é compartilhado
  // com admin-mailersend — rate-limit é por IP, não por origem).
  private readonly mailersendTestHits = new Map<string, number[]>();
  private readonly sparkpostTestHits = new Map<string, number[]>();
  private readonly resendTestHits = new Map<string, number[]>();
  private readonly sesTestHits = new Map<string, number[]>();
  private readonly mandrillTestHits = new Map<string, number[]>();
  private readonly twilioTestHits = new Map<string, number[]>();
  private readonly pushTestHits = new Map<string, number[]>();

  constructor(
    private readonly accountConfigs: AccountConfigsProvider,
    private readonly sendgridHandler: SendgridHandler,
  ) {}

  // Symmetric guard to AccountsService.updateAccountConfig cross-field check (EVO-1066):
  // refuse to remove credentials for the provider that is currently set as
  // `default_email_provider`. Without this guard, a direct DELETE via API would
  // leave the account pointing at a provider with no keys, breaking sends until
  // the operator swaps the default by hand. The UI's RemoveDefaultConfirmDialog
  // enforces the same flow on the client side; this is the server-side backstop.
  private async assertNotCurrentDefault(accountId: number, provider: string): Promise<void> {
    const row = await this.accountConfigs.getByAccountId(accountId, DEFAULT_EMAIL_PROVIDER_NAME);
    const currentDefault = row?.value?.trim();
    if (currentDefault && currentDefault === provider) {
      const label = PROVIDER_LABELS[provider] ?? provider;
      throw new HttpException(`${label} é o default desta conta. Troque o default para outro provider antes de remover.`, HttpStatus.BAD_REQUEST);
    }
  }

  // Returns the per-account SendGrid view: whether this account has its
  // own SendGrid key configured (`account` vs `none`), the masked value of
  // that key, and the webhook URL we registered on save. Plaintext never
  // crosses the wire.
  async getSendgrid(accountId: number): Promise<AccountSendgridView> {
    const accountKey = await this.accountConfigs.getByAccountId(accountId, SENDGRID_KEY_NAME);
    if (accountKey?.value) {
      const webhookRow = await this.accountConfigs.getByAccountId(accountId, SENDGRID_WEBHOOK_NAME);
      const fromDomainRow = await this.accountConfigs.getByAccountId(accountId, SENDGRID_FROM_DOMAIN_NAME);
      return {
        source: 'account',
        apiKeyMasked: maskApiKey(accountKey.value),
        webhookUrl: webhookRow?.value ?? null,
        fromDomain: fromDomainRow?.value ?? null,
      };
    }
    return {
      source: 'none',
      apiKeyMasked: null,
      webhookUrl: null,
      fromDomain: null,
    };
  }

  // Persists the per-account API key, registers a SendGrid event webhook
  // pointed at this BMS instance's gateway with `&account=<id>` so the
  // event-process worker can route incoming events to the right tenant,
  // and persists the resulting URL alongside the key. If webhook
  // registration fails the key is NOT saved — a key that can send but not
  // receive events leads to silent analytics gaps.
  async saveSendgrid(accountId: number, dto: SaveAccountSendgridDto): Promise<AccountSendgridView> {
    // Metadata-only edit (EVO-1466): when no apiKey is submitted, the caller is
    // updating just the sender domain on an account that already has a key.
    // Skip webhook (re-)registration entirely — re-PATCHing the SendGrid hook
    // with the same key buys nothing — and persist only `sendgrid_from_domain`.
    if (!dto.apiKey) {
      const existingKey = await this.accountConfigs.getByAccountId(accountId, SENDGRID_KEY_NAME);
      if (!existingKey?.value) {
        throw new HttpException('Informe a API Key SendGrid: não há chave armazenada para esta conta.', HttpStatus.BAD_REQUEST);
      }
      await this.accountConfigs.upsertByAccountId(accountId, SENDGRID_FROM_DOMAIN_NAME, dto.fromDomain);
      const webhookRow = await this.accountConfigs.getByAccountId(accountId, SENDGRID_WEBHOOK_NAME);
      return {
        source: 'account',
        apiKeyMasked: maskApiKey(existingKey.value),
        webhookUrl: webhookRow?.value ?? null,
        fromDomain: dto.fromDomain,
      };
    }

    let registered: { url: string };
    try {
      registered = await this.sendgridHandler.createWebhook({ apiKey: dto.apiKey, accountId });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Falha ao registrar webhook SendGrid para conta ${accountId}`, err as Error);
      throw new HttpException('Erro inesperado ao registrar webhook na SendGrid.', HttpStatus.BAD_GATEWAY);
    }

    await this.accountConfigs.upsertByAccountId(accountId, SENDGRID_KEY_NAME, dto.apiKey);
    await this.accountConfigs.upsertByAccountId(accountId, SENDGRID_WEBHOOK_NAME, registered.url);
    await this.accountConfigs.upsertByAccountId(accountId, SENDGRID_FROM_DOMAIN_NAME, dto.fromDomain);
    this.sendgridHandler.invalidateApiKeyCache(accountId);

    // EVO-1462 AC14: the first configured provider becomes default silently.
    // No-op when a default already exists (subsequent providers don't steal it).
    const currentDefault = await this.accountConfigs.getByAccountId(accountId, DEFAULT_EMAIL_PROVIDER_NAME);
    if (!currentDefault?.value) {
      await this.accountConfigs.upsertByAccountId(accountId, DEFAULT_EMAIL_PROVIDER_NAME, 'sendgrid');
    }

    return {
      source: 'account',
      apiKeyMasked: maskApiKey(dto.apiKey),
      webhookUrl: registered.url,
      fromDomain: dto.fromDomain,
    };
  }

  // Removes the per-account key (and stored webhook URL). The webhook
  // registered on SendGrid stays in their dashboard — leaving it there is
  // harmless and avoids a destructive call when the user just wants to
  // fall back to the global key. After delete, getSendgrid() reports
  // `source: 'global' | 'none'`.
  async deleteSendgrid(accountId: number): Promise<void> {
    await this.assertNotCurrentDefault(accountId, 'sendgrid');
    await this.accountConfigs.deleteByAccountId(accountId, SENDGRID_KEY_NAME);
    await this.accountConfigs.deleteByAccountId(accountId, SENDGRID_WEBHOOK_NAME);
    await this.accountConfigs.deleteByAccountId(accountId, SENDGRID_FROM_DOMAIN_NAME);
    this.sendgridHandler.invalidateApiKeyCache(accountId);
  }

  async testSendgrid(apiKey: string, requesterIp?: string): Promise<{ accountName: string | null }> {
    this.enforceTestRateLimit(requesterIp);
    return validateSendgridApiKey(apiKey);
  }

  private enforceTestRateLimit(requesterIp?: string): void {
    const key = `sendgrid:${requesterIp || 'unknown'}`;
    const now = Date.now();
    const windowStart = now - TEST_RATE_WINDOW_MS;
    const hits = (this.testHits.get(key) || []).filter((t) => t > windowStart);
    if (hits.length >= TEST_RATE_MAX_PER_WINDOW) {
      throw new HttpException('Muitas tentativas de teste SendGrid. Aguarde um minuto e tente novamente.', HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.testHits.set(key, hits);
  }

  async getMailersend(accountId: number): Promise<AccountMailersendView> {
    const row = await this.accountConfigs.getByAccountId(accountId, MAILERSEND_KEY_NAME);
    if (row?.value) {
      return { source: 'account', apiKeyMasked: maskCredential(row.value) ?? null };
    }
    return { source: 'none', apiKeyMasked: null };
  }

  // Persistência simples: per-account guarda só o apiKey. Sem webhook,
  // sem invalidação de cache — o handler de send-email lê
  // account.accountConfigs fresh por mensagem.
  async saveMailersend(accountId: number, dto: SaveAccountMailersendDto): Promise<AccountMailersendView> {
    await this.accountConfigs.upsertByAccountId(accountId, MAILERSEND_KEY_NAME, dto.apiKey);
    return { source: 'account', apiKeyMasked: maskCredential(dto.apiKey) ?? null };
  }

  async deleteMailersend(accountId: number): Promise<void> {
    await this.assertNotCurrentDefault(accountId, 'mailersend');
    await this.accountConfigs.deleteByAccountId(accountId, MAILERSEND_KEY_NAME);
  }

  async testMailersend(apiKey: string, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.mailersendTestHits, `mailersend:${requesterIp ?? 'unknown'}`, 'MailerSend');
    try {
      const res = await axios.get('https://api.mailersend.com/v1/me', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10_000,
        validateStatus: () => true,
      });
      if (res.status === 401 || res.status === 403) return { ok: false, errorMessage: 'Credenciais inválidas.' };
      if (res.status >= 200 && res.status < 300) return { ok: true };
      return { ok: false, errorMessage: `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, errorMessage: (err?.message ?? 'erro desconhecido').slice(0, 150) };
    }
  }

  async getSparkpost(accountId: number): Promise<AccountSparkpostView> {
    const row = await this.accountConfigs.getByAccountId(accountId, SPARKPOST_KEY_NAME);
    if (row?.value) {
      return { source: 'account', apiKeyMasked: maskCredential(row.value) ?? null };
    }
    return { source: 'none', apiKeyMasked: null };
  }

  async saveSparkpost(accountId: number, dto: SaveAccountSparkpostDto): Promise<AccountSparkpostView> {
    await this.accountConfigs.upsertByAccountId(accountId, SPARKPOST_KEY_NAME, dto.apiKey);
    return { source: 'account', apiKeyMasked: maskCredential(dto.apiKey) ?? null };
  }

  async deleteSparkpost(accountId: number): Promise<void> {
    await this.assertNotCurrentDefault(accountId, 'sparkpost');
    await this.accountConfigs.deleteByAccountId(accountId, SPARKPOST_KEY_NAME);
  }

  // SparkPost legacy migration: detect when this account is implicitly using the
  // platform-wide `process.env.SPARKPOST_API_KEY` (no per-account override) and
  // copy that value into accounts_configs so V3 cross-field/default-removal flows
  // can reason about the per-account state. The env value is never echoed back to
  // the caller.
  async getSparkpostLegacyStatus(accountId: number): Promise<{ legacyDetected: boolean; envValuePresent: boolean; perAccountConfigured: boolean }> {
    const envValuePresent = isRealSparkpostEnvValue(process.env.SPARKPOST_API_KEY);
    const perAccountRow = await this.accountConfigs.getByAccountId(accountId, SPARKPOST_KEY_NAME);
    const perAccountConfigured = !!perAccountRow?.value && perAccountRow.value.trim().length > 0;
    return {
      legacyDetected: envValuePresent && !perAccountConfigured,
      envValuePresent,
      perAccountConfigured,
    };
  }

  async migrateSparkpostLegacy(accountId: number): Promise<{
    legacyDetected: boolean;
    envValuePresent: boolean;
    perAccountConfigured: boolean;
  }> {
    const envValue = process.env.SPARKPOST_API_KEY ?? '';
    if (!isRealSparkpostEnvValue(envValue)) {
      throw new HttpException('Não há configuração SparkPost legada para migrar.', HttpStatus.BAD_REQUEST);
    }

    const existing = await this.accountConfigs.getByAccountId(accountId, SPARKPOST_KEY_NAME);
    if (existing?.value && existing.value.trim().length > 0) {
      // No-op: per-account configuration already in place.
      return { legacyDetected: false, envValuePresent: true, perAccountConfigured: true };
    }

    await this.accountConfigs.upsertByAccountId(accountId, SPARKPOST_KEY_NAME, envValue);

    const currentDefault = await this.accountConfigs.getByAccountId(accountId, DEFAULT_EMAIL_PROVIDER_NAME);
    if (!currentDefault?.value || currentDefault.value.trim().length === 0) {
      await this.accountConfigs.upsertByAccountId(accountId, DEFAULT_EMAIL_PROVIDER_NAME, 'sparkpost');
    }

    return { legacyDetected: false, envValuePresent: true, perAccountConfigured: true };
  }

  // SparkPost expects the API key directly in the Authorization header — no
  // "Bearer " prefix, unlike Resend/MailerSend. Using GET /api/v1/account as a
  // cheap auth probe.
  async testSparkpost(apiKey: string, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.sparkpostTestHits, `sparkpost:${requesterIp ?? 'unknown'}`, 'SparkPost');
    try {
      const res = await axios.get('https://api.sparkpost.com/api/v1/account', {
        headers: { Authorization: apiKey },
        timeout: 10_000,
        validateStatus: () => true,
      });
      if (res.status === 401 || res.status === 403) return { ok: false, errorMessage: 'Credenciais inválidas.' };
      if (res.status >= 200 && res.status < 300) return { ok: true };
      return { ok: false, errorMessage: `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, errorMessage: (err?.message ?? 'erro desconhecido').slice(0, 150) };
    }
  }

  async getResend(accountId: number): Promise<AccountResendView> {
    const row = await this.accountConfigs.getByAccountId(accountId, RESEND_KEY_NAME);
    if (row?.value) {
      return { source: 'account', apiKeyMasked: maskCredential(row.value) ?? null };
    }
    return { source: 'none', apiKeyMasked: null };
  }

  async saveResend(accountId: number, dto: SaveAccountResendDto): Promise<AccountResendView> {
    await this.accountConfigs.upsertByAccountId(accountId, RESEND_KEY_NAME, dto.apiKey);
    return { source: 'account', apiKeyMasked: maskCredential(dto.apiKey) ?? null };
  }

  async deleteResend(accountId: number): Promise<void> {
    await this.assertNotCurrentDefault(accountId, 'resend');
    await this.accountConfigs.deleteByAccountId(accountId, RESEND_KEY_NAME);
  }

  async testResend(apiKey: string, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.resendTestHits, `resend:${requesterIp ?? 'unknown'}`, 'Resend');
    try {
      const res = await axios.get('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10_000,
        validateStatus: () => true,
      });
      if (res.status === 401 || res.status === 403) return { ok: false, errorMessage: 'Credenciais inválidas.' };
      if (res.status >= 200 && res.status < 300) return { ok: true };
      return { ok: false, errorMessage: `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, errorMessage: (err?.message ?? 'erro desconhecido').slice(0, 150) };
    }
  }

  async getSes(accountId: number): Promise<AccountSesView> {
    const [accessKeyRow, secretRow, regionRow] = await Promise.all([
      this.accountConfigs.getByAccountId(accountId, SES_ACCESS_KEY_NAME),
      this.accountConfigs.getByAccountId(accountId, SES_SECRET_KEY_NAME),
      this.accountConfigs.getByAccountId(accountId, SES_REGION_NAME),
    ]);
    // Only report 'account' when all three rows are present — partial state
    // (e.g. saveSes failed between upserts) would otherwise lie to the UI and
    // mask a runtime auth error at send-time.
    if (accessKeyRow?.value && secretRow?.value && regionRow?.value) {
      return {
        source: 'account',
        accessKeyIdMasked: maskCredential(accessKeyRow.value) ?? null,
        secretAccessKeyMasked: maskCredential(secretRow.value) ?? null,
        region: regionRow.value,
      };
    }
    return { source: 'none', accessKeyIdMasked: null, secretAccessKeyMasked: null, region: null };
  }

  async saveSes(accountId: number, dto: SaveAccountSesDto): Promise<AccountSesView> {
    await this.accountConfigs.upsertByAccountId(accountId, SES_ACCESS_KEY_NAME, dto.accessKeyId);
    await this.accountConfigs.upsertByAccountId(accountId, SES_SECRET_KEY_NAME, dto.secretAccessKey);
    await this.accountConfigs.upsertByAccountId(accountId, SES_REGION_NAME, dto.region);
    return {
      source: 'account',
      accessKeyIdMasked: maskCredential(dto.accessKeyId) ?? null,
      secretAccessKeyMasked: maskCredential(dto.secretAccessKey) ?? null,
      region: dto.region,
    };
  }

  async deleteSes(accountId: number): Promise<void> {
    await this.assertNotCurrentDefault(accountId, 'ses');
    await this.accountConfigs.deleteByAccountId(accountId, SES_ACCESS_KEY_NAME);
    await this.accountConfigs.deleteByAccountId(accountId, SES_SECRET_KEY_NAME);
    await this.accountConfigs.deleteByAccountId(accountId, SES_REGION_NAME);
  }

  async testSes(accessKeyId: string, secretAccessKey: string, region: string, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.sesTestHits, `ses:${requesterIp ?? 'unknown'}`, 'Amazon SES');
    try {
      // Lazy-import: keeps msgops-api hot path free of the SES SDK when no
      // operator triggers a test connection.
      const { SESv2Client, GetAccountCommand } = await import('@aws-sdk/client-sesv2');
      const client = new SESv2Client({ region, credentials: { accessKeyId, secretAccessKey } });
      const result = await client.send(new GetAccountCommand({}));
      if (result?.SendingEnabled === false) {
        return { ok: false, errorMessage: 'SES SendingEnabled=false (conta pausada ou em sandbox).' };
      }
      return { ok: true };
    } catch (err: any) {
      // Sanitize SDK errors: surface a known-class message or a generic
      // fallback. Avoids leaking AWS request IDs / partial credentials that
      // sometimes appear in `err.message`.
      if (err?.name === 'UnrecognizedClientException') {
        return { ok: false, errorMessage: 'Credenciais inválidas.' };
      }
      if (err?.name === 'InvalidSignatureException' || err?.name === 'SignatureDoesNotMatch') {
        return { ok: false, errorMessage: 'Assinatura SES inválida — verifique a Secret Access Key.' };
      }
      this.logger.warn(`[SES] testConnection failed (${err?.name ?? 'unknown'}): ${err?.message ?? ''}`);
      return { ok: false, errorMessage: 'Falha ao testar conexão SES.' };
    }
  }

  async getMandrill(accountId: number): Promise<AccountMandrillView> {
    const row = await this.accountConfigs.getByAccountId(accountId, MANDRILL_KEY_NAME);
    if (row?.value) {
      return { source: 'account', apiKeyMasked: maskCredential(row.value) ?? null };
    }
    return { source: 'none', apiKeyMasked: null };
  }

  async saveMandrill(accountId: number, dto: SaveAccountMandrillDto): Promise<AccountMandrillView> {
    await this.accountConfigs.upsertByAccountId(accountId, MANDRILL_KEY_NAME, dto.apiKey);
    return { source: 'account', apiKeyMasked: maskCredential(dto.apiKey) ?? null };
  }

  async deleteMandrill(accountId: number): Promise<void> {
    await this.assertNotCurrentDefault(accountId, 'mandrill');
    await this.accountConfigs.deleteByAccountId(accountId, MANDRILL_KEY_NAME);
  }

  async testMandrill(apiKey: string, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.mandrillTestHits, `mandrill:${requesterIp ?? 'unknown'}`, 'Mandrill');
    try {
      const res = await axios.post(
        'https://mandrillapp.com/api/1.0/users/ping.json',
        { key: apiKey },
        {
          timeout: 10_000,
          validateStatus: () => true,
        },
      );
      if (res.status === 200 && typeof res.data === 'string' && res.data.trim() === 'PONG!') return { ok: true };
      if (res.status === 401 || res.status === 500) return { ok: false, errorMessage: 'Credenciais inválidas.' };
      if (res.status >= 200 && res.status < 300) return { ok: false, errorMessage: 'Resposta inesperada do Mandrill.' };
      return { ok: false, errorMessage: `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, errorMessage: (err?.message ?? 'erro desconhecido').slice(0, 150) };
    }
  }

  // ── Twilio (WhatsApp Twilio + SMS) ─────────────────────────────────────────
  // One credential set per account; the SMS vs WhatsApp distinction is the
  // Messaging Service SID. The twilio-messaging worker + messages.service read
  // these slots via account.configByName(...) — no worker change needed.

  async getTwilio(accountId: number): Promise<AccountTwilioView> {
    const [accountSid, apiSid, secret, authToken, sms, whatsapp] = await Promise.all([
      this.accountConfigs.getByAccountId(accountId, TWILIO_SID_ACCOUNT_NAME),
      this.accountConfigs.getByAccountId(accountId, TWILIO_SID_NAME),
      this.accountConfigs.getByAccountId(accountId, TWILIO_SECRET_NAME),
      this.accountConfigs.getByAccountId(accountId, TWILIO_AUTH_TOKEN_NAME),
      this.accountConfigs.getByAccountId(accountId, TWILIO_SMS_SERVICE_NAME),
      this.accountConfigs.getByAccountId(accountId, TWILIO_WHATSAPP_SERVICE_NAME),
    ]);
    if (!accountSid?.value && !secret?.value) {
      return {
        source: 'none',
        accountSid: null,
        apiSid: null,
        smsServiceSid: null,
        whatsappServiceSid: null,
        hasSecret: false,
        hasAuthToken: false,
        hasSms: false,
        hasWhatsapp: false,
      };
    }
    return {
      source: 'account',
      accountSid: accountSid?.value ?? null,
      apiSid: apiSid?.value ?? null,
      smsServiceSid: sms?.value ?? null,
      whatsappServiceSid: whatsapp?.value ?? null,
      hasSecret: Boolean(secret?.value),
      hasAuthToken: Boolean(authToken?.value),
      hasSms: Boolean(sms?.value),
      hasWhatsapp: Boolean(whatsapp?.value),
    };
  }

  async saveTwilio(accountId: number, dto: SaveAccountTwilioDto): Promise<AccountTwilioView> {
    await this.accountConfigs.upsertByAccountId(accountId, TWILIO_SID_ACCOUNT_NAME, dto.accountSid);
    await this.accountConfigs.upsertByAccountId(accountId, TWILIO_SID_NAME, dto.apiSid);
    await this.accountConfigs.upsertByAccountId(accountId, TWILIO_SECRET_NAME, dto.apiSecret);
    if (dto.authToken !== undefined) await this.accountConfigs.upsertByAccountId(accountId, TWILIO_AUTH_TOKEN_NAME, dto.authToken);
    if (dto.smsServiceSid !== undefined) await this.accountConfigs.upsertByAccountId(accountId, TWILIO_SMS_SERVICE_NAME, dto.smsServiceSid);
    if (dto.whatsappServiceSid !== undefined) await this.accountConfigs.upsertByAccountId(accountId, TWILIO_WHATSAPP_SERVICE_NAME, dto.whatsappServiceSid);
    return this.getTwilio(accountId);
  }

  async deleteTwilio(accountId: number): Promise<void> {
    await Promise.all([
      this.accountConfigs.deleteByAccountId(accountId, TWILIO_SID_ACCOUNT_NAME),
      this.accountConfigs.deleteByAccountId(accountId, TWILIO_SID_NAME),
      this.accountConfigs.deleteByAccountId(accountId, TWILIO_SECRET_NAME),
      this.accountConfigs.deleteByAccountId(accountId, TWILIO_AUTH_TOKEN_NAME),
      this.accountConfigs.deleteByAccountId(accountId, TWILIO_SMS_SERVICE_NAME),
      this.accountConfigs.deleteByAccountId(accountId, TWILIO_WHATSAPP_SERVICE_NAME),
    ]);
  }

  async testTwilio(creds: { accountSid: string; apiSid: string; apiSecret: string }, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.twilioTestHits, `twilio:${requesterIp ?? 'unknown'}`, 'Twilio');
    try {
      // Basic Auth with API Key SID : secret — validates the SENDING credentials
      // against the account resource (same auth model the worker uses).
      const basic = Buffer.from(`${creds.apiSid}:${creds.apiSecret}`).toString('base64');
      const res = await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}.json`, {
        headers: { Authorization: `Basic ${basic}` },
        timeout: 10_000,
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) return { ok: true };
      if (res.status === 401 || res.status === 403) return { ok: false, errorMessage: 'Credenciais inválidas.' };
      if (res.status === 404) return { ok: false, errorMessage: 'Account SID não encontrado.' };
      return { ok: false, errorMessage: `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, errorMessage: (err?.message ?? 'erro desconhecido').slice(0, 150) };
    }
  }

  // ── Push (Mobile FCM + Web-Push) ────────────────────────────────────────────
  // Per-account Firebase service account with platform fallback. send-push reads
  // firebase_service_account_app for both push types (see definedFirebaseService).

  async getPush(accountId: number): Promise<AccountPushView> {
    const row = await this.accountConfigs.getByAccountId(accountId, FIREBASE_SERVICE_ACCOUNT_NAME);
    if (row?.value) {
      return { source: 'account', serviceAccountMasked: maskCredential(row.value) ?? null };
    }
    // Platform fallback active when the super-admin env credential is present.
    if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim().length > 0) {
      return { source: 'platform', serviceAccountMasked: null };
    }
    return { source: 'none', serviceAccountMasked: null };
  }

  async savePush(accountId: number, dto: SaveAccountPushDto): Promise<AccountPushView> {
    await this.accountConfigs.upsertByAccountId(accountId, FIREBASE_SERVICE_ACCOUNT_NAME, dto.firebaseServiceAccount);
    return { source: 'account', serviceAccountMasked: maskCredential(dto.firebaseServiceAccount) ?? null };
  }

  async deletePush(accountId: number): Promise<void> {
    await this.accountConfigs.deleteByAccountId(accountId, FIREBASE_SERVICE_ACCOUNT_NAME);
  }

  async testPush(firebaseServiceAccount: string, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.pushTestHits, `push:${requesterIp ?? 'unknown'}`, 'Push');
    // The DTO already validated JSON shape; re-check defensively and confirm the
    // private key looks like a PEM block (catches truncated pastes).
    try {
      const parsed = JSON.parse(firebaseServiceAccount);
      const missing = ['project_id', 'private_key', 'client_email'].filter((f) => !parsed[f] || typeof parsed[f] !== 'string');
      if (missing.length > 0) return { ok: false, errorMessage: `Campos ausentes: ${missing.join(', ')}` };
      if (!String(parsed.private_key).includes('BEGIN PRIVATE KEY')) return { ok: false, errorMessage: 'private_key inválida (PEM esperado).' };
      return { ok: true };
    } catch {
      return { ok: false, errorMessage: 'JSON inválido.' };
    }
  }
}
