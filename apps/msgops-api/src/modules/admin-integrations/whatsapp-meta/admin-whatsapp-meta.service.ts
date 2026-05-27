import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { maskCredential } from '../../../lib/geoip-config-file';
import { WhatsappMetaSystemSettings, whatsappMetaEnvFilePath, writeWhatsappMetaEnvFile } from '../../../lib/integrations-config-file';
import { WhatsappMetaSystemSettingsDto, whatsappMetaSystemSettingsSaveSchema } from './dtos/whatsapp-meta-system-settings.dto';

export const WHATSAPP_META_KEY = 'whatsapp_meta_system_settings';

export interface WhatsappMetaSystemAdminSettings {
  appId?: string;
  appSecretMasked?: string;
  configId?: string;
  verifyTokenMasked?: string;
  graphVersion?: string;
}

/**
 * Wave 7.8 — Super Admin service for the Meta App (Cloud API direct) credentials.
 *
 * Follows the pattern of AdminSendgridService:
 *   - reads/writes `system_config` row keyed by WHATSAPP_META_KEY
 *   - mirrors to a managed env file (`whatsapp-meta.env`) so worker processes
 *     get the same values without a DB call
 *   - returns masked credentials to the UI (never echoes secrets back)
 */
@Injectable()
export class AdminWhatsappMetaService implements OnModuleInit {
  private readonly logger = new Logger(AdminWhatsappMetaService.name);

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    const raw = await this.readRaw();
    if (!raw) return;

    // Mirror DB → process.env at boot. The dotenv loader runs before this,
    // so without this hydration the channel-create flow would call Meta with
    // stale / missing credentials on the first request after a save.
    if (raw.appId) process.env.WHATSAPP_APP_ID = raw.appId;
    if (raw.appSecret) process.env.WHATSAPP_APP_SECRET = raw.appSecret;
    if (raw.configId) process.env.WHATSAPP_CONFIG_ID = raw.configId;
    if (raw.verifyToken) process.env.WHATSAPP_VERIFY_TOKEN = raw.verifyToken;
    if (raw.graphVersion) process.env.WHATSAPP_GRAPH_VERSION = raw.graphVersion;

    if (existsSync(whatsappMetaEnvFilePath())) return;
    try {
      writeWhatsappMetaEnvFile(raw);
      this.logger.log(`[WhatsappMeta] bootstrapped ${whatsappMetaEnvFilePath()} from system_config`);
    } catch (err: any) {
      this.logger.warn(`[WhatsappMeta] could not write env file: ${err?.message ?? 'unknown'}`);
    }
  }

  async getSettings(): Promise<WhatsappMetaSystemAdminSettings | null> {
    const raw = await this.readRaw();
    if (!raw) return null;
    return this.toPublic(raw);
  }

  async saveSettings(payload: WhatsappMetaSystemSettingsDto): Promise<WhatsappMetaSystemAdminSettings> {
    const existing = await this.readRaw();
    const merged: WhatsappMetaSystemSettings = {
      appId: payload.appId ?? existing?.appId ?? '',
      appSecret: payload.appSecret ?? existing?.appSecret ?? '',
      configId: payload.configId ?? existing?.configId ?? '',
      verifyToken: payload.verifyToken ?? existing?.verifyToken ?? '',
      graphVersion: payload.graphVersion ?? existing?.graphVersion,
    };

    const { value, error } = whatsappMetaSystemSettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as WhatsappMetaSystemSettings;
    await this.repo.save(this.repo.create({ key: WHATSAPP_META_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(WHATSAPP_META_KEY);

    try {
      writeWhatsappMetaEnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[WhatsappMeta] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    // Mirror to process.env so the channel-create flow (which reads
    // WHATSAPP_APP_ID/SECRET to exchange the FB.login `code` for an
    // access_token) and the webhook signature check (HMAC with App Secret)
    // pick up the new values without a process restart.
    process.env.WHATSAPP_APP_ID = finalValue.appId;
    process.env.WHATSAPP_APP_SECRET = finalValue.appSecret;
    process.env.WHATSAPP_CONFIG_ID = finalValue.configId;
    process.env.WHATSAPP_VERIFY_TOKEN = finalValue.verifyToken;
    if (finalValue.graphVersion) process.env.WHATSAPP_GRAPH_VERSION = finalValue.graphVersion;

    return this.toPublic(finalValue);
  }

  private async readRaw(): Promise<WhatsappMetaSystemSettings | null> {
    return (await this.cache.get<WhatsappMetaSystemSettings>(WHATSAPP_META_KEY)) ?? null;
  }

  private toPublic(raw: WhatsappMetaSystemSettings): WhatsappMetaSystemAdminSettings {
    return {
      appId: raw.appId,
      appSecretMasked: maskCredential(raw.appSecret),
      configId: raw.configId,
      verifyTokenMasked: maskCredential(raw.verifyToken),
      graphVersion: raw.graphVersion,
    };
  }
}
