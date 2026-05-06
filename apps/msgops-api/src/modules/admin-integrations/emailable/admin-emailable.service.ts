import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import axios from 'axios';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { maskCredential } from '../../../lib/geoip-config-file';
import { EmailableSystemSettings, emailableEnvFilePath, writeEmailableEnvFile } from '../../../lib/integrations-config-file';
import { enforceTestRateLimit } from '../../../lib/test-rate-limit';
import { EmailableSettingsDto, EmailableTestConnectionDto, EMAILABLE_DEFAULT_URL, emailableSettingsSaveSchema, emailableTestConnectionSchema } from './dtos/emailable-settings.dto';

export const EMAILABLE_KEY = 'emailable_settings';

export interface EmailableAdminSettings {
  url?: string;
  apiKeyMasked?: string;
}

@Injectable()
export class AdminEmailableService implements OnModuleInit {
  private readonly logger = new Logger(AdminEmailableService.name);
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (existsSync(emailableEnvFilePath())) return;
    const raw = await this.readRaw();
    if (!raw) return;
    try {
      writeEmailableEnvFile(raw);
      this.logger.log(`[Emailable] bootstrapped ${emailableEnvFilePath()} from system_config`);
    } catch (err: any) {
      this.logger.warn(`[Emailable] could not write env file: ${err?.message ?? 'unknown'}`);
    }
  }

  async getSettings(): Promise<EmailableAdminSettings | null> {
    const raw = await this.readRaw();
    if (!raw) return null;
    return { url: raw.url, apiKeyMasked: maskCredential(raw.apiKey) };
  }

  async saveSettings(payload: EmailableSettingsDto): Promise<EmailableAdminSettings> {
    const existing = await this.readRaw();
    const merged: EmailableSystemSettings = {
      url: payload.url ?? existing?.url ?? EMAILABLE_DEFAULT_URL,
      apiKey: payload.apiKey ?? existing?.apiKey ?? '',
    };

    const { value, error } = emailableSettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as EmailableSystemSettings;
    await this.repo.save(this.repo.create({ key: EMAILABLE_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(EMAILABLE_KEY);

    try {
      writeEmailableEnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[Emailable] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    return { url: finalValue.url, apiKeyMasked: maskCredential(finalValue.apiKey) };
  }

  async testConnection(payload: EmailableTestConnectionDto, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.testHits, `emailable:${requesterIp ?? 'unknown'}`, 'Emailable');

    const { value, error } = emailableTestConnectionSchema.validate(payload, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const existing = await this.readRaw();
    const v = value as EmailableTestConnectionDto;
    const url = v.url ?? existing?.url ?? EMAILABLE_DEFAULT_URL;
    const apiKey = v.apiKey ?? existing?.apiKey;
    if (!apiKey) return { ok: false, errorMessage: 'apiKey é obrigatório.' };

    try {
      const res = await axios.get(url, {
        params: { email: 'test@example.com', api_key: apiKey, timeout: 5 },
        timeout: 10_000,
        validateStatus: () => true,
      });
      // 200/249/422: provider reconheceu a key; 401/403: rejeitou.
      if (res.status === 401 || res.status === 403) {
        return { ok: false, errorMessage: 'Credenciais inválidas.' };
      }
      if (res.status >= 200 && res.status < 500) return { ok: true };
      return { ok: false, errorMessage: `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, errorMessage: (err?.message ?? 'erro desconhecido').slice(0, 150) };
    }
  }

  private async readRaw(): Promise<EmailableSystemSettings | null> {
    return (await this.cache.get<EmailableSystemSettings>(EMAILABLE_KEY)) ?? null;
  }
}
