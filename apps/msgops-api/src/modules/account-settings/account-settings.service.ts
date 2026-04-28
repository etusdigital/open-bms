import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { AccountConfigsProvider } from '../../providers/account-configs.provider';
import { SendgridHandler } from '../../handlers/email/sendgrid/sendgrid.handler';
import { validateSendgridApiKey } from '../../lib/sendgrid-validator';
import { SaveAccountSendgridDto } from './dtos/sendgrid.dto';
import { maskApiKey } from '../settings/settings.service';

const SENDGRID_KEY_NAME = 'sendgrid_key';
const SENDGRID_WEBHOOK_NAME = 'sendgrid_webhook_url';
const SYSTEM_SENDGRID_KEY = 'sendgrid_settings';
const TEST_RATE_WINDOW_MS = 60_000;
const TEST_RATE_MAX_PER_WINDOW = 5;

export type SendgridKeySource = 'account' | 'global' | 'none';

export interface AccountSendgridView {
  source: SendgridKeySource;
  apiKeyMasked: string | null;
  webhookUrl: string | null;
}

@Injectable()
export class AccountSettingsService {
  private readonly logger = new Logger(AccountSettingsService.name);
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly systemConfigRepo: Repository<SystemConfigEntity>,
    private readonly accountConfigs: AccountConfigsProvider,
    private readonly sendgridHandler: SendgridHandler,
  ) {}

  // Returns the per-account SendGrid view: which source is in use (own key
  // vs the global fallback the super-admin set vs nothing), the masked
  // value (only for the account's own key — clients never see the global
  // key plaintext or its mask), and the registered webhook URL if any.
  async getSendgrid(accountId: number): Promise<AccountSendgridView> {
    const accountKey = await this.accountConfigs.getByAccountId(accountId, SENDGRID_KEY_NAME);
    if (accountKey?.value) {
      const webhookRow = await this.accountConfigs.getByAccountId(accountId, SENDGRID_WEBHOOK_NAME);
      return {
        source: 'account',
        apiKeyMasked: maskApiKey(accountKey.value),
        webhookUrl: webhookRow?.value ?? null,
      };
    }

    const hasGlobal = await this.hasGlobalKey();
    return {
      source: hasGlobal ? 'global' : 'none',
      apiKeyMasked: null,
      webhookUrl: null,
    };
  }

  // Persists the per-account API key, registers a SendGrid event webhook
  // pointed at this BMS instance's gateway with `&account=<id>` so the
  // event-process worker can route incoming events to the right tenant,
  // and persists the resulting URL alongside the key. If webhook
  // registration fails the key is NOT saved — a key that can send but not
  // receive events leads to silent analytics gaps.
  async saveSendgrid(accountId: number, dto: SaveAccountSendgridDto): Promise<AccountSendgridView> {
    let registered: { url: string };
    try {
      registered = await this.sendgridHandler.createWebhook({ apiKey: dto.apiKey, accountId });
    } catch (err) {
      this.logger.error(`Falha ao registrar webhook SendGrid para conta ${accountId}`, err as Error);
      throw new HttpException('Não foi possível registrar o webhook na SendGrid. Verifique se a chave de API tem permissão para configurar webhooks.', HttpStatus.BAD_GATEWAY);
    }

    await this.accountConfigs.upsertByAccountId(accountId, SENDGRID_KEY_NAME, dto.apiKey);
    await this.accountConfigs.upsertByAccountId(accountId, SENDGRID_WEBHOOK_NAME, registered.url);
    this.sendgridHandler.invalidateApiKeyCache(accountId);

    return {
      source: 'account',
      apiKeyMasked: maskApiKey(dto.apiKey),
      webhookUrl: registered.url,
    };
  }

  // Removes the per-account key (and stored webhook URL). The webhook
  // registered on SendGrid stays in their dashboard — leaving it there is
  // harmless and avoids a destructive call when the user just wants to
  // fall back to the global key. After delete, getSendgrid() reports
  // `source: 'global' | 'none'`.
  async deleteSendgrid(accountId: number): Promise<void> {
    await this.accountConfigs.deleteByAccountId(accountId, SENDGRID_KEY_NAME);
    await this.accountConfigs.deleteByAccountId(accountId, SENDGRID_WEBHOOK_NAME);
    this.sendgridHandler.invalidateApiKeyCache(accountId);
  }

  async testSendgrid(apiKey: string, requesterIp?: string): Promise<{ accountName: string | null }> {
    this.enforceTestRateLimit(requesterIp);
    return validateSendgridApiKey(apiKey);
  }

  private async hasGlobalKey(): Promise<boolean> {
    const row = await this.systemConfigRepo.findOne({ where: { key: SYSTEM_SENDGRID_KEY } });
    const value = (row?.value ?? {}) as Record<string, unknown>;
    if (typeof value.apiKey === 'string' && value.apiKey.length > 0) return true;
    return Boolean(process.env.SENDGRID_API_KEY);
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
}
