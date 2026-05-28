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
      (mockedTelemetry.isEnabled as jest.Mock).mockReturnValue(false);
      const { service } = buildService();
      await service.runHeartbeat();
      expect(mockedTelemetry.heartbeat).not.toHaveBeenCalled();
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
