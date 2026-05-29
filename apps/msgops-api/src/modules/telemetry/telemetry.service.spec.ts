import { telemetry } from '@etus/telemetry-sdk';
import { TelemetryService } from './telemetry.service';
import { ROLE_CODES } from '../authz/authz.constants';

jest.mock('@etus/telemetry-sdk', () => {
  const state = { enabled: true };
  return {
    telemetry: {
      init: jest.fn(({ optedIn }) => {
        state.enabled = optedIn !== false;
        return { enabled: state.enabled, reason: 'config_enabled' };
      }),
      isEnabled: jest.fn(() => state.enabled),
      heartbeat: jest.fn().mockResolvedValue({ ok: true, attempt: 1 }),
      lifecycle: jest.fn().mockResolvedValue({ ok: true, attempt: 1 }),
      __reset: jest.fn(() => {
        state.enabled = true;
      }),
    },
  };
});

const mockedTelemetry = telemetry as jest.Mocked<typeof telemetry>;

function buildService(overrides: Partial<{ stateRow: any; claimAffected: number; superAdminRoleId: number }> = {}) {
  const systemConfigRepo = {
    findOne: jest.fn().mockResolvedValue(overrides.stateRow ?? null),
    save: jest.fn(async (x: any) => x),
    create: jest.fn((x: any) => x),
  };
  const roleRepo = {
    findOne: jest.fn().mockResolvedValue(overrides.superAdminRoleId != null ? { id: overrides.superAdminRoleId, code: ROLE_CODES.SUPER_ADMIN } : null),
  };
  const dataSource = {
    query: jest.fn(async (sql: string) => {
      // Distinguish the install claim (RETURNING key) from setOwnerEmail/patchState
      // (no RETURNING) so the no-claim branch can return [] without breaking writes.
      if (sql.includes('RETURNING key')) {
        return overrides.claimAffected === 0 ? [] : [{ key: 'telemetry_state' }];
      }
      if (sql.includes('INSERT INTO system_config')) return [];
      if (sql.includes('FROM users')) return [{ c: 7 }];
      if (sql.includes('FROM accounts')) return [{ c: 3 }];
      if (sql.includes('FROM contacts')) return [{ c: 1000 }];
      if (sql.includes('FROM campaigns')) return [{ c: 12 }];
      if (sql.includes('FROM messages')) return [{ c: 40 }];
      if (sql.includes('FROM automations')) return [{ c: 2 }];
      if (sql.includes('FROM tags')) return [{ c: 9 }];
      if (sql.includes('FROM emails_templates')) return [{ c: 4 }];
      if (sql.includes('FROM whatsapp_channels')) return [{ c: 1 }];
      if (sql.includes('FROM whatsapp_message_sends')) return [{ c: 5 }];
      if (sql.includes('server_version_num')) return [{ server_version_num: '160003' }];
      return [];
    }),
  };

  const service = Object.create(TelemetryService.prototype) as TelemetryService;
  (service as any).logger = { log: jest.fn(), warn: jest.fn() };
  (service as any).systemConfigRepo = systemConfigRepo;
  (service as any).roleRepo = roleRepo;
  (service as any).dataSource = dataSource;
  (service as any).superAdminRoleIdCache = null;
  (service as any).initialized = false;
  (service as any).productVersion = '1.2.3';
  return { service, systemConfigRepo, roleRepo, dataSource };
}

describe('TelemetryService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedTelemetry.__reset();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ETUS_TELEMETRY_ENABLED;
    delete process.env.DO_NOT_TRACK;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('initOnBootstrap', () => {
    it('inits with optedIn=true by default', async () => {
      const { service } = buildService();
      await service.initOnBootstrap();
      expect(mockedTelemetry.init).toHaveBeenCalledWith(expect.objectContaining({ product: 'open-bms', optedIn: true }));
    });

    it('inits with optedIn=false when ETUS_TELEMETRY_ENABLED=false', async () => {
      process.env.ETUS_TELEMETRY_ENABLED = 'false';
      const { service } = buildService();
      await service.initOnBootstrap();
      expect(mockedTelemetry.init).toHaveBeenCalledWith(expect.objectContaining({ optedIn: false }));
      expect(mockedTelemetry.isEnabled()).toBe(false);
    });

    it('is idempotent', async () => {
      const { service } = buildService();
      await service.initOnBootstrap();
      await service.initOnBootstrap();
      expect(mockedTelemetry.init).toHaveBeenCalledTimes(1);
    });

    it('does not throw when SDK init fails', async () => {
      (mockedTelemetry.init as jest.Mock).mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const { service } = buildService();
      await expect(service.initOnBootstrap()).resolves.not.toThrow();
    });
  });

  describe('emitInstall', () => {
    it('emits lifecycle once when not yet emitted', async () => {
      const { service } = buildService({ claimAffected: 1 });
      const result = await service.emitInstall('owner@example.com');
      expect(result).toBe(true);
      expect(mockedTelemetry.lifecycle).toHaveBeenCalledTimes(1);
      expect(mockedTelemetry.lifecycle).toHaveBeenCalledWith(expect.objectContaining({ type: 'install' }));
    });

    it('is idempotent: no-op when install_emitted_at is already set', async () => {
      const { service } = buildService({ claimAffected: 0 });
      const result = await service.emitInstall('owner@example.com');
      expect(result).toBe(false);
      expect(mockedTelemetry.lifecycle).not.toHaveBeenCalled();
    });

    it('still persists when telemetry is disabled, but does not call lifecycle', async () => {
      (mockedTelemetry.isEnabled as jest.Mock).mockReturnValueOnce(false);
      const { service } = buildService({ claimAffected: 1 });
      const result = await service.emitInstall('owner@example.com');
      expect(result).toBe(true);
      expect(mockedTelemetry.lifecycle).not.toHaveBeenCalled();
    });
  });

  describe('maybeBackfillInstall', () => {
    it('is no-op for non-super-admin user', async () => {
      const { service } = buildService({ superAdminRoleId: 1 });
      await service.maybeBackfillInstall({ email: 'editor@example.com', globalRoleId: 2 });
      expect(mockedTelemetry.lifecycle).not.toHaveBeenCalled();
    });

    it('is no-op when install_emitted_at already set', async () => {
      const { service } = buildService({ superAdminRoleId: 1, stateRow: { value: { install_emitted_at: '2026-01-01T00:00:00Z' } } });
      await service.maybeBackfillInstall({ email: 'admin@example.com', globalRoleId: 1 });
      expect(mockedTelemetry.lifecycle).not.toHaveBeenCalled();
    });

    it('emits when super-admin and not yet emitted', async () => {
      const { service } = buildService({ superAdminRoleId: 1, claimAffected: 1 });
      await service.maybeBackfillInstall({ email: 'admin@example.com', globalRoleId: 1 });
      expect(mockedTelemetry.lifecycle).toHaveBeenCalledTimes(1);
    });

    it('skips when user.email is missing', async () => {
      const { service } = buildService({ superAdminRoleId: 1 });
      await service.maybeBackfillInstall({ email: undefined, globalRoleId: 1 });
      expect(mockedTelemetry.lifecycle).not.toHaveBeenCalled();
    });
  });

  describe('runHeartbeat', () => {
    function findPatchCall(dataSource: any): any | undefined {
      const patchCall = (dataSource.query as jest.Mock).mock.calls.find(([sql]: [string]) => sql.includes('INSERT INTO system_config') && !sql.includes('RETURNING key'));
      if (!patchCall) return undefined;
      try {
        return JSON.parse(patchCall[1][1]);
      } catch {
        return undefined;
      }
    }

    it('persists last_heartbeat_status=ok on success', async () => {
      const { service, dataSource } = buildService();
      await service.runHeartbeat();
      expect(mockedTelemetry.heartbeat).toHaveBeenCalled();
      const patch = findPatchCall(dataSource);
      expect(patch?.last_heartbeat_status).toBe('ok');
    });

    it('persists last_heartbeat_status=error when SDK throws', async () => {
      (mockedTelemetry.heartbeat as jest.Mock).mockRejectedValueOnce(new Error('ECONNRESET'));
      const { service, dataSource } = buildService();
      await expect(service.runHeartbeat()).resolves.not.toThrow();
      const patch = findPatchCall(dataSource);
      expect(patch?.last_heartbeat_status).toBe('error');
    });

    it('is a no-op when telemetry is disabled', async () => {
      // Once-only: runHeartbeat checks isEnabled() at the top. Using a permanent
      // mockReturnValue here would leak `false` into later tests (clearAllMocks
      // clears calls, not the implementation).
      (mockedTelemetry.isEnabled as jest.Mock).mockReturnValueOnce(false);
      const { service } = buildService();
      await service.runHeartbeat();
      expect(mockedTelemetry.heartbeat).not.toHaveBeenCalled();
    });

    it('sends the full curated usage map (counts only)', async () => {
      const { service } = buildService();
      await service.runHeartbeat();
      const [stats] = (mockedTelemetry.heartbeat as jest.Mock).mock.calls[0];
      expect(stats.usage).toEqual({
        active_users: 7,
        accounts: 3,
        contacts: 1000,
        campaigns: 12,
        messages: 40,
        automations: 2,
        tags: 9,
        email_templates: 4,
        whatsapp_channels: 1,
        whatsapp_messages_sent: 5,
      });
    });

    it('drops only the failing metric, never the whole heartbeat', async () => {
      const { service, dataSource } = buildService();
      const original = (dataSource.query as jest.Mock).getMockImplementation()!;
      (dataSource.query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM contacts')) throw new Error('relation "contacts" does not exist');
        return original(sql);
      });
      await service.runHeartbeat();
      const [stats] = (mockedTelemetry.heartbeat as jest.Mock).mock.calls[0];
      expect(stats.usage).not.toHaveProperty('contacts');
      expect(stats.usage.active_users).toBe(7); // other metrics survive
      expect(mockedTelemetry.heartbeat).toHaveBeenCalledTimes(1);
    });

    it('attaches detected features when env flags are set', async () => {
      process.env.WHATSAPP_PROVIDER = 'cloud';
      process.env.EVOLUTION_HUB_ENABLED = 'true';
      process.env.ENTERPRISE_IMPORT_ENABLED = 'true';
      const { service } = buildService();
      await service.runHeartbeat();
      const [stats] = (mockedTelemetry.heartbeat as jest.Mock).mock.calls[0];
      expect(stats.features.enabled).toEqual(expect.arrayContaining(['whatsapp_cloud', 'enterprise_import', 'whatsapp_channels']));
      expect(stats.features.integrations).toEqual(expect.arrayContaining(['evolution_hub']));
    });

    it('omits features entirely when nothing is enabled', async () => {
      // No WHATSAPP_PROVIDER / hub / enterprise flags, and no whatsapp channels.
      const { service, dataSource } = buildService();
      const original = (dataSource.query as jest.Mock).getMockImplementation()!;
      (dataSource.query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM whatsapp_channels')) return [{ c: 0 }];
        return original(sql);
      });
      delete process.env.WHATSAPP_PROVIDER;
      delete process.env.EVOLUTION_HUB_ENABLED;
      delete process.env.EVOLUTION_HUB_API_KEY;
      delete process.env.ENTERPRISE_IMPORT_ENABLED;
      delete process.env.WHATSAPP_APP_ID;
      delete process.env.AUTH_PROVIDER;
      process.env.SENDGRID_API_KEY = 'dev-placeholder-not-a-real-key';
      await service.runHeartbeat();
      const [stats] = (mockedTelemetry.heartbeat as jest.Mock).mock.calls[0];
      expect(stats.features).toBeUndefined();
    });
  });

  describe('onApplicationShutdown', () => {
    it('clears pending timer', () => {
      const { service } = buildService();
      const fakeTimer = {} as any;
      (service as any).timer = fakeTimer;
      const spy = jest.spyOn(global, 'clearTimeout').mockImplementation(() => undefined);
      service.onApplicationShutdown();
      expect(spy).toHaveBeenCalledWith(fakeTimer);
      expect((service as any).timer).toBeNull();
      spy.mockRestore();
    });
  });
});
