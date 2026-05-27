import { WhatsappModeResolverService } from './whatsapp-mode-resolver.service';
import type { SystemConfigCacheProvider } from '../../providers/system-config-cache.provider';

function buildCache(initial: Record<string, unknown> | null = null) {
  const store = initial ? new Map(Object.entries(initial)) : new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
    invalidate: jest.fn(async () => undefined),
    /** test helper */ _store: store,
  } as unknown as SystemConfigCacheProvider & { _store: Map<string, unknown> };
  return cache;
}

describe('WhatsappModeResolverService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.EVOLUTION_HUB_ENABLED;
    delete process.env.EVOLUTION_HUB_URL;
    delete process.env.WHATSAPP_GRAPH_VERSION;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isHubEnabled — system_config wins over env', () => {
    it('returns DB value when system_config has the row', async () => {
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: true } });
      process.env.EVOLUTION_HUB_ENABLED = 'false'; // env says off
      const svc = new WhatsappModeResolverService(cache);
      expect(await svc.isHubEnabled()).toBe(true);
    });

    it('falls back to env when system_config row is missing', async () => {
      const cache = buildCache(null);
      process.env.EVOLUTION_HUB_ENABLED = 'true';
      const svc = new WhatsappModeResolverService(cache);
      expect(await svc.isHubEnabled()).toBe(true);
    });

    it('defaults to false when neither DB nor env are set', async () => {
      const cache = buildCache(null);
      const svc = new WhatsappModeResolverService(cache);
      expect(await svc.isHubEnabled()).toBe(false);
    });

    it.each([
      ['true', true],
      ['TRUE', true],
      ['1', true],
      ['yes', true],
      ['false', false],
      ['0', false],
      ['', false],
    ])('env value "%s" → %s when DB is empty', async (input, expected) => {
      const cache = buildCache(null);
      process.env.EVOLUTION_HUB_ENABLED = input;
      const svc = new WhatsappModeResolverService(cache);
      expect(await svc.isHubEnabled()).toBe(expected);
    });
  });

  describe('resolveMode', () => {
    it('returns evohub when isHubEnabled is true', async () => {
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: true } });
      const svc = new WhatsappModeResolverService(cache);
      expect(await svc.resolveMode()).toBe('evohub');
    });
    it('returns meta when isHubEnabled is false', async () => {
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: false } });
      const svc = new WhatsappModeResolverService(cache);
      expect(await svc.resolveMode()).toBe('meta');
    });
  });

  describe('resolveChannel — meta mode', () => {
    it('returns graph.facebook.com URL and channel access_token', async () => {
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: false } });
      const svc = new WhatsappModeResolverService(cache);
      const cfg = await svc.resolveChannel({ mode: 'meta', phoneNumberId: '111', accessToken: 'tok', channelToken: null });
      expect(cfg).toEqual({ mode: 'meta', baseUrl: 'https://graph.facebook.com/v18.0', bearerToken: 'tok', phoneNumberId: '111' });
    });

    it('honours WHATSAPP_GRAPH_VERSION', async () => {
      process.env.WHATSAPP_GRAPH_VERSION = 'v19.0';
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: false } });
      const svc = new WhatsappModeResolverService(cache);
      const cfg = await svc.resolveChannel({ mode: 'meta', phoneNumberId: '111', accessToken: 'tok', channelToken: null });
      expect(cfg.baseUrl).toBe('https://graph.facebook.com/v19.0');
    });

    it('throws when access_token is missing', async () => {
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: false } });
      const svc = new WhatsappModeResolverService(cache);
      await expect(svc.resolveChannel({ mode: 'meta', phoneNumberId: '111', accessToken: null, channelToken: null })).rejects.toThrow(/access_token/);
    });
  });

  describe('resolveChannel — evohub mode', () => {
    it('returns Hub /meta/{version} URL and channel_token', async () => {
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: true } });
      const svc = new WhatsappModeResolverService(cache);
      const cfg = await svc.resolveChannel({ mode: 'evohub', phoneNumberId: '222', accessToken: null, channelToken: 'hub-tok' });
      expect(cfg).toEqual({ mode: 'evohub', baseUrl: 'https://api.evohub.ai/meta/v18.0', bearerToken: 'hub-tok', phoneNumberId: '222' });
    });

    it('honours EVOLUTION_HUB_URL override and strips trailing slash', async () => {
      process.env.EVOLUTION_HUB_URL = 'https://hub.local/';
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: true } });
      const svc = new WhatsappModeResolverService(cache);
      const cfg = await svc.resolveChannel({ mode: 'evohub', phoneNumberId: '222', accessToken: null, channelToken: 'hub-tok' });
      expect(cfg.baseUrl).toBe('https://hub.local/meta/v18.0');
    });

    it('throws when channel_token is missing', async () => {
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: true } });
      const svc = new WhatsappModeResolverService(cache);
      await expect(svc.resolveChannel({ mode: 'evohub', phoneNumberId: '222', accessToken: null, channelToken: null })).rejects.toThrow(/channel_token/);
    });
  });

  describe('resolveChannel — drift / mismatch', () => {
    it('throws if channel mode does not match install mode', async () => {
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: true } });
      const svc = new WhatsappModeResolverService(cache);
      await expect(svc.resolveChannel({ mode: 'meta', phoneNumberId: '111', accessToken: 'tok', channelToken: null })).rejects.toThrow(/does not match install mode/);
    });

    it('throws if phone_number_id is missing', async () => {
      const cache = buildCache({ whatsapp_hub_system_settings: { enabled: false } });
      const svc = new WhatsappModeResolverService(cache);
      await expect(svc.resolveChannel({ mode: 'meta', phoneNumberId: null, accessToken: 'tok', channelToken: null })).rejects.toThrow(/phone_number_id/);
    });
  });
});
