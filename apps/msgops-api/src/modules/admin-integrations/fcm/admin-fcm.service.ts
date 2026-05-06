import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { FcmSystemSettings, fcmEnvFilePath, writeFcmEnvFile } from '../../../lib/integrations-config-file';
import { enforceTestRateLimit } from '../../../lib/test-rate-limit';
import { FcmSettingsDto, FcmTestConnectionDto, fcmSettingsSaveSchema, fcmTestConnectionSchema } from './dtos/fcm-settings.dto';

export const FCM_KEY = 'fcm_settings';

export interface FcmAdminSettings {
  projectId?: string;
  clientEmail?: string;
  hasPrivateKey: boolean;
}

@Injectable()
export class AdminFcmService implements OnModuleInit {
  private readonly logger = new Logger(AdminFcmService.name);
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (existsSync(fcmEnvFilePath())) return;
    const raw = await this.readRaw();
    if (!raw) return;
    try {
      writeFcmEnvFile(raw);
      this.logger.log(`[FCM] bootstrapped ${fcmEnvFilePath()} from system_config`);
    } catch (err: any) {
      this.logger.warn(`[FCM] could not write env file: ${err?.message ?? 'unknown'}`);
    }
  }

  async getSettings(): Promise<FcmAdminSettings | null> {
    const raw = await this.readRaw();
    if (!raw) return null;
    return this.toPublic(raw);
  }

  async saveSettings(payload: FcmSettingsDto): Promise<FcmAdminSettings> {
    const existing = await this.readRaw();
    const merged: FcmSystemSettings = {
      serviceAccountJson: payload.serviceAccountJson ?? existing?.serviceAccountJson ?? '',
    };

    const { value, error } = fcmSettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as FcmSystemSettings;
    await this.repo.save(this.repo.create({ key: FCM_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(FCM_KEY);

    try {
      writeFcmEnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[FCM] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    return this.toPublic(finalValue);
  }

  async testConnection(payload: FcmTestConnectionDto, requesterIp?: string): Promise<{ ok: boolean; projectId?: string; errorMessage?: string }> {
    enforceTestRateLimit(this.testHits, `fcm:${requesterIp ?? 'unknown'}`, 'FCM');

    const { value, error } = fcmTestConnectionSchema.validate(payload, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const existing = await this.readRaw();
    const json = (value as FcmTestConnectionDto).serviceAccountJson ?? existing?.serviceAccountJson;
    if (!json) return { ok: false, errorMessage: 'serviceAccountJson é obrigatório.' };

    // Joi already validated the structural shape (required keys, parseability).
    // For test-connection we just confirm the parsed projectId and report it
    // back. We avoid initializing firebase-admin here to keep msgops-api free
    // of that bundle; the worker (send-push) does the real init at boot.
    try {
      const parsed = JSON.parse(json);
      return { ok: true, projectId: parsed.project_id };
    } catch (err: any) {
      return { ok: false, errorMessage: (err?.message ?? 'JSON inválido').slice(0, 150) };
    }
  }

  private async readRaw(): Promise<FcmSystemSettings | null> {
    return (await this.cache.get<FcmSystemSettings>(FCM_KEY)) ?? null;
  }

  private toPublic(raw: FcmSystemSettings): FcmAdminSettings {
    try {
      const parsed = JSON.parse(raw.serviceAccountJson);
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        hasPrivateKey: !!parsed.private_key,
      };
    } catch {
      return { hasPrivateKey: false };
    }
  }
}
