import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { maskCredential } from '../../../lib/geoip-config-file';
import { SendgridSystemSettings, sendgridEnvFilePath, writeSendgridEnvFile } from '../../../lib/integrations-config-file';
import { enforceTestRateLimit } from '../../../lib/test-rate-limit';
import { validateSendgridApiKey } from '../../../lib/sendgrid-validator';
import {
  SendgridSystemSettingsDto,
  SendgridSystemTestConnectionDto,
  sendgridSystemSettingsSaveSchema,
  sendgridSystemTestConnectionSchema,
} from './dtos/sendgrid-system-settings.dto';

export const SENDGRID_KEY = 'sendgrid_system_settings';

export interface SendgridSystemAdminSettings {
  apiKeyMasked?: string;
  apiBaseUrl?: string;
  webhookUrlBase?: string;
  ipPool?: string;
}

@Injectable()
export class AdminSendgridService implements OnModuleInit {
  private readonly logger = new Logger(AdminSendgridService.name);
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (existsSync(sendgridEnvFilePath())) return;
    const raw = await this.readRaw();
    if (!raw) return;
    try {
      writeSendgridEnvFile(raw);
      this.logger.log(`[Sendgrid] bootstrapped ${sendgridEnvFilePath()} from system_config`);
    } catch (err: any) {
      this.logger.warn(`[Sendgrid] could not write env file: ${err?.message ?? 'unknown'}`);
    }
  }

  async getSettings(): Promise<SendgridSystemAdminSettings | null> {
    const raw = await this.readRaw();
    if (!raw) return null;
    return this.toPublic(raw);
  }

  async saveSettings(payload: SendgridSystemSettingsDto): Promise<SendgridSystemAdminSettings> {
    const existing = await this.readRaw();
    const merged: SendgridSystemSettings = {
      apiKey: payload.apiKey ?? existing?.apiKey ?? '',
      apiBaseUrl: payload.apiBaseUrl ?? existing?.apiBaseUrl,
      webhookUrlBase: payload.webhookUrlBase ?? existing?.webhookUrlBase,
      ipPool: payload.ipPool ?? existing?.ipPool,
    };

    const { value, error } = sendgridSystemSettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as SendgridSystemSettings;
    await this.repo.save(this.repo.create({ key: SENDGRID_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(SENDGRID_KEY);

    try {
      writeSendgridEnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[Sendgrid] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    return this.toPublic(finalValue);
  }

  async testConnection(payload: SendgridSystemTestConnectionDto, requesterIp?: string): Promise<{ ok: boolean; accountName?: string | null; errorMessage?: string }> {
    enforceTestRateLimit(this.testHits, `sendgrid:${requesterIp ?? 'unknown'}`, 'SendGrid');

    const { value, error } = sendgridSystemTestConnectionSchema.validate(payload, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const existing = await this.readRaw();
    const v = value as SendgridSystemTestConnectionDto;
    const apiKey = v.apiKey ?? existing?.apiKey;
    const apiBaseUrl = v.apiBaseUrl ?? existing?.apiBaseUrl;
    if (!apiKey) return { ok: false, errorMessage: 'apiKey é obrigatório.' };

    try {
      const result = await validateSendgridApiKey(apiKey, apiBaseUrl);
      return { ok: true, accountName: result.accountName };
    } catch (err: any) {
      return { ok: false, errorMessage: (err?.message ?? 'erro desconhecido').slice(0, 150) };
    }
  }

  private async readRaw(): Promise<SendgridSystemSettings | null> {
    return (await this.cache.get<SendgridSystemSettings>(SENDGRID_KEY)) ?? null;
  }

  private toPublic(raw: SendgridSystemSettings): SendgridSystemAdminSettings {
    return {
      apiKeyMasked: maskCredential(raw.apiKey),
      apiBaseUrl: raw.apiBaseUrl,
      webhookUrlBase: raw.webhookUrlBase,
      ipPool: raw.ipPool,
    };
  }
}
