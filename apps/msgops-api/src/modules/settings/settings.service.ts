import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { validateSendgridApiKey } from '../../lib/sendgrid-validator';
import { SendgridSettingsDto } from './dtos/sendgrid-settings.dto';

const SENDGRID_KEY = 'sendgrid_settings';
const TEST_RATE_WINDOW_MS = 60_000;
const TEST_RATE_MAX_PER_WINDOW = 5;

export interface SendgridSettingsView {
  apiKey: string;
  webhookBaseUrl?: string;
}

@Injectable()
export class SettingsService {
  private readonly testHits = new Map<string, number[]>();

  constructor(@InjectRepository(SystemConfigEntity) private readonly systemConfigRepo: Repository<SystemConfigEntity>) {}

  async getSendgrid(): Promise<SendgridSettingsView | null> {
    const config = await this.systemConfigRepo.findOne({ where: { key: SENDGRID_KEY } });
    if (!config) return null;
    const value = (config.value ?? {}) as Record<string, unknown>;
    if (typeof value.apiKey !== 'string' || value.apiKey.length === 0) return null;
    // Strip legacy fields (subuserEmail, subuserPrefix, defaultIpPool) silently —
    // the new shape is { apiKey, webhookBaseUrl } only.
    const view: SendgridSettingsView = { apiKey: value.apiKey };
    if (typeof value.webhookBaseUrl === 'string' && value.webhookBaseUrl.length > 0) {
      view.webhookBaseUrl = value.webhookBaseUrl;
    }
    return view;
  }

  async saveSendgrid(dto: SendgridSettingsDto): Promise<void> {
    // Overwrite the whole key so legacy fields disappear on first save.
    const value: SendgridSettingsView = { apiKey: dto.apiKey };
    if (dto.webhookBaseUrl && dto.webhookBaseUrl.length > 0) {
      value.webhookBaseUrl = dto.webhookBaseUrl;
    }
    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: SENDGRID_KEY, value }));
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
