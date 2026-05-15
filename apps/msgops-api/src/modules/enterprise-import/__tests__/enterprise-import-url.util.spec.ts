import { BadRequestException } from '@nestjs/common';
import { assertSafeEnterpriseBaseUrl } from '../enterprise-import-url.util';

// F9: o validador é a defesa de SSRF do baseUrl fornecido pelo usuário.
describe('assertSafeEnterpriseBaseUrl (F9 anti-SSRF)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.ENTERPRISE_IMPORT_ALLOWED_HOSTS;
    process.env.NODE_ENV = 'test';
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('aceita host público https', () => {
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
  ])('bloqueia alvo interno: %s', (url) => {
    expect(() => assertSafeEnterpriseBaseUrl(url)).toThrow(BadRequestException);
  });

  it('rejeita protocolo não-http(s)', () => {
    expect(() => assertSafeEnterpriseBaseUrl('file:///etc/passwd')).toThrow(BadRequestException);
    expect(() => assertSafeEnterpriseBaseUrl('not-a-url')).toThrow(BadRequestException);
  });

  it('exige https em produção', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertSafeEnterpriseBaseUrl('http://enterprise.acme.com')).toThrow(/https/);
    expect(assertSafeEnterpriseBaseUrl('https://enterprise.acme.com')).toContain('https');
  });

  it('allowlist: só passa host listado, mesmo público', () => {
    process.env.ENTERPRISE_IMPORT_ALLOWED_HOSTS = 'enterprise.acme.com';
    expect(assertSafeEnterpriseBaseUrl('https://enterprise.acme.com')).toContain('acme');
    expect(() => assertSafeEnterpriseBaseUrl('https://evil.example.com')).toThrow(/allowlist/);
  });
});
