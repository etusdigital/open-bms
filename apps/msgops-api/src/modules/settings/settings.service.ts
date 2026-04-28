import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { validateSendgridApiKey } from '../../lib/sendgrid-validator';
import { SendgridSettingsDto } from './dtos/sendgrid-settings.dto';
import { SendgridHandler } from '../../handlers/email/sendgrid/sendgrid.handler';

const SENDGRID_KEY = 'sendgrid_settings';
const TEST_RATE_WINDOW_MS = 60_000;
const TEST_RATE_MAX_PER_WINDOW = 5;

// Mask format used everywhere we surface a stored SendGrid key to the UI:
// `SG.****...<last 4>`. Never returns the plaintext key over HTTP.
const KEY_MASK_PREFIX = 'SG.****...';

export interface SendgridGlobalSettingsView {
  apiKeyMasked: string;
  hasKey: boolean;
}

@Injectable()
export class SettingsService {
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly systemConfigRepo: Repository<SystemConfigEntity>,
    private readonly sendgridHandler: SendgridHandler,
  ) {}

  // Returns a masked view of the global SendGrid fallback key. The plaintext
  // key never crosses the wire — the super-admin only sees that a key exists
  // and the last 4 characters for confirmation. There is no `webhookBaseUrl`
  // here: webhooks are registered per-account in AccountSettingsService;
  // the global key is purely an envelope-level fallback for accounts that
  // haven't configured their own.
  async getSendgrid(): Promise<SendgridGlobalSettingsView | null> {
    const config = await this.systemConfigRepo.findOne({ where: { key: SENDGRID_KEY } });
    if (!config) return null;
    const value = (config.value ?? {}) as Record<string, unknown>;
    if (typeof value.apiKey !== 'string' || value.apiKey.length === 0) return null;
    return { apiKeyMasked: maskApiKey(value.apiKey), hasKey: true };
  }

  // Saves the global fallback key in `system_config.sendgrid_settings`. Does
  // NOT register a webhook on SendGrid — the global key has no associated
  // BMS account, so no webhook URL is meaningful at this scope. Webhooks
  // are registered when a per-account key is saved.
  //
  // Overwrites the whole row so legacy fields (subuserEmail, subuserPrefix,
  // defaultIpPool, webhookBaseUrl) silently disappear on first save.
  async saveSendgrid(dto: SendgridSettingsDto): Promise<SendgridGlobalSettingsView> {
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: SENDGRID_KEY, value: { apiKey: dto.apiKey } }));
    this.sendgridHandler.invalidateApiKeyCache('global');
    return { apiKeyMasked: maskApiKey(dto.apiKey), hasKey: true };
  }

  async deleteSendgrid(): Promise<void> {
    await this.systemConfigRepo.delete({ key: SENDGRID_KEY });
    this.sendgridHandler.invalidateApiKeyCache('global');
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
}

export function maskApiKey(apiKey: string): string {
  const last4 = apiKey.slice(-4);
  return `${KEY_MASK_PREFIX}${last4}`;
}
