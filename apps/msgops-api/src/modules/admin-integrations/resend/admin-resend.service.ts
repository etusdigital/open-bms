import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import axios from 'axios';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { maskCredential } from '../../../lib/geoip-config-file';
import { ResendSystemSettings, resendEnvFilePath, writeResendEnvFile } from '../../../lib/integrations-config-file';
import { enforceTestRateLimit } from '../../../lib/test-rate-limit';
import { ResendSystemSettingsDto, ResendTestConnectionDto, resendSystemSettingsSaveSchema, resendTestConnectionSchema } from './dtos/resend-system-settings.dto';

export const RESEND_KEY = 'resend_system_settings';

export interface ResendAdminSettings {
  apiKeyMasked?: string;
  webhookSigningSecretMasked?: string;
  webhookUrlBase?: string;
  metadata?: { hasFreeTier: boolean; hasWebhook: boolean; notes: string };
}

const PROVIDER_METADATA = {
  hasFreeTier: true,
  hasWebhook: true,
  notes: '3000/mês ou 100/dia free tier (verificado 2026-05)',
};

@Injectable()
export class AdminResendService implements OnModuleInit {
  private readonly logger = new Logger(AdminResendService.name);
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (existsSync(resendEnvFilePath())) return;
    const raw = await this.readRaw();
    if (!raw) return;
    try {
      writeResendEnvFile(raw);
      this.logger.log(`[Resend] bootstrapped ${resendEnvFilePath()} from system_config`);
    } catch (err: any) {
      this.logger.warn(`[Resend] could not write env file: ${err?.message ?? 'unknown'}`);
    }
  }

  async getSettings(): Promise<ResendAdminSettings | null> {
    const raw = await this.readRaw();
    if (!raw) return null;
    return this.toPublic(raw);
  }

  async saveSettings(payload: ResendSystemSettingsDto): Promise<ResendAdminSettings> {
    const existing = await this.readRaw();
    const merged: ResendSystemSettings = {
      apiKey: payload.apiKey ?? existing?.apiKey ?? '',
      webhookSigningSecret: payload.webhookSigningSecret ?? existing?.webhookSigningSecret,
      webhookUrlBase: payload.webhookUrlBase ?? existing?.webhookUrlBase,
    };

    const { value, error } = resendSystemSettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as ResendSystemSettings;
    await this.repo.save(this.repo.create({ key: RESEND_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(RESEND_KEY);

    try {
      writeResendEnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[Resend] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    return this.toPublic(finalValue);
  }

  async testConnection(payload: ResendTestConnectionDto, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.testHits, `resend:${requesterIp ?? 'unknown'}`, 'Resend');

    const { value, error } = resendTestConnectionSchema.validate(payload, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const existing = await this.readRaw();
    const apiKey = (value as ResendTestConnectionDto).apiKey ?? existing?.apiKey;
    if (!apiKey) return { ok: false, errorMessage: 'apiKey é obrigatório.' };

    try {
      // GET /domains needs only read access; 200 = key works.
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

  private async readRaw(): Promise<ResendSystemSettings | null> {
    return (await this.cache.get<ResendSystemSettings>(RESEND_KEY)) ?? null;
  }

  private toPublic(raw: ResendSystemSettings): ResendAdminSettings {
    return {
      apiKeyMasked: maskCredential(raw.apiKey),
      webhookSigningSecretMasked: raw.webhookSigningSecret ? maskCredential(raw.webhookSigningSecret) : undefined,
      webhookUrlBase: raw.webhookUrlBase,
      metadata: PROVIDER_METADATA,
    };
  }
}
