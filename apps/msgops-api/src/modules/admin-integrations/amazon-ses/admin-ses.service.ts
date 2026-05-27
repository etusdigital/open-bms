import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import { SystemConfigEntity } from '../../../entities/system-config.entity';
import { SystemConfigCacheProvider } from '../../../providers/system-config-cache.provider';
import { maskCredential } from '../../../lib/geoip-config-file';
import { SesSystemSettings, sesEnvFilePath, writeSesEnvFile } from '../../../lib/integrations-config-file';
import { enforceTestRateLimit } from '../../../lib/test-rate-limit';
import { SesSystemSettingsDto, SesTestConnectionDto, sesSystemSettingsSaveSchema, sesTestConnectionSchema } from './dtos/ses-system-settings.dto';

export const SES_KEY = 'ses_system_settings';

export interface SesAdminSettings {
  accessKeyIdMasked?: string;
  secretAccessKeyMasked?: string;
  region?: string;
  webhookSnsTopicArn?: string;
  metadata?: { hasFreeTier: boolean; hasWebhook: boolean; notes: string };
}

const PROVIDER_METADATA = {
  hasFreeTier: false,
  hasWebhook: true,
  notes: 'No free tier perpetuum. 62000/mês exige rodar em EC2 (Free Tier do EC2). Fora EC2: $0.10 por 1000 emails enviados (verificado 2026-05).',
};

@Injectable()
export class AdminSesService implements OnModuleInit {
  private readonly logger = new Logger(AdminSesService.name);
  private readonly testHits = new Map<string, number[]>();

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    private readonly cache: SystemConfigCacheProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    if (existsSync(sesEnvFilePath())) return;
    const raw = await this.readRaw();
    if (!raw) return;
    try {
      writeSesEnvFile(raw);
      this.logger.log(`[SES] bootstrapped ${sesEnvFilePath()} from system_config`);
    } catch (err: any) {
      this.logger.warn(`[SES] could not write env file: ${err?.message ?? 'unknown'}`);
    }
  }

  async getSettings(): Promise<SesAdminSettings | null> {
    const raw = await this.readRaw();
    if (!raw) return null;
    return this.toPublic(raw);
  }

  async saveSettings(payload: SesSystemSettingsDto): Promise<SesAdminSettings> {
    const existing = await this.readRaw();
    const merged: SesSystemSettings = {
      accessKeyId: payload.accessKeyId ?? existing?.accessKeyId ?? '',
      secretAccessKey: payload.secretAccessKey ?? existing?.secretAccessKey ?? '',
      region: payload.region ?? existing?.region ?? '',
      webhookSnsTopicArn: payload.webhookSnsTopicArn ?? existing?.webhookSnsTopicArn,
    };

    const { value, error } = sesSystemSettingsSaveSchema.validate(merged, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const finalValue = value as SesSystemSettings;
    await this.repo.save(this.repo.create({ key: SES_KEY, value: finalValue as unknown as Record<string, unknown> }));
    await this.cache.invalidate(SES_KEY);

    try {
      writeSesEnvFile(finalValue);
    } catch (err: any) {
      this.logger.warn(`[SES] could not write env file: ${err?.message ?? 'unknown'}`);
    }

    return this.toPublic(finalValue);
  }

  async testConnection(payload: SesTestConnectionDto, requesterIp?: string): Promise<{ ok: boolean; errorMessage?: string }> {
    enforceTestRateLimit(this.testHits, `ses:${requesterIp ?? 'unknown'}`, 'Amazon SES');

    const { value, error } = sesTestConnectionSchema.validate(payload, { abortEarly: false, stripUnknown: true });
    if (error) throw new BadRequestException(error.details.map((d) => d.message).join('; '));

    const existing = await this.readRaw();
    const v = value as SesTestConnectionDto;
    const accessKeyId = v.accessKeyId ?? existing?.accessKeyId;
    const secretAccessKey = v.secretAccessKey ?? existing?.secretAccessKey;
    const region = v.region ?? existing?.region;
    if (!accessKeyId || !secretAccessKey || !region) {
      return { ok: false, errorMessage: 'accessKeyId, secretAccessKey e region são obrigatórios.' };
    }

    try {
      // Lazy-import to keep test isolation simple — admin-msgops-api process
      // doesn't otherwise need the SES SDK on its hot path.
      const { SESv2Client, GetAccountCommand } = await import('@aws-sdk/client-sesv2');
      const client = new SESv2Client({ region, credentials: { accessKeyId, secretAccessKey } });
      const result = await client.send(new GetAccountCommand({}));
      // GetAccount returns ProductionAccessEnabled / SendingEnabled flags;
      // surface the most actionable one so super-admins know if their account
      // is still sandboxed.
      if (result?.SendingEnabled === false) {
        return { ok: false, errorMessage: 'SES SendingEnabled=false (conta pausada ou em sandbox).' };
      }
      return { ok: true };
    } catch (err: any) {
      const message = err?.name === 'UnrecognizedClientException' ? 'Credenciais inválidas.' : (err?.message ?? 'erro desconhecido');
      return { ok: false, errorMessage: String(message).slice(0, 150) };
    }
  }

  private async readRaw(): Promise<SesSystemSettings | null> {
    return (await this.cache.get<SesSystemSettings>(SES_KEY)) ?? null;
  }

  private toPublic(raw: SesSystemSettings): SesAdminSettings {
    return {
      accessKeyIdMasked: maskCredential(raw.accessKeyId),
      secretAccessKeyMasked: maskCredential(raw.secretAccessKey),
      region: raw.region,
      webhookSnsTopicArn: raw.webhookSnsTopicArn,
      metadata: PROVIDER_METADATA,
    };
  }
}
