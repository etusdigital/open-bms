import { ApiGeoProvider } from './api-geo.provider';

describe('ApiGeoProvider', () => {
  let provider: ApiGeoProvider;

  beforeEach(() => {
    provider = new ApiGeoProvider();
    process.env.GEO_API_KEY = '';
  });

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
