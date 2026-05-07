import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import axios from 'axios';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { maskCredential } from '../../../lib/geoip-config-file';
import { MandrillSystemSettings, mandrillEnvFilePath, writeMandrillEnvFile } from '../../../lib/integrations-config-file';
import { enforceTestRateLimit } from '../../../lib/test-rate-limit';
import { MandrillSystemSettingsDto, MandrillTestConnectionDto, mandrillSystemSettingsSaveSchema, mandrillTestConnectionSchema } from './dtos/mandrill-system-settings.dto';

export const MANDRILL_KEY = 'mandrill_system_settings';

export interface MandrillAdminSettings {
  apiKeyMasked?: string;
  webhookKeyMasked?: string;
  webhookUrlBase?: string;
  metadata?: { hasFreeTier: boolean; hasWebhook: boolean; notes: string };
}

const PROVIDER_METADATA = {
  hasFreeTier: false,
  hasWebhook: true,
  notes:
    'No free tier perpetuum: $20 a cada bloco de 25k emails. Discontinuação foi anunciada várias vezes pela MailChimp — tratar como integração experimental (verificado 2026-05).',
};

@Injectable()
export class AdminMandrillService implements OnModuleInit {
  private readonly logger = new Logger(AdminMandrillService.name);
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (existsSync(mandrillEnvFilePath())) return;
    const raw = await this.readRaw();
    if (!raw) return;
    try {
      writeMandrillEnvFile(raw);
      this.logger.log(`[Mandrill] bootstrapped ${mandrillEnvFilePath()} from system_config`);
    } catch (err: any) {
      this.logger.warn(`[Mandrill] could not write env file: ${err?.message ?? 'unknown'}`);
    }
  }

  async getSettings(): Promise<MandrillAdminSettings | null> {
    const raw = await this.readRaw();
    if (!raw) return null;
    return this.toPublic(raw);
  }

  async saveSettings(payload: MandrillSystemSettingsDto): Promise<MandrillAdminSettings> {
    const existing = await this.readRaw();
    const merged: MandrillSystemSettings = {
      apiKey: payload.apiKey ?? existing?.apiKey ?? '',
      webhookKey: payload.webhookKey ?? existing?.webhookKey,
      webhookUrlBase: payload.webhookUrlBase ?? existing?.webhookUrlBase,
    };

    const { value, error } = mandrillSystemSettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as MandrillSystemSettings;
    await this.repo.save(this.repo.create({ key: MANDRILL_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(MANDRILL_KEY);

    try {
      writeMandrillEnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[Mandrill] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    return this.toPublic(finalValue);
  }

  async testConnection(payload: MandrillTestConnectionDto, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.testHits, `mandrill:${requesterIp ?? 'unknown'}`, 'Mandrill');

    const { value, error } = mandrillTestConnectionSchema.validate(payload, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const existing = await this.readRaw();
    const apiKey = (value as MandrillTestConnectionDto).apiKey ?? existing?.apiKey;
    if (!apiKey) return { ok: false, errorMessage: 'apiKey é obrigatório.' };

    try {
      // /users/ping returns "PONG!" on success — simplest API call that
      // doesn't change account state. Mandrill expects a POST with the
      // key inside the JSON body, not a header.
      const res = await axios.post('https://mandrillapp.com/api/1.0/users/ping.json', { key: apiKey }, { timeout: 10_000, validateStatus: () => true });
      if (res.status === 200 && typeof res.data === 'string' && res.data.includes('PONG')) return { ok: true };
      if (res.status === 401 || res.status === 500) return { ok: false, errorMessage: 'Credenciais inválidas.' };
      return { ok: false, errorMessage: `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, errorMessage: (err?.message ?? 'erro desconhecido').slice(0, 150) };
    }
  }

  private async readRaw(): Promise<MandrillSystemSettings | null> {
    return (await this.cache.get<MandrillSystemSettings>(MANDRILL_KEY)) ?? null;
  }

  private toPublic(raw: MandrillSystemSettings): MandrillAdminSettings {
    return {
      apiKeyMasked: maskCredential(raw.apiKey),
      webhookKeyMasked: raw.webhookKey ? maskCredential(raw.webhookKey) : undefined,
      webhookUrlBase: raw.webhookUrlBase,
      metadata: PROVIDER_METADATA,
    };
  }
}
