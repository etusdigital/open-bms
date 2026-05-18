import { BadRequestException } from '@nestjs/common';
import { assertSafeEnterpriseBaseUrl } from '../enterprise-import-url.util';

// The validator is the SSRF defense for the user-supplied baseUrl.
describe('assertSafeEnterpriseBaseUrl (anti-SSRF)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.ENTERPRISE_IMPORT_ALLOWED_HOSTS;
    process.env.NODE_ENV = 'test';
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('accepts a public https host', () => {
    expect(assertSafeEnterpriseBaseUrl('https://enterprise.acme.com')).toContain('enterprise.acme.com');
  });

  it.each([
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://10.1.2.3',
    'http://192.168.0.10',
    'http://172.16.5.5',
    'http://169.254.169.254/latest/meta-data', // AWS metadata
    'http://[::1]:8080',
    'http://0.0.0.0',
  ])('blocks internal target: %s', (url) => {
    expect(() => assertSafeEnterpriseBaseUrl(url)).toThrow(BadRequestException);
  });

  it('rejects non-http(s) protocols', () => {
    expect(() => assertSafeEnterpriseBaseUrl('file:///etc/passwd')).toThrow(BadRequestException);
    expect(() => assertSafeEnterpriseBaseUrl('not-a-url')).toThrow(BadRequestException);
  });

  it('requires https in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertSafeEnterpriseBaseUrl('http://enterprise.acme.com')).toThrow(/https/);
    expect(assertSafeEnterpriseBaseUrl('https://enterprise.acme.com')).toContain('https');
  });

  it('allowlist: only listed hosts pass, even public ones', () => {
    process.env.ENTERPRISE_IMPORT_ALLOWED_HOSTS = 'enterprise.acme.com';
    expect(assertSafeEnterpriseBaseUrl('https://enterprise.acme.com')).toContain('acme');
    expect(() => assertSafeEnterpriseBaseUrl('https://evil.example.com')).toThrow(/allowlist/);
  });
});
