import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { maskCredential } from '../../../lib/geoip-config-file';
import { WhatsappHubSystemSettings, whatsappHubEnvFilePath, writeWhatsappHubEnvFile } from '../../../lib/integrations-config-file';
import { WhatsappHubSystemSettingsDto, whatsappHubSystemSettingsSaveSchema } from './dtos/whatsapp-hub-system-settings.dto';

export const WHATSAPP_HUB_KEY = 'whatsapp_hub_system_settings';

export interface WhatsappHubSystemAdminSettings {
  enabled: boolean;
  url?: string;
  apiKeyMasked?: string;
  webhookSecretMasked?: string;
}

/**
 * Wave 7.8 — Super Admin service for the EvoHub turnkey credentials.
 *
 * Same persistence model as Sendgrid/SES: row in `system_config` + cache +
 * generated `whatsapp-hub.env` file. Includes the `enabled` master toggle
 * that drives the install-wide mode (read by WhatsappModeResolverService
 * via process.env.EVOLUTION_HUB_ENABLED).
 *
 * After saving with `enabled` flipped, the worker must be restarted so the
 * env file is reloaded — same constraint applies to every system-level
 * integration in this codebase.
 */
@Injectable()
export class AdminWhatsappHubService implements OnModuleInit {
  private readonly logger = new Logger(AdminWhatsappHubService.name);

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (existsSync(whatsappHubEnvFilePath())) return;
    const raw = await this.readRaw();
    if (!raw) return;
    try {
      writeWhatsappHubEnvFile(raw);
      this.logger.log(`[WhatsappHub] bootstrapped ${whatsappHubEnvFilePath()} from system_config`);
    } catch (err: any) {
      this.logger.warn(`[WhatsappHub] could not write env file: ${err?.message ?? 'unknown'}`);
    }
  }

  async getSettings(): Promise<WhatsappHubSystemAdminSettings | null> {
    const raw = await this.readRaw();
    if (!raw) return { enabled: false, url: process.env.EVOLUTION_HUB_URL ?? 'https://api.evohub.ai' };
    return this.toPublic(raw);
  }

  async saveSettings(payload: WhatsappHubSystemSettingsDto): Promise<WhatsappHubSystemAdminSettings> {
    const existing = await this.readRaw();
    const merged: WhatsappHubSystemSettings = {
      enabled: payload.enabled ?? existing?.enabled ?? false,
      url: payload.url ?? existing?.url ?? 'https://api.evohub.ai',
      apiKey: payload.apiKey ?? existing?.apiKey ?? '',
      webhookSecret: payload.webhookSecret ?? existing?.webhookSecret ?? '',
    };

    const { value, error } = whatsappHubSystemSettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as WhatsappHubSystemSettings;
    await this.repo.save(this.repo.create({ key: WHATSAPP_HUB_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(WHATSAPP_HUB_KEY);

    try {
      writeWhatsappHubEnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[WhatsappHub] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    return this.toPublic(finalValue);
  }

  private async readRaw(): Promise<WhatsappHubSystemSettings | null> {
    return (await this.cache.get<WhatsappHubSystemSettings>(WHATSAPP_HUB_KEY)) ?? null;
  }

  private toPublic(raw: WhatsappHubSystemSettings): WhatsappHubSystemAdminSettings {
    return {
      enabled: raw.enabled,
      url: raw.url,
      apiKeyMasked: maskCredential(raw.apiKey),
      webhookSecretMasked: maskCredential(raw.webhookSecret),
    };
  }
}
