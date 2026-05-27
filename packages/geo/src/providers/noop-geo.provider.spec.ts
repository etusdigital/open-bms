import { NoopGeoProvider } from './noop-geo.provider';

describe('NoopGeoProvider', () => {
  let provider: NoopGeoProvider;

  beforeEach(() => {
    provider = new NoopGeoProvider();
  });

  it('always returns null regardless of IP', async () => {
    expect(await provider.lookup('8.8.8.8')).toBeNull();
    expect(await provider.lookup('192.168.1.1')).toBeNull();
    expect(await provider.lookup('')).toBeNull();
  });
});
