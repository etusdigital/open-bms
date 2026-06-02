import { isOriginAllowed, createPublicCorsOptions } from './cors.config';

describe('CORS origin validation', () => {
  const ORIGINAL_CORS_ORIGINS = process.env.CORS_ORIGINS;
  const ORIGINAL_CF_PAGES_PROJECT = process.env.CORS_CF_PAGES_PROJECT;

  beforeEach(() => {
    process.env.CORS_ORIGINS = ['https://app.example.com', 'https://app-new.example.com', 'https://app-stg.example.com', 'https://admin.example.com'].join(',');
    process.env.CORS_CF_PAGES_PROJECT = 'my-frontend';
  });

  afterAll(() => {
    process.env.CORS_ORIGINS = ORIGINAL_CORS_ORIGINS;
    process.env.CORS_CF_PAGES_PROJECT = ORIGINAL_CF_PAGES_PROJECT;
  });

  describe('allowed origins from CORS_ORIGINS env var', () => {
    it('allows configured production origin', () => {
      expect(isOriginAllowed('https://app.example.com', 'production')).toBe(true);
    });

    it('allows additional configured origin', () => {
      expect(isOriginAllowed('https://app-new.example.com', 'production')).toBe(true);
    });

    it('allows staging origin', () => {
      expect(isOriginAllowed('https://app-stg.example.com', 'production')).toBe(true);
    });

    it('allows admin origin', () => {
      expect(isOriginAllowed('https://admin.example.com', 'production')).toBe(true);
    });
  });

  describe('Cloudflare Pages preview origins', () => {
    it('allows staging preview', () => {
      expect(isOriginAllowed('https://staging.my-frontend.pages.dev', 'production')).toBe(true);
    });

    it('allows PR preview', () => {
      expect(isOriginAllowed('https://pr-42.my-frontend.pages.dev', 'production')).toBe(true);
    });

    it('allows commit-hash preview', () => {
      expect(isOriginAllowed('https://abc123.my-frontend.pages.dev', 'production')).toBe(true);
    });

    it('blocks CF Pages when project is not configured', () => {
      delete process.env.CORS_CF_PAGES_PROJECT;
      expect(isOriginAllowed('https://any.my-frontend.pages.dev', 'production')).toBe(false);
    });
  });

  describe('requests with no origin', () => {
    it('rejects undefined origin in production (cookie credentials demands explicit origin)', () => {
      expect(isOriginAllowed(undefined, 'production')).toBe(false);
    });

    it('allows undefined origin outside production (local curl/health)', () => {
      expect(isOriginAllowed(undefined, 'development')).toBe(true);
      expect(isOriginAllowed(undefined, 'test')).toBe(true);
    });
  });

  describe('blocked origins', () => {
    it('blocks unknown domains', () => {
      expect(isOriginAllowed('https://evil.com', 'production')).toBe(false);
    });

    it('blocks HTTP version of allowed domains', () => {
      expect(isOriginAllowed('http://app.example.com', 'production')).toBe(false);
    });

    it('blocks other pages.dev projects', () => {
      expect(isOriginAllowed('https://attacker.pages.dev', 'production')).toBe(false);
    });

    it('blocks subdomains of allowed origins', () => {
      expect(isOriginAllowed('https://evil.app.example.com', 'production')).toBe(false);
    });

    it('blocks localhost in production', () => {
      expect(isOriginAllowed('http://localhost:3000', 'production')).toBe(false);
    });

    it('blocks everything when CORS_ORIGINS is empty and no CF project', () => {
      process.env.CORS_ORIGINS = '';
      delete process.env.CORS_CF_PAGES_PROJECT;
      expect(isOriginAllowed('https://app.example.com', 'production')).toBe(false);
    });
  });

  describe('createPublicCorsOptions (tracking / web-push surface)', () => {
    it('reflects any origin (customer domains are arbitrary)', () => {
      expect(createPublicCorsOptions().origin).toBe(true);
    });

    it('disables credentials (required to reflect origin; auth is by api-key)', () => {
      expect(createPublicCorsOptions().credentials).toBe(false);
    });

    it('allows the headers the tracker sends, incl. api-key', () => {
      const allowed = createPublicCorsOptions().allowedHeaders as string[];
      expect(allowed).toEqual(expect.arrayContaining(['Content-Type', 'api-key', 'x-api-key']));
    });

    it('answers POST + OPTIONS preflight', () => {
      const methods = createPublicCorsOptions().methods as string[];
      expect(methods).toEqual(expect.arrayContaining(['POST', 'OPTIONS']));
    });
  });

  describe('localhost in development', () => {
    it('allows http://localhost:3000', () => {
      expect(isOriginAllowed('http://localhost:3000', 'development')).toBe(true);
    });

    it('allows http://localhost:5001', () => {
      expect(isOriginAllowed('http://localhost:5001', 'development')).toBe(true);
    });

    it('allows https://localhost', () => {
      expect(isOriginAllowed('https://localhost', 'development')).toBe(true);
    });

    it('allows localhost when NODE_ENV is test', () => {
      expect(isOriginAllowed('http://localhost:3000', 'test')).toBe(true);
    });

    it('blocks localhost in production', () => {
      expect(isOriginAllowed('http://localhost:3000', 'production')).toBe(false);
    });
  });
});
