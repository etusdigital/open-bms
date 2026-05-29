import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { telemetry } from '@etus/telemetry-sdk';
import { SystemConfigEntity } from '../../entities/system-config.entity';
import { RoleEntity } from '../../entities/role.entity';
import { ROLE_CODES } from '../authz/authz.constants';
import { DEFAULT_ENDPOINT, HEARTBEAT_JITTER_MS, HEARTBEAT_PERIOD_MS, PRODUCT_NAME, TELEMETRY_STATE_KEY, TelemetryStateRecord } from './telemetry.constants';

interface AuthenticatedUserShape {
  email?: string;
  globalRoleId?: number;
}

@Injectable()
export class TelemetryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelemetryService.name);
  private initialized = false;
  private timer: NodeJS.Timeout | null = null;
  private superAdminRoleIdCache: number | null = null;
  private productVersion = '0.0.0';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SystemConfigEntity) private readonly systemConfigRepo: Repository<SystemConfigEntity>,
    @InjectRepository(RoleEntity) private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  // Called explicitly from main.ts before app.listen(), and again (idempotent)
  // from onApplicationBootstrap as a safety net.
  async initOnBootstrap(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      // require resolves relative to this file post-build (dist/modules/telemetry/),
      // which lands on dist/../../../package.json = apps/msgops-api/package.json.

      const pkg = require('../../../package.json') as { version?: string };
      this.productVersion = pkg.version || '0.0.0';
    } catch (e: any) {
      this.logger.warn(`could not read package.json version: ${e?.message}`);
      this.productVersion = '0.0.0';
    }

    const envEnabled = process.env.ETUS_TELEMETRY_ENABLED;
    // Default: opt-in unless explicitly set to 'false'.
    const optedIn = envEnabled === 'false' ? false : true;
    // Strip trailing slash(es): the SDK builds `${endpoint}/v1/events`, so a
    // trailing slash would yield `//v1/events` → 404 (and telemetry failures are
    // swallowed, so it would fail silently forever).
    const endpoint = (process.env.ETUS_TELEMETRY_ENDPOINT || DEFAULT_ENDPOINT).replace(/\/+$/, '');

    try {
      const result = telemetry.init({
        product: PRODUCT_NAME,
        version: this.productVersion,
        endpoint,
        optedIn,
      });
      this.logger.log(`telemetry init: enabled=${result.enabled} reason=${result.reason} endpoint=${endpoint}`);
    } catch (e: any) {
      this.logger.warn(`telemetry init failed: ${e?.message}`);
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.initOnBootstrap();
    if (!telemetry.isEnabled()) return;
    this.scheduleNextTick();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private nextDelayMs(): number {
    const jitter = Math.floor((Math.random() - 0.5) * 2 * HEARTBEAT_JITTER_MS);
    return HEARTBEAT_PERIOD_MS + jitter;
  }

  private scheduleNextTick(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.runHeartbeat()
        .catch((e) => this.logger.warn(`heartbeat error: ${e?.message}`))
        .finally(() => {
          if (telemetry.isEnabled()) this.scheduleNextTick();
        });
    }, this.nextDelayMs());
    // Don't keep the event loop alive just for telemetry.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  async runHeartbeat(): Promise<void> {
    if (!telemetry.isEnabled()) return;

    let status: 'ok' | 'error' = 'ok';
    try {
      const usage = await this.collectUsage();
      const result = await telemetry.heartbeat({
        runtime: 'node',
        runtime_version: process.versions.node,
        database: { engine: 'postgres', version_major: await this.detectPgVersionMajor() },
        usage,
      });
      if (!result || !result.ok) status = 'error';
    } catch (e: any) {
      status = 'error';
      this.logger.warn(`heartbeat threw: ${e?.message}`);
    }

    await this.patchState({
      last_heartbeat_at: new Date().toISOString(),
      last_heartbeat_status: status,
    }).catch(() => undefined);
  }

  // Emits the install lifecycle exactly once. ownerEmail is persisted LOCALLY
  // only — it is NEVER included in the payload sent to the telemetry server.
  async emitInstall(ownerEmail?: string | null): Promise<boolean> {
    if (ownerEmail) {
      await this.setOwnerEmail(ownerEmail).catch((e: any) => this.logger.warn(`setOwnerEmail in emitInstall failed: ${e?.message}`));
    }

    const claimed = await this.claimInstallEmission();
    if (!claimed) return false;

    if (!telemetry.isEnabled()) {
      // Persisted the claim but telemetry is off — that's fine; we still record
      // that we've "emitted" so we don't retry forever on next login.
      return true;
    }

    try {
      await telemetry.lifecycle({
        type: 'install',
        from_version: null,
        to_version: this.productVersion,
        feature: null,
      });
    } catch (e: any) {
      this.logger.warn(`install lifecycle send failed: ${e?.message}`);
    }
    return true;
  }

  async maybeBackfillInstall(user: AuthenticatedUserShape): Promise<void> {
    if (!user?.email || user.globalRoleId === undefined || user.globalRoleId === null) return;
    const superAdminRoleId = await this.getSuperAdminRoleId();
    if (superAdminRoleId == null || user.globalRoleId !== superAdminRoleId) return;
    // Skip cheap path: state already has install_emitted_at.
    const state = await this.readState();
    if (state?.install_emitted_at) return;
    await this.emitInstall(user.email);
  }

  async setOwnerEmail(email: string, em?: EntityManager): Promise<void> {
    // jsonb merge in a single statement — no read-modify-write race.
    // When called inside an external transaction (em provided), runs on that
    // connection so it commits atomically with the caller.
    const sql = `
      INSERT INTO system_config (key, value, updated_at)
      VALUES ($1, jsonb_build_object('account_owner_email', $2::text), NOW())
      ON CONFLICT (key) DO UPDATE
        SET value = COALESCE(system_config.value, '{}'::jsonb) || jsonb_build_object('account_owner_email', $2::text),
            updated_at = NOW()
    `;
    if (em) {
      await em.query(sql, [TELEMETRY_STATE_KEY, email]);
    } else {
      await this.dataSource.query(sql, [TELEMETRY_STATE_KEY, email]);
    }
  }

  async readState(): Promise<TelemetryStateRecord | null> {
    const row = await this.systemConfigRepo.findOne({ where: { key: TELEMETRY_STATE_KEY } });
    return (row?.value as TelemetryStateRecord | undefined) ?? null;
  }

  // Atomic claim: sets install_emitted_at only if it's not already set.
  // Returns true if THIS call won the claim.
  private async claimInstallEmission(): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.dataSource.query(
      `INSERT INTO system_config (key, value, updated_at)
       VALUES ($1, jsonb_build_object('install_emitted_at', $2::text), NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = COALESCE(system_config.value, '{}'::jsonb) || jsonb_build_object('install_emitted_at', $2::text),
             updated_at = NOW()
         WHERE (system_config.value->>'install_emitted_at') IS NULL
       RETURNING key`,
      [TELEMETRY_STATE_KEY, now],
    );
    return Array.isArray(result) && result.length > 0;
  }

  private async patchState(patch: Partial<TelemetryStateRecord>): Promise<void> {
    // jsonb merge in a single statement — no read-modify-write race between
    // concurrent heartbeat ticks or with setOwnerEmail.
    await this.dataSource.query(
      `INSERT INTO system_config (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = COALESCE(system_config.value, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()`,
      [TELEMETRY_STATE_KEY, JSON.stringify(patch)],
    );
  }

  private async getSuperAdminRoleId(): Promise<number | null> {
    if (this.superAdminRoleIdCache !== null) return this.superAdminRoleIdCache;
    const role = await this.roleRepo.findOne({ where: { code: ROLE_CODES.SUPER_ADMIN } });
    this.superAdminRoleIdCache = role?.id ?? null;
    return this.superAdminRoleIdCache;
  }

  private async collectUsage(): Promise<Record<string, number>> {
    try {
      const [users, accounts] = await Promise.all([
        this.dataSource.query(`SELECT COUNT(*)::int AS c FROM users WHERE deleted_at IS NULL`).then((r: any) => r[0]?.c ?? 0),
        this.dataSource.query(`SELECT COUNT(*)::int AS c FROM accounts WHERE deleted_at IS NULL`).then((r: any) => r[0]?.c ?? 0),
      ]);
      return { active_users: users, accounts };
    } catch (e: any) {
      this.logger.warn(`collectUsage failed (heartbeat will report empty usage): ${e?.message}`);
      return {};
    }
  }

  private async detectPgVersionMajor(): Promise<string> {
    try {
      const r = await this.dataSource.query(`SHOW server_version_num`);
      const num = parseInt(r?.[0]?.server_version_num || '0', 10);
      if (!num) return 'unknown';
      // server_version_num: NNNNNN — e.g. 160003 → 16
      return String(Math.floor(num / 10000));
    } catch (e: any) {
      this.logger.warn(`detectPgVersionMajor failed: ${e?.message}`);
      return 'unknown';
    }
  }
}
