import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../providers/redis.provider';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { AccountApiKeyEntity } from '../../entities/account-api-key.entity';
import { ApiKeyAuditLogEntity } from '../../entities/api-key-audit-log.entity';
import { RoleEntity } from '../../entities/role.entity';
import { AccountCacheService } from './account-cache.service';
import { SendgridHandler } from '../../handlers/email/sendgrid/sendgrid.handler';
import { AccountsService } from './accounts.service';
import { ROLE_CODES } from '../authz/authz.constants';

export interface KeyStatus {
  isExpired: boolean;
  expiresAt: string | null;
}

export interface ApiKeyRegenRequestMeta {
  userId: number;
  userEmail: string;
  userName: string;
  ip: string;
  userAgent: string;
}

@Injectable()
export class ApiKeyRegenService {
  private readonly TOKEN_TTL = 900; // 15 minutes
  private readonly RATE_LIMIT_SECONDS = 120; // 2 minutes

  constructor(
    @InjectRepository(AccountConfigEntity)
    private readonly accountConfigRepository: Repository<AccountConfigEntity>,
    @InjectRepository(AccountApiKeyEntity)
    private readonly accountApiKeyRepository: Repository<AccountApiKeyEntity>,
    @InjectRepository(ApiKeyAuditLogEntity)
    private readonly auditLogRepository: Repository<ApiKeyAuditLogEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    private readonly redisService: RedisService,
    private readonly accountCacheService: AccountCacheService,
    private readonly sendgridHandler: SendgridHandler,
    private readonly accountsService: AccountsService,
  ) {}

  private hashApiKey(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  private getRedisKey(accountId: number, keyType: string): string {
    return `apikey-regen:${accountId}:${keyType}`;
  }

  async requestRegeneration(
    accountId: number,
    keyType: 'api_key' | 'api_key_tracker',
    userEmail: string,
    userName: string,
    meta: ApiKeyRegenRequestMeta,
    expiresAt?: string | null,
  ): Promise<void> {
    const redisClient = this.redisService.getClient();
    const redisKey = this.getRedisKey(accountId, keyType);

    // Rate limiting: check if a token already exists and is within the cooldown period
    const existingToken = await redisClient.get(redisKey);
    if (existingToken) {
      const ttl = await redisClient.ttl(redisKey);
      const elapsed = this.TOKEN_TTL - ttl;
      if (elapsed < this.RATE_LIMIT_SECONDS) {
        await this.writeAuditLog(accountId, meta, 'RATE_LIMITED', keyType, null, false);
        throw new HttpException('Aguarde o token atual expirar antes de solicitar outro', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // Generate cryptographically secure token
    const token = randomBytes(32).toString('hex');

    // Store token in Redis with TTL
    await redisClient.set(redisKey, token, 'EX', this.TOKEN_TTL);

    // Store the requester IP alongside the token for audit comparison on confirm
    await redisClient.set(`${redisKey}:ip`, meta.ip, 'EX', this.TOKEN_TTL);

    // Store the chosen expiration date (null = never expires)
    await redisClient.set(`${redisKey}:expiresAt`, expiresAt || 'never', 'EX', this.TOKEN_TTL);

    // Audit log
    await this.writeAuditLog(accountId, meta, 'REQUEST', keyType, token, true, { expiresAt: expiresAt || 'never' });

    // Send confirmation email
    await this.sendConfirmationEmail(accountId, keyType, token, userEmail, userName);
  }

  async confirmRegeneration(
    accountId: number,
    keyType: 'api_key' | 'api_key_tracker',
    token: string,
    meta: ApiKeyRegenRequestMeta,
  ): Promise<{ newKey: string; expiresAt: string | null }> {
    const redisClient = this.redisService.getClient();
    const redisKey = this.getRedisKey(accountId, keyType);

    // Read token from Redis
    const storedToken = await redisClient.get(redisKey);

    if (!storedToken) {
      await this.writeAuditLog(accountId, meta, 'CONFIRM_EXPIRED', keyType, token, false);
      throw new HttpException('Token expirado', HttpStatus.GONE);
    }

    // Timing-safe comparison
    const tokenBuffer = Buffer.from(token, 'hex');
    const storedBuffer = Buffer.from(storedToken, 'hex');

    if (tokenBuffer.length !== storedBuffer.length || !timingSafeEqual(tokenBuffer, storedBuffer)) {
      await this.writeAuditLog(accountId, meta, 'CONFIRM_INVALID', keyType, token, false);
      throw new HttpException('Token inválido', HttpStatus.BAD_REQUEST);
    }

    // Check if confirm IP differs from request IP (not blocking, just auditing)
    const requestIp = await redisClient.get(`${redisKey}:ip`);
    const ipMismatch = requestIp && requestIp !== meta.ip;

    // Get old key prefix for traceability (from legacy accounts_configs)
    const oldKeyConfig = await this.accountConfigRepository.findOne({ where: { accountId, name: keyType } });
    const oldKeyPrefix = oldKeyConfig?.value?.substring(0, 8) || 'unknown';

    // Generate new cryptographically secure API key
    const newKey = `mk_${randomBytes(24).toString('hex')}`;

    // Read the chosen expiration from Redis
    const storedExpiresAt = await redisClient.get(`${redisKey}:expiresAt`);
    let expiresAtDate: Date | null = null;

    if (storedExpiresAt && storedExpiresAt !== 'never') {
      expiresAtDate = new Date(storedExpiresAt);
    }

    // Invalidate downstream caches
    await this.accountCacheService.invalidateAccountCache(accountId);

    // 1. Revoke any existing managed keys for this account with same source
    await this.accountApiKeyRepository.update({ accountId, source: 'regenerated', status: 'active' }, { status: 'revoked', revokedAt: new Date() });

    // 2. Create new managed API key in accounts_api_keys
    const role = await this.roleRepository.findOne({ where: { code: ROLE_CODES.ADMIN } });
    const newApiKeyEntity = this.accountApiKeyRepository.create({
      accountId,
      name: `${keyType} (regenerated)`,
      keyHash: this.hashApiKey(newKey),
      roleId: role.id,
      status: 'active',
      source: 'regenerated',
      expiresAt: expiresAtDate,
      createdByUserId: meta.userId || null,
    });
    await this.accountApiKeyRepository.save(newApiKeyEntity);

    // 3. Store key hash in legacy accounts_configs (no plaintext — only hash for backward compat)
    await this.accountConfigRepository.update({ accountId, name: keyType }, { value: this.hashApiKey(newKey) });

    // 4. Set/update/remove expiration in accounts_configs (backward compat)
    const expiresAtConfigName = `${keyType}_expires_at`;
    const existingExpiresConfig = await this.accountConfigRepository.findOne({
      where: { accountId, name: expiresAtConfigName },
    });

    if (expiresAtDate) {
      const expiresAtIso = expiresAtDate.toISOString();
      if (existingExpiresConfig) {
        await this.accountConfigRepository.update({ accountId, name: expiresAtConfigName }, { value: expiresAtIso });
      } else {
        await this.accountConfigRepository.save({ accountId, name: expiresAtConfigName, value: expiresAtIso });
      }
    } else {
      if (existingExpiresConfig) {
        await this.accountConfigRepository.delete({ accountId, name: expiresAtConfigName });
      }
    }

    const expiresAtIso = expiresAtDate ? expiresAtDate.toISOString() : null;

    // Audit log
    await this.writeAuditLog(accountId, meta, 'CONFIRM', keyType, token, true, {
      oldKeyPrefix,
      newKeyPrefix: newKey.substring(0, 8),
      requestIp: requestIp || null,
      ipMismatch: !!ipMismatch,
      expiresAt: expiresAtIso || 'never',
      managedKeyId: newApiKeyEntity.id,
    });

    // Delete the used token, IP, and expiresAt from Redis
    await redisClient.del(redisKey, `${redisKey}:ip`, `${redisKey}:expiresAt`);

    return { newKey, expiresAt: expiresAtIso };
  }

  async getKeyStatus(accountId: number): Promise<{
    api_key: KeyStatus;
    api_key_tracker: KeyStatus;
  }> {
    const [apiKeyStatus, trackerStatus] = await Promise.all([this.getStatusForKeyType(accountId, 'api_key'), this.getStatusForKeyType(accountId, 'api_key_tracker')]);

    return {
      api_key: apiKeyStatus,
      api_key_tracker: trackerStatus,
    };
  }

  private async getStatusForKeyType(accountId: number, keyType: string): Promise<KeyStatus> {
    // First check accounts_api_keys for a regenerated key
    const managedKey = await this.accountApiKeyRepository.findOne({
      where: { accountId, source: 'regenerated', name: `${keyType} (regenerated)`, status: 'active' },
      order: { id: 'DESC' },
    });

    if (managedKey) {
      if (!managedKey.expiresAt) {
        return { isExpired: false, expiresAt: null };
      }
      const isExpired = new Date(managedKey.expiresAt) <= new Date();
      return { isExpired, expiresAt: managedKey.expiresAt.toISOString() };
    }

    // Fallback to legacy accounts_configs
    const expiresAtConfig = await this.accountConfigRepository.findOne({
      where: { accountId, name: `${keyType}_expires_at` },
    });

    if (!expiresAtConfig) {
      return { isExpired: false, expiresAt: null };
    }

    const expiresAt = expiresAtConfig.value;
    const isExpired = new Date(expiresAt) <= new Date();

    return { isExpired, expiresAt };
  }

  private async writeAuditLog(
    accountId: number,
    meta: ApiKeyRegenRequestMeta,
    action: string,
    keyType: string,
    token: string | null,
    success: boolean,
    extraMetadata?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.auditLogRepository.save({
        accountId,
        userId: meta.userId,
        userEmail: meta.userEmail,
        action,
        keyType,
        token,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        oldKeyPrefix: extraMetadata?.oldKeyPrefix || null,
        newKeyPrefix: extraMetadata?.newKeyPrefix || null,
        success,
        metadata: extraMetadata || null,
      });
    } catch (error) {
      console.error(`[ApiKeyRegen] Failed to write audit log:`, error);
    }
  }

  private async sendConfirmationEmail(accountId: number, keyType: string, token: string, userEmail: string, userName: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const confirmationLink = `${frontendUrl}/settings?token=${token}&keyType=${keyType}`;
    const keyLabel = keyType === 'api_key' ? 'API Key' : 'API Key Tracker';

    const account = await this.accountsService.findOne(accountId);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Confirmação de Nova ${keyLabel}</h2>
        <p>Olá ${userName || ''},</p>
        <p>Recebemos uma solicitação para gerar uma nova <strong>${keyLabel}</strong> para a conta <strong>${account?.name || accountId}</strong>.</p>
        <p>Clique no botão abaixo para confirmar a geração da nova chave:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmationLink}"
             style="background-color: #4F46E5; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Confirmar Nova ${keyLabel}
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">Este link expira em <strong>15 minutos</strong>.</p>
        <p style="color: #666; font-size: 14px;">Se você não solicitou esta alteração, ignore este e-mail. Sua chave atual continuará funcionando normalmente.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">Este é um e-mail automático enviado pela plataforma BMS. Caso não queria receber este tipo de e-mail <a href="[unsubscribe_link]" style="color: #4F46E5; text-decoration: underline;">clique aqui</a>.</p>
      </div>
    `;

    const fromName = process.env.TRANSACTIONAL_FROM_NAME || 'MsgOps';
    const fromEmail = process.env.TRANSACTIONAL_FROM_EMAIL || 'noreply@msgops.com';
    const subject = `Confirmação de Nova ${keyLabel}`;

    try {
      await this.sendgridHandler.sendInternalEmail([userEmail], fromName, fromEmail, subject, htmlContent);
    } catch (error) {
      console.error(`[ApiKeyRegen] Failed to send confirmation email for account ${accountId}:`, error);
      throw new HttpException('Erro ao enviar e-mail de confirmação', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
