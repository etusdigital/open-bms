// DO NOT relax this test — it protects LGPD compliance.
// The admin owner email lives only in the local system_config row and MUST
// NEVER appear in any payload sent to the telemetry server.

import { telemetry } from '@etus/telemetry-sdk';
import { TelemetryService } from './telemetry.service';

const SECRET_EMAIL = 'admin-owner@privacy-canary.example.com';

const sentPayloads: unknown[] = [];

jest.mock('@etus/telemetry-sdk', () => ({
  telemetry: {
    init: jest.fn().mockReturnValue({ enabled: true, reason: 'config_enabled' }),
    isEnabled: jest.fn().mockReturnValue(true),
    heartbeat: jest.fn(async (stats: unknown) => {
      // Capture the full payload the SDK would build. We assert against stats here;
      // the upstream SDK already proves it doesn't add PII to the envelope.
      sentPayloads.push({ kind: 'heartbeat', stats });
      return { ok: true, attempt: 1 };
    }),
    lifecycle: jest.fn(async (lifecycle: unknown) => {
      sentPayloads.push({ kind: 'lifecycle', lifecycle });
      return { ok: true, attempt: 1 };
    }),
    __reset: jest.fn(),
  },
}));

function buildService(stateRow: any) {
  const systemConfigRepo = {
    findOne: jest.fn().mockResolvedValue(stateRow),
    save: jest.fn(async (x: any) => x),
    create: jest.fn((x: any) => x),
  };
  const dataSource = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('RETURNING key')) return [{ key: 'telemetry_state' }];
      if (sql.includes('INSERT INTO system_config')) return [];
      if (sql.includes('FROM users')) return [{ c: 1 }];
      if (sql.includes('FROM accounts')) return [{ c: 1 }];
      if (sql.includes('server_version_num')) return [{ server_version_num: '160003' }];
      return [];
    }),
  };
  const svc = Object.create(TelemetryService.prototype) as TelemetryService;
  (svc as any).logger = { log: jest.fn(), warn: jest.fn() };
  (svc as any).systemConfigRepo = systemConfigRepo;
  (svc as any).roleRepo = { findOne: jest.fn() };
  (svc as any).dataSource = dataSource;
  (svc as any).initialized = true;
  (svc as any).productVersion = '1.0.0';
  return svc;
}

describe('Telemetry privacy guarantees', () => {
  beforeEach(() => {
    sentPayloads.length = 0;
    jest.clearAllMocks();
  });

  it('emitInstall: does NOT leak the owner email in the lifecycle payload', async () => {
    const svc = buildService({ value: { account_owner_email: SECRET_EMAIL } });
    await svc.emitInstall(SECRET_EMAIL);
    expect(sentPayloads.length).toBe(1);
    expect(JSON.stringify(sentPayloads)).not.toContain(SECRET_EMAIL);
    expect(JSON.stringify(sentPayloads)).not.toContain('privacy-canary');
  });

  it('runHeartbeat: does NOT leak the owner email in any heartbeat payload', async () => {
    const svc = buildService({ value: { account_owner_email: SECRET_EMAIL } });
    await svc.runHeartbeat();
    expect(sentPayloads.length).toBe(1);
    expect(JSON.stringify(sentPayloads)).not.toContain(SECRET_EMAIL);
  });

  it('setOwnerEmail: stores email locally but does NOT send any payload as side-effect', async () => {
    const svc = buildService(null);
    await svc.setOwnerEmail(SECRET_EMAIL);
    expect(sentPayloads.length).toBe(0);
    expect(telemetry.lifecycle as jest.Mock).not.toHaveBeenCalled();
    expect(telemetry.heartbeat as jest.Mock).not.toHaveBeenCalled();
  });
});
