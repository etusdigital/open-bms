import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { maskCredential } from '../../../lib/geoip-config-file';
import { S3SystemSettings, s3EnvFilePath, writeS3EnvFile } from '../../../lib/integrations-config-file';
import { enforceTestRateLimit } from '../../../lib/test-rate-limit';
import { S3SettingsDto, S3TestConnectionDto, s3SettingsSaveSchema, s3TestConnectionSchema } from './dtos/s3-settings.dto';

export const S3_KEY = 's3_settings';

export interface S3AdminSettings {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKeyMasked?: string;
  useObjectAcls?: boolean;
  assetsUrl?: string;
}

@Injectable()
export class AdminS3Service implements OnModuleInit {
  private readonly logger = new Logger(AdminS3Service.name);
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (existsSync(s3EnvFilePath())) return;
    const raw = await this.readRaw();
    if (!raw) return;
    try {
      writeS3EnvFile(raw);
      this.logger.log(`[S3] bootstrapped ${s3EnvFilePath()} from system_config`);
    } catch (err: any) {
      this.logger.warn(`[S3] could not write env file: ${err?.message ?? 'unknown'}`);
    }
  }

  async getSettings(): Promise<S3AdminSettings | null> {
    const raw = await this.readRaw();
    if (!raw) return null;
    return this.toPublic(raw);
  }

  async saveSettings(payload: S3SettingsDto): Promise<S3AdminSettings> {
    const existing = await this.readRaw();

    const merged: S3SystemSettings = {
      endpoint: payload.endpoint,
      region: payload.region,
      bucket: payload.bucket,
      accessKeyId: payload.accessKeyId,
      secretAccessKey: payload.secretAccessKey ?? existing?.secretAccessKey ?? '',
      useObjectAcls: payload.useObjectAcls,
      assetsUrl: payload.assetsUrl,
    };

    // Refuse silent reuse when the endpoint changed — operator must supply
    // fresh credentials or we'd be saving stale secret against a new endpoint.
    if (existing && existing.endpoint !== merged.endpoint && !payload.secretAccessKey) {
      throw new BadRequestException('Trocar de endpoint exige novas credenciais (secretAccessKey).');
    }

    const { value, error } = s3SettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as S3SystemSettings;
    if (!finalValue.secretAccessKey) {
      throw new BadRequestException('secretAccessKey é obrigatório na primeira configuração.');
    }

    await this.repo.save(this.repo.create({ key: S3_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(S3_KEY);

    try {
      writeS3EnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[S3] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    return this.toPublic(finalValue);
  }

  async testConnection(payload: S3TestConnectionDto, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.testHits, `s3:${requesterIp ?? 'unknown'}`, 'S3');

    const { value, error } = s3TestConnectionSchema.validate(payload, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const existing = await this.readRaw();
    const v = value as S3TestConnectionDto;
    const config = {
      endpoint: v.endpoint ?? existing?.endpoint,
      region: v.region ?? existing?.region ?? 'us-east-1',
      bucket: v.bucket ?? existing?.bucket,
      accessKeyId: v.accessKeyId ?? existing?.accessKeyId,
      secretAccessKey: v.secretAccessKey ?? existing?.secretAccessKey,
    };
    if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
      return { ok: false, errorMessage: 'Configuração incompleta — informe credenciais e bucket.' };
    }

    try {
      const client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        forcePathStyle: !!config.endpoint,
      });
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
      return { ok: true };
    } catch (err: any) {
      const msg: string = err?.message ?? 'erro desconhecido';
      return { ok: false, errorMessage: msg.slice(0, 150) };
    }
  }

  private async readRaw(): Promise<S3SystemSettings | null> {
    const cached = await this.cache.get<S3SystemSettings>(S3_KEY);
    return cached ?? null;
  }

  private toPublic(raw: S3SystemSettings): S3AdminSettings {
    return {
      endpoint: raw.endpoint,
      region: raw.region,
      bucket: raw.bucket,
      accessKeyId: raw.accessKeyId,
      secretAccessKeyMasked: maskCredential(raw.secretAccessKey),
      useObjectAcls: raw.useObjectAcls,
      assetsUrl: raw.assetsUrl,
    };
  }
}
