import axios from 'axios';
import { EvolutionHubClient, HUB_FRONTEND_URL, buildHubSignupUrl } from './evolution-hub.client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EvolutionHubClient', () => {
  const post = jest.fn();
  const get = jest.fn();
  const del = jest.fn();

  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    del.mockReset();
    (mockedAxios.create as jest.Mock).mockReturnValue({ post, get, delete: del } as any);
  });

  it('throws if apiKey is missing', () => {
    expect(() => new EvolutionHubClient({ apiKey: '' })).toThrow(/apiKey/);
  });

  describe('createChannel', () => {
    it('returns { channel, webhook_id } when Hub responds in wrapped shape', async () => {
      post.mockResolvedValueOnce({
        data: {
          channel: { id: 'ch_1', name: 'acme', type: 'whatsapp', token: 'tok_abc', status: 'inactive' },
          webhook_id: 'wh_1',
        },
      });
      const c = new EvolutionHubClient({ apiKey: 'k' });
      const r = await c.createChannel({
        name: 'acme',
        type: 'whatsapp',
        external_id: '42',
        webhook_url: 'https://bms.example.com/webhooks/evolution-hub',
        webhook_secret: 'hmac-secret',
        webhook_events: ['messages', 'message_template_status_update'],
      });

      expect(post).toHaveBeenCalledWith('/api/v1/channels', {
        name: 'acme',
        type: 'whatsapp',
        external_id: '42',
        webhook_url: 'https://bms.example.com/webhooks/evolution-hub',
        webhook_secret: 'hmac-secret',
        webhook_events: ['messages', 'message_template_status_update'],
      });
      expect(r.channel.id).toBe('ch_1');
      expect(r.channel.token).toBe('tok_abc');
      expect(r.webhook_id).toBe('wh_1');
    });

    it('normalizes unwrapped channel response into { channel }', async () => {
      post.mockResolvedValueOnce({ data: { id: 'ch_2', name: 'x', type: 'whatsapp', token: 'tok_2', status: 'inactive' } });
      const c = new EvolutionHubClient({ apiKey: 'k' });
      const r = await c.createChannel({ name: 'x' });
      expect(r.channel.id).toBe('ch_2');
      expect(r.webhook_id).toBeUndefined();
    });

    it('throws on wrapped response missing channel.token', async () => {
      post.mockResolvedValueOnce({ data: { channel: { id: 'ch_1' } } });
      const c = new EvolutionHubClient({ apiKey: 'k' });
      await expect(c.createChannel({ name: 'x' })).rejects.toThrow(/missing channel.id \/ channel.token/);
    });

    it('throws on unwrapped response missing id or token', async () => {
      post.mockResolvedValueOnce({ data: { id: 'ch_3' } });
      const c = new EvolutionHubClient({ apiKey: 'k' });
      await expect(c.createChannel({ name: 'x' })).rejects.toThrow(/missing id \/ token/);
    });
  });

  describe('buildHubSignupUrl', () => {
    it('builds the public connect URL using HUB_FRONTEND_URL', () => {
      expect(buildHubSignupUrl('tok_abc')).toBe(`${HUB_FRONTEND_URL}/connect/tok_abc`);
    });

    it('url-encodes the channel token', () => {
      expect(buildHubSignupUrl('tok with spaces & symbols')).toContain('/connect/tok%20with%20spaces%20%26%20symbols');
    });
  });

  it('deleteChannel calls DELETE /api/v1/channels/:id', async () => {
    del.mockResolvedValueOnce({ data: {} });
    const c = new EvolutionHubClient({ apiKey: 'k' });
    await c.deleteChannel('ch_1');
    expect(del).toHaveBeenCalledWith('/api/v1/channels/ch_1');
  });

  it('listChannels returns array (empty when null)', async () => {
    get.mockResolvedValueOnce({ data: null });
    const c = new EvolutionHubClient({ apiKey: 'k' });
    expect(await c.listChannels()).toEqual([]);
  });

  it('getPlan returns plan info', async () => {
    get.mockResolvedValueOnce({ data: { plan: 'pro', channels_used: 3, channels_limit: 10 } });
    const c = new EvolutionHubClient({ apiKey: 'k' });
    const p = await c.getPlan();
    expect(p.plan).toBe('pro');
  });

  it('strips trailing slash from baseUrl', () => {
    new EvolutionHubClient({ apiKey: 'k', baseUrl: 'https://example.com/' });
    expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://example.com' }));
  });
});
