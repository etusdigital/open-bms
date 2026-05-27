import { ApiGeoProvider } from './api-geo.provider';

describe('ApiGeoProvider', () => {
  let provider: ApiGeoProvider;
  const originalVendor = process.env.GEO_API_VENDOR;

  beforeEach(() => {
    provider = new ApiGeoProvider();
    process.env.GEO_API_KEY = '';
    delete process.env.GEO_API_VENDOR;
  });

  afterAll(() => {
    if (originalVendor === undefined) delete process.env.GEO_API_VENDOR;
    else process.env.GEO_API_VENDOR = originalVendor;
  });

  describe('vendor=ip-api (default)', () => {
    it('returns GeoData on successful response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', country: 'US', regionName: 'California', city: 'Mountain View' }),
      }) as jest.Mock;

      const result = await provider.lookup('8.8.8.8');
      expect(result).toEqual({ country: 'US', region: 'California', city: 'Mountain View' });
    });

    it('returns null when api status is not success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'fail' }),
      }) as jest.Mock;

      expect(await provider.lookup('999.999.999.999')).toBeNull();
    });

    it('returns null on network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as jest.Mock;
      expect(await provider.lookup('8.8.8.8')).toBeNull();
    });

    it('returns null when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false }) as jest.Mock;
      expect(await provider.lookup('8.8.8.8')).toBeNull();
    });
  });

  describe('vendor=ipinfo', () => {
    beforeEach(() => {
      process.env.GEO_API_VENDOR = 'ipinfo';
    });

    it('returns GeoData on successful response', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ip: '8.8.8.8',
          country: 'US',
          region: 'California',
          city: 'Mountain View',
        }),
      });
      global.fetch = fetchMock as jest.Mock;

      const result = await provider.lookup('8.8.8.8');
      expect(result).toEqual({ country: 'US', region: 'California', city: 'Mountain View' });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://ipinfo.io/8.8.8.8/json',
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });

    it('sends bearer token when GEO_API_KEY is set', async () => {
      process.env.GEO_API_KEY = 'tok_abc';
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ country: 'BR' }),
      });
      global.fetch = fetchMock as jest.Mock;

      await provider.lookup('200.160.0.1');

      const opts = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
      expect(opts.headers.Authorization).toBe('Bearer tok_abc');
    });

    it('returns null for bogon (private/reserved) responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ip: '10.0.0.1', bogon: true }),
      }) as jest.Mock;

      expect(await provider.lookup('10.0.0.1')).toBeNull();
    });

    it('returns null when no location fields present', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ip: '8.8.8.8' }),
      }) as jest.Mock;

      expect(await provider.lookup('8.8.8.8')).toBeNull();
    });
  });

  it('returns null for empty IP without calling fetch', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as jest.Mock;

    expect(await provider.lookup('')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
