import { WhatsappModeResolverService } from './whatsapp-mode-resolver.service';

describe('WhatsappModeResolverService', () => {
  let svc: WhatsappModeResolverService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    svc = new WhatsappModeResolverService();
    delete process.env.EVOLUTION_HUB_ENABLED;
    delete process.env.EVOLUTION_HUB_URL;
    delete process.env.WHATSAPP_GRAPH_VERSION;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isHubEnabled / resolveMode', () => {
    it.each([
      ['true', true],
      ['TRUE', true],
      ['1', true],
      ['yes', true],
      ['false', false],
      ['0', false],
      ['no', false],
      ['', false],
      ['anything-else', false],
    ])('reads EVOLUTION_HUB_ENABLED=%s as %s', (input, expected) => {
      process.env.EVOLUTION_HUB_ENABLED = input;
      expect(svc.isHubEnabled()).toBe(expected);
    });

    it('defaults to meta when env var is missing', () => {
      expect(svc.resolveMode()).toBe('meta');
    });

    it('returns evohub when flag is on', () => {
      process.env.EVOLUTION_HUB_ENABLED = 'true';
      expect(svc.resolveMode()).toBe('evohub');
    });
  });

  describe('resolveChannel — meta mode', () => {
    it('returns graph.facebook.com URL and channel access_token', () => {
      const cfg = svc.resolveChannel({ mode: 'meta', phoneNumberId: '111', accessToken: 'tok', channelToken: null });
      expect(cfg).toEqual({ mode: 'meta', baseUrl: 'https://graph.facebook.com/v18.0', bearerToken: 'tok', phoneNumberId: '111' });
    });

    it('honours WHATSAPP_GRAPH_VERSION', () => {
      process.env.WHATSAPP_GRAPH_VERSION = 'v19.0';
      const cfg = svc.resolveChannel({ mode: 'meta', phoneNumberId: '111', accessToken: 'tok', channelToken: null });
      expect(cfg.baseUrl).toBe('https://graph.facebook.com/v19.0');
    });

    it('throws when access_token is missing', () => {
      expect(() => svc.resolveChannel({ mode: 'meta', phoneNumberId: '111', accessToken: null, channelToken: null })).toThrow(/access_token/);
    });
  });

  describe('resolveChannel — evohub mode', () => {
    beforeEach(() => {
      process.env.EVOLUTION_HUB_ENABLED = 'true';
    });

    it('returns Hub /meta/{version} URL and channel_token', () => {
      const cfg = svc.resolveChannel({ mode: 'evohub', phoneNumberId: '222', accessToken: null, channelToken: 'hub-tok' });
      expect(cfg).toEqual({ mode: 'evohub', baseUrl: 'https://api.evohub.ai/meta/v18.0', bearerToken: 'hub-tok', phoneNumberId: '222' });
    });

    it('honours EVOLUTION_HUB_URL and strips trailing slash', () => {
      process.env.EVOLUTION_HUB_URL = 'https://hub.local/';
      const cfg = svc.resolveChannel({ mode: 'evohub', phoneNumberId: '222', accessToken: null, channelToken: 'hub-tok' });
      expect(cfg.baseUrl).toBe('https://hub.local/meta/v18.0');
    });

    it('throws when channel_token is missing', () => {
      expect(() => svc.resolveChannel({ mode: 'evohub', phoneNumberId: '222', accessToken: null, channelToken: null })).toThrow(/channel_token/);
    });
  });

  describe('resolveChannel — drift / mismatch', () => {
    it('throws if channel mode does not match install mode (install flipped after channel was created)', () => {
      process.env.EVOLUTION_HUB_ENABLED = 'true';
      expect(() => svc.resolveChannel({ mode: 'meta', phoneNumberId: '111', accessToken: 'tok', channelToken: null })).toThrow(/does not match install mode/);
    });

    it('throws if phone_number_id is missing (channel still pending)', () => {
      expect(() => svc.resolveChannel({ mode: 'meta', phoneNumberId: null, accessToken: 'tok', channelToken: null })).toThrow(/phone_number_id/);
    });
  });
});
