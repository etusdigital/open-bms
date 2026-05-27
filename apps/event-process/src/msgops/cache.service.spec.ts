import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { UAParser } from 'ua-parser-js';

describe('CacheService', () => {
  let service: CacheService;
  let parser: UAParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    service = module.get<CacheService>(CacheService);
    parser = new UAParser();
  });

  it('should measure memory consumption of user agent cache', () => {
    // Get initial memory usage
    const initialMemory = process.memoryUsage().heapUsed;
    console.log('Initial memory usage:', formatBytes(initialMemory));

    // Generate 1000 realistic user agents
    const userAgents = generateUserAgents(1000);
    console.log('Generated 1000 user agents', userAgents.length);

    // Cache the user agents
    userAgents.forEach((ua) => {
      parser.setUA(ua);
      const result = parser.getResult();
      const formattedResult = {
        is_mobile: result?.device?.type === 'mobile',
        user_agent: ua,
        os: result?.os?.name || null,
        os_version: result?.os?.version || null,
        browser: result?.browser?.name || null,
      };
      service.set('userAgent', ua, formattedResult);
    });

    // Get final memory usage
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsed = finalMemory - initialMemory;
    const averagePerEntry = memoryUsed / userAgents.length;

    console.log('Final memory usage:', formatBytes(finalMemory));
    console.log('Memory used by cache:', formatBytes(memoryUsed));
    console.log('Average memory per entry:', formatBytes(averagePerEntry));
    console.log('Current cache size:', service.getSize('userAgent'));

    // Verify cache size
    expect(service.getSize('userAgent')).toBe(userAgents.length);
  });

  it('should respect cache size limit', () => {
    // Generate 1100 user agents (more than the limit)
    const userAgents = generateUserAgents(2100);

    // Cache all user agents
    userAgents.forEach((ua) => {
      parser.setUA(ua);
      const result = parser.getResult();
      const formattedResult = {
        is_mobile: result?.device?.type === 'mobile',
        user_agent: ua,
        os: result?.os?.name || null,
        os_version: result?.os?.version || null,
        browser: result?.browser?.name || null,
      };
      service.set('userAgent', ua, formattedResult);
    });

    // Verify cache size is not exceeded
    expect(service.getSize('userAgent')).toBeLessThanOrEqual(2000);
  });

  describe('get', () => {
    it('should return undefined when key does not exist', () => {
      expect(service.get('timezone', 'nonexistent')).toBeUndefined();
    });

    it('should return stored value for existing key', () => {
      service.set('timezone', 'test-key', 'UTC');
      expect(service.get('timezone', 'test-key')).toBe('UTC');
    });
  });

  describe('set and get per cache type', () => {
    it('should store and retrieve from timezone cache', () => {
      service.set('timezone', 'tz-1', 'America/Sao_Paulo');
      expect(service.get('timezone', 'tz-1')).toBe('America/Sao_Paulo');
    });

    it('should store and retrieve from apiKey cache', () => {
      service.set('apiKey', 'api-1', 42);
      expect(service.get('apiKey', 'api-1')).toBe(42);
    });

    it('should store and retrieve from custom_event cache', () => {
      service.set('custom_event', 'evt-1', { id: 1 });
      expect(service.get('custom_event', 'evt-1')).toEqual({ id: 1 });
    });

    it('should store and retrieve from userAgent cache', () => {
      service.set('userAgent', 'ua-1', { browser: 'Chrome' });
      expect(service.get('userAgent', 'ua-1')).toEqual({ browser: 'Chrome' });
    });

    it('should not have cross-type key collisions', () => {
      service.set('timezone', 'same-key', 'tz-value');
      service.set('apiKey', 'same-key', 'api-value');
      expect(service.get('timezone', 'same-key')).toBe('tz-value');
      expect(service.get('apiKey', 'same-key')).toBe('api-value');
    });
  });

  describe('clear', () => {
    it('should clear all entries for the specified type', () => {
      service.set('timezone', 'k1', 'v1');
      service.set('timezone', 'k2', 'v2');
      service.clear('timezone');
      expect(service.getSize('timezone')).toBe(0);
    });

    it('should not affect other cache types', () => {
      service.set('timezone', 'k1', 'v1');
      service.set('apiKey', 'k1', 'v1');
      service.clear('timezone');
      expect(service.getSize('apiKey')).toBeGreaterThan(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all entries in all four caches', () => {
      service.set('timezone', 'k', 'v');
      service.set('apiKey', 'k', 'v');
      service.set('custom_event', 'k', 'v');
      service.set('userAgent', 'k', 'v');
      service.clearAll();
      expect(service.getSize('timezone')).toBe(0);
      expect(service.getSize('apiKey')).toBe(0);
      expect(service.getSize('custom_event')).toBe(0);
      expect(service.getSize('userAgent')).toBe(0);
    });
  });

  describe('getSize', () => {
    it('should return 0 for empty cache', () => {
      service.clear('timezone');
      expect(service.getSize('timezone')).toBe(0);
    });

    it('should return correct count after inserts', () => {
      service.clear('apiKey');
      service.set('apiKey', 'k1', 1);
      service.set('apiKey', 'k2', 2);
      expect(service.getSize('apiKey')).toBe(2);
    });
  });
});

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to generate realistic user agents
function generateUserAgents(count: number): string[] {
  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera', 'Mobile Safari', 'Android WebView'];
  const os = ['Windows', 'Macintosh', 'Linux', 'Android', 'iOS', 'Windows Phone'];
  const devices = ['Desktop', 'Mobile', 'Tablet'];

  const userAgents: Set<string> = new Set();
  for (let i = 0; i < count; i++) {
    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const osName = os[Math.floor(Math.random() * os.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];
    const version = Math.floor(Math.random() * 100);
    const subVersion = Math.floor(Math.random() * 10);

    userAgents.add(
      `Mozilla/5.0 (${osName}; ${device}) AppleWebKit/537.36 (KHTML, like Gecko) ${browser}/${version}.${subVersion} Safari/537.36`,
    );
  }
  return Array.from(userAgents);
}
