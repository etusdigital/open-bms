import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import axios from 'axios';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { maskCredential } from '../../../lib/geoip-config-file';
import { MailerSendSystemSettings, mailerSendEnvFilePath, writeMailerSendEnvFile } from '../../../lib/integrations-config-file';
import { enforceTestRateLimit } from '../../../lib/test-rate-limit';
import {
  MailerSendSystemSettingsDto,
  MailerSendTestConnectionDto,
  mailerSendSystemSettingsSaveSchema,
  mailerSendTestConnectionSchema,
} from './dtos/mailersend-system-settings.dto';

export const MAILERSEND_KEY = 'mailersend_system_settings';

export interface MailerSendAdminSettings {
  apiKeyMasked?: string;
  webhookSigningSecretMasked?: string;
  webhookUrlBase?: string;
  metadata?: { hasFreeTier: boolean; hasWebhook: boolean; notes: string };
}

const PROVIDER_METADATA = {
  hasFreeTier: true,
  hasWebhook: true,
  notes: '3000 emails/mês perpétuo (verificado 2026-05)',
};

@Injectable()
export class AdminMailerSendService implements OnModuleInit {
  private readonly logger = new Logger(AdminMailerSendService.name);
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (existsSync(mailerSendEnvFilePath())) return;
    const raw = await this.readRaw();
    if (!raw) return;
    try {
      writeMailerSendEnvFile(raw);
      this.logger.log(`[MailerSend] bootstrapped ${mailerSendEnvFilePath()} from system_config`);
    } catch (err: any) {
      this.logger.warn(`[MailerSend] could not write env file: ${err?.message ?? 'unknown'}`);
    }
  }

  async getSettings(): Promise<MailerSendAdminSettings | null> {
    const raw = await this.readRaw();
    if (!raw) return null;
    return this.toPublic(raw);
  }

  async saveSettings(payload: MailerSendSystemSettingsDto): Promise<MailerSendAdminSettings> {
    const existing = await this.readRaw();
    const merged: MailerSendSystemSettings = {
      apiKey: payload.apiKey ?? existing?.apiKey ?? '',
      webhookSigningSecret: payload.webhookSigningSecret ?? existing?.webhookSigningSecret,
      webhookUrlBase: payload.webhookUrlBase ?? existing?.webhookUrlBase,
    };

    const { value, error } = mailerSendSystemSettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as MailerSendSystemSettings;
    await this.repo.save(this.repo.create({ key: MAILERSEND_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(MAILERSEND_KEY);

    try {
      writeMailerSendEnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[MailerSend] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    return this.toPublic(finalValue);
  }

  async testConnection(payload: MailerSendTestConnectionDto, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.testHits, `mailersend:${requesterIp ?? 'unknown'}`, 'MailerSend');

    const { value, error } = mailerSendTestConnectionSchema.validate(payload, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const existing = await this.readRaw();
    const apiKey = (value as MailerSendTestConnectionDto).apiKey ?? existing?.apiKey;
    if (!apiKey) return { ok: false, errorMessage: 'apiKey é obrigatório.' };

    try {
      // GET /v1/me echoes the authenticated user; 200 = key works, 401/403 = bad key.
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

  private async readRaw(): Promise<MailerSendSystemSettings | null> {
    return (await this.cache.get<MailerSendSystemSettings>(MAILERSEND_KEY)) ?? null;
  }

  private toPublic(raw: MailerSendSystemSettings): MailerSendAdminSettings {
    return {
      apiKeyMasked: maskCredential(raw.apiKey),
      webhookSigningSecretMasked: raw.webhookSigningSecret ? maskCredential(raw.webhookSigningSecret) : undefined,
      webhookUrlBase: raw.webhookUrlBase,
      metadata: PROVIDER_METADATA,
    };
  }
}
