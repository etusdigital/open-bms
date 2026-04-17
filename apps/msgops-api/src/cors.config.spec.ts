import { isOriginAllowed } from './cors.config';

describe('CORS origin validation', () => {
  describe('allowed production origins', () => {
    it('allows bms.bri.us', () => {
      expect(isOriginAllowed('https://bms.bri.us', 'production')).toBe(true);
    });

    it('allows bms-new.bri.us', () => {
      expect(isOriginAllowed('https://bms-new.bri.us', 'production')).toBe(true);
    });

    it('allows bms-stg.bri.us', () => {
      expect(isOriginAllowed('https://bms-stg.bri.us', 'production')).toBe(true);
    });

    it('allows admin.bri.us', () => {
      expect(isOriginAllowed('https://admin.bri.us', 'production')).toBe(true);
    });
  });

  describe('Cloudflare Pages preview origins', () => {
    it('allows staging preview', () => {
      expect(isOriginAllowed('https://staging.bms-frontend-react.pages.dev', 'production')).toBe(true);
    });

    it('allows PR preview', () => {
      expect(isOriginAllowed('https://pr-42.bms-frontend-react.pages.dev', 'production')).toBe(true);
    });

    it('allows commit-hash preview', () => {
      expect(isOriginAllowed('https://abc123.bms-frontend-react.pages.dev', 'production')).toBe(true);
    });
  });

  describe('requests with no origin', () => {
    it('allows undefined origin (server-to-server)', () => {
      expect(isOriginAllowed(undefined, 'production')).toBe(true);
    });
  });

  describe('blocked origins', () => {
    it('blocks unknown domains', () => {
      expect(isOriginAllowed('https://evil.com', 'production')).toBe(false);
    });

    it('blocks HTTP version of allowed domains', () => {
      expect(isOriginAllowed('http://bms.bri.us', 'production')).toBe(false);
    });

    it('blocks other pages.dev projects', () => {
      expect(isOriginAllowed('https://attacker.pages.dev', 'production')).toBe(false);
    });

    it('blocks subdomains of allowed origins', () => {
      expect(isOriginAllowed('https://evil.bms.bri.us', 'production')).toBe(false);
    });

    it('blocks localhost in production', () => {
      expect(isOriginAllowed('http://localhost:3000', 'production')).toBe(false);
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
