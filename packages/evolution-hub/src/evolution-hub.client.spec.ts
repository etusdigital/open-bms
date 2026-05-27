import axios from 'axios';
import { EvolutionHubClient } from './evolution-hub.client';

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

  it('createChannel returns id, public_link, channel_token', async () => {
    post.mockResolvedValueOnce({ data: { id: 'ch_1', public_link: 'https://hub/signup/x', channel_token: 'tok' } });
    const c = new EvolutionHubClient({ apiKey: 'k' });
    const r = await c.createChannel({ name: 'acme', external_account_id: 42 });
    expect(post).toHaveBeenCalledWith('/api/v1/channels', { name: 'acme', external_account_id: 42 });
    expect(r).toEqual({ id: 'ch_1', public_link: 'https://hub/signup/x', channel_token: 'tok' });
  });

  it('createChannel throws on incomplete response', async () => {
    post.mockResolvedValueOnce({ data: { id: 'ch_1' } });
    const c = new EvolutionHubClient({ apiKey: 'k' });
    await expect(c.createChannel({ name: 'x' })).rejects.toThrow(/missing required fields/);
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
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'https://example.com' }),
    );
  });
});
