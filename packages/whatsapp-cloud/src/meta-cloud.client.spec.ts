import axios from 'axios';
import { MetaCloudClient } from './meta-cloud.client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MetaCloudClient', () => {
  const get = jest.fn();

  beforeEach(() => {
    get.mockReset();
    (mockedAxios.create as jest.Mock).mockReturnValue({ get } as any);
  });

  describe('exchangeCodeForToken', () => {
    it('calls GET /{version}/oauth/access_token with credentials and returns token', async () => {
      get.mockResolvedValueOnce({ data: { access_token: 'EAAB...', token_type: 'bearer', expires_in: 5184000 } });
      const client = new MetaCloudClient({ graphVersion: 'v18.0' });

      const result = await client.exchangeCodeForToken({
        appId: 'app_id',
        appSecret: 'app_secret',
        code: 'short_code',
      });

      expect(get).toHaveBeenCalledWith('/v18.0/oauth/access_token', {
        params: { client_id: 'app_id', client_secret: 'app_secret', code: 'short_code' },
      });
      expect(result.accessToken).toBe('EAAB...');
      expect(result.expiresIn).toBe(5184000);
    });

    it('respects per-call graphVersion override', async () => {
      get.mockResolvedValueOnce({ data: { access_token: 'EAAB' } });
      const client = new MetaCloudClient({ graphVersion: 'v18.0' });

      await client.exchangeCodeForToken({ appId: 'a', appSecret: 's', code: 'c', graphVersion: 'v19.0' });

      expect(get).toHaveBeenCalledWith('/v19.0/oauth/access_token', expect.any(Object));
    });

    it('throws if access_token is missing in response', async () => {
      get.mockResolvedValueOnce({ data: {} });
      const client = new MetaCloudClient();
      await expect(client.exchangeCodeForToken({ appId: 'a', appSecret: 's', code: 'c' })).rejects.toThrow(/missing access_token/);
    });
  });

  describe('getPhoneNumberInfo', () => {
    it('calls GET /{version}/{id} with Bearer token', async () => {
      get.mockResolvedValueOnce({ data: { id: '111', display_phone_number: '+55 11 99999-0000' } });
      const client = new MetaCloudClient({ graphVersion: 'v18.0' });

      const info = await client.getPhoneNumberInfo('111', 'access_token');

      expect(get).toHaveBeenCalledWith('/v18.0/111', { headers: { Authorization: 'Bearer access_token' } });
      expect(info.display_phone_number).toBe('+55 11 99999-0000');
    });
  });
});
