import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { FcmSystemSettings, fcmEnvFilePath, writeFcmEnvFile } from '../../../lib/integrations-config-file';
import { enforceTestRateLimit } from '../../../lib/test-rate-limit';
import { S3StorageProvider } from '../../../providers/s3-storage.provider';
import { buildPlatformServiceWorker, PLATFORM_SW_FILENAME, PLATFORM_SW_PATH } from '../../../lib/web-push-sw';
import { FcmSettingsDto, FcmTestConnectionDto, fcmSettingsSaveSchema, fcmTestConnectionSchema } from './dtos/fcm-settings.dto';

export const FCM_KEY = 'fcm_settings';

export interface FcmAdminSettings {
  projectId?: string;
  clientEmail?: string;
  hasPrivateKey: boolean;
  // Public web-push platform values (client-side; not secrets).
  webConfig?: FcmSystemSettings['webConfig'];
  vapidPublicKey?: string;
}

@Injectable()
export class AdminFcmService implements OnModuleInit {
  private readonly logger = new Logger(AdminFcmService.name);
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
    private readonly storage: S3StorageProvider,
    private readonly httpService: HttpService,
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
      // Web config + VAPID are public client-side values for web-push SW
      // generation. Preserve existing when the caller omits them (partial save).
      webConfig: payload.webConfig ?? existing?.webConfig,
      vapidPublicKey: payload.vapidPublicKey ?? existing?.vapidPublicKey,
    };

    const { value, error } = fcmSettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as FcmSystemSettings;
    await this.repo.save(this.repo.create({ key: FCM_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(FCM_KEY);

    try {
      // Only the service account goes into fcm.env (send-push). Web config/VAPID
      // are deliberately NOT written here — their sole consumer is the web-push
      // service-worker generation.
      writeFcmEnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[FCM] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    // Regenerate + upload the platform web-push service worker whenever the web
    // config is present, so bms-sw.js reflects the configured Firebase project.
    // Non-fatal: a save must not fail because S3/CDN is momentarily unavailable.
    if (finalValue.webConfig && Object.keys(finalValue.webConfig).length > 0) {
      await this.regeneratePlatformServiceWorker(finalValue).catch((err: any) => this.logger.warn(`[FCM] platform sw.js regen failed (non-fatal): ${err?.message ?? 'unknown'}`));
    }

    return this.toPublic(finalValue);
  }

  // Builds bms-sw.js from the repo template + the platform Firebase web config and
  // uploads it to {BMS_ASSETS_URL}/bms/bms-sw.js, then purges the CDN cache.
  // Single-project: one core for all accounts; per-account wrappers importScripts it.
  async regeneratePlatformServiceWorker(settings?: FcmSystemSettings): Promise<{ url: string } | null> {
    const raw = settings ?? (await this.readRaw());
    if (!raw?.webConfig) return null;
    const assetsUrl = await this.storage.getAssetsUrl();
    if (!assetsUrl) {
      this.logger.warn('[FCM] BMS_ASSETS_URL not configured — cannot publish platform sw.js');
      return null;
    }
    const bucket = await this.storage.getDefaultBucket();
    const trackerUrl = process.env.WEB_PUSH_TRACKER_URL || `${process.env.BMS_PUBLIC_URL ?? ''}/bms/events?platform=web-push`;
    const content = buildPlatformServiceWorker({ webConfig: raw.webConfig, trackerUrl });

    await this.storage.genericUpload(
      { name: PLATFORM_SW_FILENAME, ext: '.js', mime: 'application/javascript', content, hash: '', path: PLATFORM_SW_PATH, cacheControl: 'no-store' },
      PLATFORM_SW_FILENAME,
      PLATFORM_SW_PATH,
      bucket,
      true,
    );

    const url = `https://${assetsUrl}/${PLATFORM_SW_PATH}/${PLATFORM_SW_FILENAME}`;
    await this.purgeCdn(url).catch((err: any) => this.logger.warn(`[FCM] CDN purge failed (non-fatal): ${err?.message ?? 'unknown'}`));
    this.logger.log(`[FCM] platform service worker published: ${url}`);
    return { url };
  }

  private async purgeCdn(fileUrl: string): Promise<void> {
    if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_API_KEY) return;
    const url = `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`;
    await this.httpService
      .post(url, { files: [fileUrl] }, { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`, 'Content-Type': 'application/json' } })
      .toPromise();
  }

  // Exposes the platform web-push config (public values) for the SW generator.
  async getWebPushPlatformConfig(): Promise<{ webConfig: FcmSystemSettings['webConfig']; vapidPublicKey?: string } | null> {
    const raw = await this.readRaw();
    if (!raw) return null;
    return { webConfig: raw.webConfig, vapidPublicKey: raw.vapidPublicKey };
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
    // Web config + VAPID public key are client-side public values — safe to
    // return in full so the FCM tab can show/edit them.
    const webBits = { webConfig: raw.webConfig, vapidPublicKey: raw.vapidPublicKey };
    try {
      const parsed = JSON.parse(raw.serviceAccountJson);
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        hasPrivateKey: !!parsed.private_key,
        ...webBits,
      };
    } catch {
      return { hasPrivateKey: false, ...webBits };
    }
  }
}
