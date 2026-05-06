import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, lastValueFrom, timeout } from 'rxjs';
import { Repository } from 'typeorm';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { RedisService } from '../../providers/redis.provider';
import { GeoIpStatusResponseDto } from './dtos/geoip-status-response.dto';
import { geoIpSettingsSchema, type GeoIpMode, type GeoIpProvider, type GeoIpSettingsDto } from '../setup/dtos/geoip-settings.dto';
import { maskCredential, writeGeoIpEnvFile } from '../../lib/geoip-config-file';

export interface GeoIpAdminSettings {
  mode: GeoIpMode;
  provider?: GeoIpProvider;
  apiKeyMasked?: string;
  accountId?: string;
  hasLicenseKey?: boolean;
}

export interface GeoIpAdminSavePayload {
  mode: GeoIpMode;
  provider?: GeoIpProvider;
  apiKey?: string;
  accountId?: string;
  licenseKey?: string;
}

const GEOIP_KEY = 'geoip_settings';
const STATUS_RPC_TIMEOUT_MS = 2000;

interface StatusRpcResponse {
  tier: string;
  mmdbPath?: string;
  mmdb_path?: string;
  mmdbSizeBytes?: number;
  mmdb_size_bytes?: number;
  mmdbMtimeMs?: number;
  mmdb_mtime_ms?: number;
  lastReloadAt?: string;
  last_reload_at?: string;
  lookupCount?: number;
  lookup_count?: number;
  ready: boolean;
}

interface GeoIpServiceClient {
  getStatus(req: Record<string, never>): Observable<StatusRpcResponse>;
}

@Injectable()
export class AdminGeoIpService implements OnModuleInit {
  private readonly logger = new Logger(AdminGeoIpService.name);
  private geoIpClient: GeoIpServiceClient | null = null;

  constructor(
    @Inject('GEO_GRPC_CLIENT_ADMIN') private readonly grpcClient: ClientGrpc,
    @InjectRepository(SystemConfigEntity)
    private readonly systemConfigRepo: Repository<SystemConfigEntity>,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    this.geoIpClient = this.grpcClient.getService<GeoIpServiceClient>('GeoIpService');
  }

  async getStatus(): Promise<GeoIpStatusResponseDto> {
    const [settings, runtime, cache] = await Promise.all([this.readStatusSettings(), this.readRuntime(), this.readCacheStats()]);
    return { settings, runtime, cache };
  }

  async getSettings(): Promise<GeoIpAdminSettings | null> {
    const raw = await this.readRawSettings();
    if (!raw) return null;
    return this.toPublicSettings(raw);
  }

  async saveSettings(payload: GeoIpAdminSavePayload): Promise<GeoIpAdminSettings> {
    const existing = await this.readRawSettings();

    // Merge: keep existing credentials when the provider is unchanged and
    // the caller did not supply a replacement. Switching provider resets
    // all credentials — the caller must supply new ones.
    const sameProvider = existing?.mode === 'advanced' && existing?.provider === payload.provider;
    const merged: GeoIpSettingsDto = {
      mode: payload.mode,
      provider: payload.provider,
      apiKey: payload.apiKey || (sameProvider ? (existing?.apiKey as string | undefined) : undefined),
      accountId: payload.accountId || (sameProvider ? (existing?.accountId as string | undefined) : undefined),
      licenseKey: payload.licenseKey || (sameProvider ? (existing?.licenseKey as string | undefined) : undefined),
    };

    const { value, error } = geoIpSettingsSchema.validate(merged, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      throw new BadRequestException(error.details.map((d) => d.message).join('; '));
    }

    await this.systemConfigRepo.save(this.systemConfigRepo.create({ key: GEOIP_KEY, value: value as Record<string, unknown> }));

    try {
      writeGeoIpEnvFile(value as GeoIpSettingsDto);
    } catch (err: any) {
      this.logger.warn(`[GeoIP] could not write env file: ${err?.message}`);
    }

    return this.toPublicSettings(value as GeoIpSettingsDto);
  }

  private async readRawSettings(): Promise<GeoIpSettingsDto | null> {
    const cfg = await this.systemConfigRepo.findOne({ where: { key: GEOIP_KEY } });
    if (!cfg?.value) return null;
    return cfg.value as unknown as GeoIpSettingsDto;
  }

  private toPublicSettings(raw: GeoIpSettingsDto): GeoIpAdminSettings {
    const result: GeoIpAdminSettings = { mode: raw.mode, provider: raw.provider };
    if (raw.provider && ['dbip-full', 'ip-api', 'ipinfo'].includes(raw.provider)) {
      result.apiKeyMasked = maskCredential(raw.apiKey);
    }
    if (raw.provider === 'maxmind') {
      result.accountId = raw.accountId;
      result.hasLicenseKey = !!raw.licenseKey;
    }
    return result;
  }

  private async readStatusSettings(): Promise<GeoIpStatusResponseDto['settings']> {
    const cfg = await this.systemConfigRepo.findOne({ where: { key: GEOIP_KEY } });
    if (!cfg?.value) return null;
    const v = cfg.value as Record<string, unknown>;
    return {
      mode: (v.mode as 'disabled' | 'lite' | 'advanced') ?? 'lite',
      provider: v.provider as GeoIpStatusResponseDto['settings'] extends infer S ? (S extends { provider?: infer P } ? P : never) : never,
    };
  }

  private async readRuntime(): Promise<GeoIpStatusResponseDto['runtime']> {
    if (!this.geoIpClient) return null;
    try {
      const raw = await lastValueFrom(this.geoIpClient.getStatus({}).pipe(timeout(STATUS_RPC_TIMEOUT_MS)));
      return {
        tier: raw.tier,
        mmdbPath: (raw.mmdbPath ?? raw.mmdb_path ?? '') as string,
        mmdbSizeBytes: Number(raw.mmdbSizeBytes ?? raw.mmdb_size_bytes ?? 0),
        mmdbMtimeMs: Number(raw.mmdbMtimeMs ?? raw.mmdb_mtime_ms ?? 0),
        lastReloadAt: (raw.lastReloadAt ?? raw.last_reload_at ?? '') as string,
        lookupCount: Number(raw.lookupCount ?? raw.lookup_count ?? 0),
        ready: !!raw.ready,
      };
    } catch (error) {
      this.logger.warn(`geoip_status_rpc_failed err=${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  // Best-effort cache stats. SCAN with MATCH on the geo:lookup:v1:* prefix
  // gives an approximate count without blocking Redis.
  private async readCacheStats(): Promise<GeoIpStatusResponseDto['cache']> {
    const enabled = process.env.GEO_CACHE_ENABLED !== 'false';
    if (!enabled) return { enabled: false, keyCount: 0 };

    try {
      const client = this.redisService.getClient();
      let cursor = '0';
      let count = 0;
      do {
        const [next, batch] = await client.scan(cursor, 'MATCH', 'geo:lookup:v1:*', 'COUNT', 1000);
        cursor = next;
        count += batch.length;
        // Cap traversal — a busy cluster shouldn't pay 100k iterations for an
        // approximate gauge.
        if (count > 100_000) break;
      } while (cursor !== '0');
      return { enabled: true, keyCount: count };
    } catch (error) {
      this.logger.warn(`geoip_cache_scan_failed err=${error instanceof Error ? error.message : String(error)}`);
      return { enabled: true, keyCount: 0 };
    }
  }
}
