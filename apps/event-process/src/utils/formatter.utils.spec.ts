import { Test, TestingModule } from '@nestjs/testing';
import { FormatterUtils } from './formatter.utils';
import { CacheService } from '../msgops/cache.service';

describe('FormatterUtils', () => {
  let formatterUtils: FormatterUtils;
  // Fixed reference time for consistent test results
  const fixedDate = new Date('2024-01-01T00:00:00Z');
  const fixedTimestamp = fixedDate.getTime();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FormatterUtils, CacheService],
    }).compile();

    formatterUtils = module.get<FormatterUtils>(FormatterUtils);

    // Mock Date.now to return a fixed timestamp for deterministic tests
    jest.spyOn(Date, 'now').mockImplementation(() => fixedTimestamp);
  });

  afterEach(() => {
    // Restore original Date.now after each test
    jest.restoreAllMocks();
  });

  describe('convertTimestampToTimezone', () => {
    // Test cases for date format (default)
    const dateTestCases = [
      {
        name: 'UTC to UTC',
        timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
        timezone: 'UTC',
        expected: '2024-01-01',
      },
      {
        name: 'UTC to America/New_York',
        timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
        timezone: 'America/New_York',
        expected: '2023-12-31', // 19:00:00 previous day in EST
      },
      {
        name: 'UTC to Asia/Kolkata',
        timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
        timezone: 'Asia/Kolkata',
        expected: '2024-01-01', // 05:30:00 IST
      },
      {
        name: 'UTC to Australia/Sydney',
        timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
        timezone: 'Australia/Sydney',
        expected: '2024-01-01', // 11:00:00 AEDT
      },
      {
        name: 'UTC to America/Sao_Paulo',
        timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
        timezone: 'America/Sao_Paulo',
        expected: '2023-12-31', // 23:00:00 BRT
      },
    ];

    // Test cases for hour format
    const hourTestCases = [
      {
        name: 'UTC hour',
        timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
        timezone: 'UTC',
        expected: '00',
      },
      {
        name: 'America/New_York hour',
        timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
        timezone: 'America/New_York',
        expected: '19', // Previous day 19:00:00 EST
      },
      {
        name: 'Asia/Kolkata hour',
        timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
        timezone: 'Asia/Kolkata',
        expected: '05', // 05:30:00 IST
      },
      {
        name: 'Australia/Sydney hour',
        timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
        timezone: 'Australia/Sydney',
        expected: '11', // 11:00:00 AEDT
      },
      {
        name: 'America/Sao_Paulo hour',
        timestamp: 1704067200000, // 2024-01-01 00:00:00 UTC
        timezone: 'America/Sao_Paulo',
        expected: '21', // 21:00:00 BRT
      },
    ];

    describe('date format', () => {
      dateTestCases.forEach(({ name, timestamp, timezone, expected }) => {
        it(name, () => {
          const result = formatterUtils.convertTimestampToTimezone(timestamp, timezone);
          expect(result).toBe(expected);
        });
      });
    });

    describe('hour format', () => {
      hourTestCases.forEach(({ name, timestamp, timezone, expected }) => {
        it(name, () => {
          const result = formatterUtils.convertTimestampToTimezone(timestamp, timezone, true);
          expect(result).toBe(expected);
        });
      });
    });

    // Test edge cases
    it('should replace very old timestamps with current time for date format', () => {
      // Get current date in the expected format
      const expectedDate = new Date(fixedTimestamp).toISOString().split('T')[0];

      // Use a very old timestamp (-1)
      const result = formatterUtils.convertTimestampToTimezone(-1, 'UTC');
      expect(result).toBe(expectedDate);
    });

    it('should replace very old timestamps with current time for hour format', () => {
      // Get current hour in the expected format
      const expectedHour = new Date(fixedTimestamp).getUTCHours().toString().padStart(2, '0');

      // Use a very old timestamp (-1)
      const result = formatterUtils.convertTimestampToTimezone(-1, 'UTC', true);
      expect(result).toBe(expectedHour);
    });

    it('should replace future timestamp with current time for date format', () => {
      const futureDate = new Date(fixedTimestamp);
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      // Get current date in the expected format
      const expectedDate = new Date(fixedTimestamp).toISOString().split('T')[0];

      const result = formatterUtils.convertTimestampToTimezone(futureDate.getTime(), 'UTC');
      expect(result).toBe(expectedDate);
    });

    it('should replace future timestamp with current time for hour format', () => {
      const futureDate = new Date(fixedTimestamp);
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      // Get current hour in the expected format
      const expectedHour = new Date(fixedTimestamp).getUTCHours().toString().padStart(2, '0');

      const result = formatterUtils.convertTimestampToTimezone(futureDate.getTime(), 'UTC', true);
      expect(result).toBe(expectedHour);
    });

    it('should handle invalid timezone by falling back to UTC for date format', () => {
      const result = formatterUtils.convertTimestampToTimezone(1704067200000, 'Invalid/Timezone');
      expect(result).toBe('2024-01-01'); // Should fallback to UTC
    });

    it('should handle invalid timezone by falling back to UTC for hour format', () => {
      const result = formatterUtils.convertTimestampToTimezone(1704067200000, 'Invalid/Timezone', true);
      expect(result).toBe('00'); // Should fallback to UTC
    });

    // 12-hour limit tests
    it('should replace timestamps older than 12 hours with current time for date format', () => {
      // Create a specific mock date
      const mockNow = new Date('2024-01-01T12:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      // 13 hours before mock date
      const thirteenHoursAgo = mockNow - 13 * 60 * 60 * 1000;

      // Expected: current time
      const expectedDate = new Date(mockNow).toISOString().split('T')[0];

      const result = formatterUtils.convertTimestampToTimezone(thirteenHoursAgo, 'UTC');
      expect(result).toBe(expectedDate);
    });

    it('should replace timestamps older than 12 hours with current time for hour format', () => {
      // Create a specific mock date
      const mockNow = new Date('2024-01-01T12:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      // 13 hours before mock date
      const thirteenHoursAgo = mockNow - 13 * 60 * 60 * 1000;

      // Expected: current hour
      const expectedHour = new Date(mockNow).getUTCHours().toString().padStart(2, '0');

      const result = formatterUtils.convertTimestampToTimezone(thirteenHoursAgo, 'UTC', true);
      expect(result).toBe(expectedHour);
    });

    it('should accept timestamps within the 12-hour limit', () => {
      // Create a specific mock date
      const mockNow = new Date('2024-01-01T12:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      // 11 hours before mock date = 01:00
      const elevenHoursAgo = mockNow - 11 * 60 * 60 * 1000;

      const result = formatterUtils.convertTimestampToTimezone(elevenHoursAgo, 'UTC', true);
      expect(result).toBe('01'); // Within 12 hour limit, should be 01:00
    });
  });

  describe('cleanObject', () => {
    it('should remove null, undefined and empty string values from a simple object', () => {
      const input = {
        name: 'test',
        value: null,
        description: undefined,
        count: 0,
        empty: '',
        valid: 'valid',
      };

      const expected = {
        name: 'test',
        count: 0,
        valid: 'valid',
      };

      const result = formatterUtils.cleanObject(input);
      expect(result).toEqual(expected);
    });

    it('should clean complex interaction object', () => {
      const input = {
        uuid: '07c96be620dc787442a47b44d02db57e4243fb0e',
        name: 'interaction',
        event: 'interaction',
        screen_name: 'more_features',
        screen_type: 'more_features',
        component: 'more_features_list',
        element_text: 'Recompensas',
        action: 'click',
        extra_field: null,
        timezone: '',
      };

      const expected = {
        uuid: '07c96be620dc787442a47b44d02db57e4243fb0e',
        name: 'interaction',
        event: 'interaction',
        screen_name: 'more_features',
        screen_type: 'more_features',
        component: 'more_features_list',
        element_text: 'Recompensas',
        action: 'click',
      };

      const result = formatterUtils.cleanObject(input);
      expect(result).toEqual(expected);
    });

    it('should handle empty object', () => {
      const input = {};
      const result = formatterUtils.cleanObject(input);
      expect(result).toEqual({});
    });

    it('should preserve falsy values except null, undefined, and empty string', () => {
      const input = {
        zero: 0,
        empty: '',
        false: false,
        null: null,
        undefined: undefined,
      };

      const expected = {
        zero: 0,
        false: false,
      };

      const result = formatterUtils.cleanObject(input);
      expect(result).toEqual(expected);
    });

    it('should remove nested objects and arrays', () => {
      const input = {
        name: 'John Doe',
        age: 30,
        email: 'john.doe@example.com',
        phone: '+1234567890',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345',
        },
        orders: [
          {
            orderId: '1234567890',
            amount: 100,
            status: 'completed',
          },
          {
            orderId: '1234567890',
            amount: 200,
            status: 'pending',
          },
        ],
        createdAt: '2021-01-01T00:00:00Z',
      };

      const expected = {
        name: 'John Doe',
        age: 30,
        email: 'john.doe@example.com',
        phone: '+1234567890',
        createdAt: '2021-01-01T00:00:00Z',
      };

      const result = formatterUtils.cleanObject(input);
      expect(result).toEqual(expected);
    });

    it('should preserve Date objects', () => {
      const dateObj = new Date('2023-01-01T00:00:00Z');
      const input = {
        name: 'Test',
        createdAt: dateObj,
        nestedObj: { key: 'value' },
      };

      const expected = {
        name: 'Test',
        createdAt: dateObj,
      };

      const result = formatterUtils.cleanObject(input);
      expect(result).toEqual(expected);
    });

    it('should return non-object input as-is', () => {
      expect(formatterUtils.cleanObject(null)).toBeNull();
      expect(formatterUtils.cleanObject(undefined)).toBeUndefined();
    });
  });

  describe('parseEventType', () => {
    it('should return undefined for empty categories array', () => {
      expect(formatterUtils.parseEventType([], 'account')).toBeUndefined();
    });

    it('should return undefined for null categories', () => {
      expect(formatterUtils.parseEventType(null, 'account')).toBeUndefined();
    });

    it('should return content after prefix for matching category', () => {
      expect(formatterUtils.parseEventType(['account_42', 'message_100'], 'account')).toBe('42');
    });

    it('should return undefined when no category matches prefix', () => {
      expect(formatterUtils.parseEventType(['account_42'], 'message')).toBeUndefined();
    });

    it('should return undefined when content is the string "undefined"', () => {
      expect(formatterUtils.parseEventType(['account_undefined'], 'account')).toBeUndefined();
    });
  });

  describe('normalizeEvents', () => {
    it('should map out_of_band to bounce', () => {
      expect(formatterUtils.normalizeEvents('out_of_band')).toBe('bounce');
    });

    it('should map delivery to delivered', () => {
      expect(formatterUtils.normalizeEvents('delivery')).toBe('delivered');
    });

    it('should map initial_open to open', () => {
      expect(formatterUtils.normalizeEvents('initial_open')).toBe('open');
    });

    it('should map list_unsubscribe to unsubscribe', () => {
      expect(formatterUtils.normalizeEvents('list_unsubscribe')).toBe('unsubscribe');
    });

    it('should map group_unsubscribe to unsubscribe', () => {
      expect(formatterUtils.normalizeEvents('group_unsubscribe')).toBe('unsubscribe');
    });

    it('should map spam_complaint to spamreport', () => {
      expect(formatterUtils.normalizeEvents('spam_complaint')).toBe('spamreport');
    });

    it('should return input unchanged for standard event names', () => {
      expect(formatterUtils.normalizeEvents('delivered')).toBe('delivered');
      expect(formatterUtils.normalizeEvents('open')).toBe('open');
      expect(formatterUtils.normalizeEvents('click')).toBe('click');
    });
  });

  describe('removeQueryStringFromUrl', () => {
    it('should return null/undefined as-is', () => {
      expect(formatterUtils.removeQueryStringFromUrl(null)).toBeNull();
      expect(formatterUtils.removeQueryStringFromUrl(undefined)).toBeUndefined();
    });

    it('should strip query string from regular URL', () => {
      expect(formatterUtils.removeQueryStringFromUrl('https://example.com/page?foo=bar')).toBe(
        'https://example.com/page',
      );
    });

    it('should decode and strip query from bmsclick URL', () => {
      const encodedUrl = Buffer.from('https://example.com/page?param=value').toString('base64');
      const bmsclickUrl = `https://bmsclick.example.com/redirect?url=${encodedUrl}`;
      const result = formatterUtils.removeQueryStringFromUrl(bmsclickUrl);
      expect(result).toBe('https://example.com/page');
    });

    it('should return null for bmsclick URL containing array pattern', () => {
      const encodedUrl = Buffer.from('https://a.com","http://b.com').toString('base64');
      const bmsclickUrl = `https://bmsclick.example.com/redirect?url=${encodedUrl}`;
      const result = formatterUtils.removeQueryStringFromUrl(bmsclickUrl);
      expect(result).toBeNull();
    });
  });

  describe('getMailBoxProvider', () => {
    it('should return Gmail for gmail.com', () => {
      expect(formatterUtils.getMailBoxProvider('user@gmail.com')).toBe('Gmail');
    });

    it('should return Gmail for googlemail.com', () => {
      expect(formatterUtils.getMailBoxProvider('user@googlemail.com')).toBe('Gmail');
    });

    it('should return Yahoo for yahoo domains', () => {
      expect(formatterUtils.getMailBoxProvider('user@yahoo.com')).toBe('Yahoo');
      expect(formatterUtils.getMailBoxProvider('user@yahoo.com.br')).toBe('Yahoo');
    });

    it('should return Microsoft for hotmail.com, outlook.com, live.com', () => {
      expect(formatterUtils.getMailBoxProvider('user@hotmail.com')).toBe('Microsoft');
      expect(formatterUtils.getMailBoxProvider('user@outlook.com')).toBe('Microsoft');
      expect(formatterUtils.getMailBoxProvider('user@live.com')).toBe('Microsoft');
    });

    it('should return iCloud for icloud.com, me.com, mac.com', () => {
      expect(formatterUtils.getMailBoxProvider('user@icloud.com')).toBe('iCloud');
      expect(formatterUtils.getMailBoxProvider('user@me.com')).toBe('iCloud');
      expect(formatterUtils.getMailBoxProvider('user@mac.com')).toBe('iCloud');
    });

    it('should return Other for unknown domains', () => {
      expect(formatterUtils.getMailBoxProvider('user@company.com')).toBe('Other');
    });
  });

  describe('normalizeTimestamp', () => {
    it('should multiply by 1000 when timestamp is 10 digits (seconds format)', () => {
      expect(formatterUtils.normalizeTimestamp(1700000000)).toBe(1700000000000);
    });

    it('should return as-is when timestamp is 13 digits (milliseconds format)', () => {
      expect(formatterUtils.normalizeTimestamp(1700000000000)).toBe(1700000000000);
    });
  });

  describe('isValidEmailOpen', () => {
    it('should return false for empty/whitespace user agent', () => {
      expect(formatterUtils.isValidEmailOpen('')).toBe(false);
      expect(formatterUtils.isValidEmailOpen('  ')).toBe(false);
      expect(formatterUtils.isValidEmailOpen(null)).toBe(false);
    });

    it('should return false for known bot user agents', () => {
      expect(formatterUtils.isValidEmailOpen('HubSpot Connect')).toBe(false);
      expect(formatterUtils.isValidEmailOpen('cortex/1.0')).toBe(false);
    });

    it('should return true for bare Mozilla/5.0', () => {
      expect(formatterUtils.isValidEmailOpen('Mozilla/5.0')).toBe(true);
    });

    it('should return true for GoogleImageProxy', () => {
      expect(formatterUtils.isValidEmailOpen('GoogleImageProxy 1.0')).toBe(true);
    });

    it('should return true for YahooMailProxy', () => {
      expect(formatterUtils.isValidEmailOpen('YahooMailProxy/1.0')).toBe(true);
    });

    it('should return false for unusual browser combinations (e.g. Firefox + Edge)', () => {
      expect(formatterUtils.isValidEmailOpen('Mozilla/5.0 Firefox/120.0 Edge/120.0')).toBe(false);
    });

    it('should return true for standard Chrome+Safari WebKit combination', () => {
      expect(
        formatterUtils.isValidEmailOpen(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        ),
      ).toBe(true);
    });

    it('should return true for mobile device user agents', () => {
      expect(formatterUtils.isValidEmailOpen('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)')).toBe(true);
    });
  });

  describe('isSimpleObject', () => {
    it('should return false for null', () => {
      expect(formatterUtils.isSimpleObject(null)).toBe(false);
    });

    it('should return false for array', () => {
      expect(formatterUtils.isSimpleObject([1, 2, 3])).toBe(false);
    });

    it('should return false for object with nested object values', () => {
      expect(formatterUtils.isSimpleObject({ a: { b: 1 } })).toBe(false);
    });

    it('should return true for flat object with only primitives and null', () => {
      expect(formatterUtils.isSimpleObject({ a: 'str', b: 123, c: true, d: null })).toBe(true);
    });
  });

  describe('sendSlackWebhook', () => {
    it('should POST to SLACK_WEBHOOK_URL with text in blocks', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

      await formatterUtils.sendSlackWebhook({ text: 'test message', account: 'acct1' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test message'),
        }),
      );
    });

    it('should include support button block when showSupportButton is true', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

      await formatterUtils.sendSlackWebhook({
        text: 'alert',
        account: 'acct1',
        showSupportButton: true,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.blocks).toHaveLength(2);
      expect(body.blocks[1].type).toBe('actions');
    });

    it('should not include support button block when showSupportButton is false', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

      await formatterUtils.sendSlackWebhook({
        text: 'alert',
        account: 'acct1',
        showSupportButton: false,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.blocks).toHaveLength(1);
    });
  });

  describe('logInfo', () => {
    it('should log when LOG_LEVEL is DEBUG', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const oldLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'DEBUG';

      formatterUtils.logInfo('test message');
      expect(consoleSpy).toHaveBeenCalledWith('test message');

      process.env.LOG_LEVEL = oldLevel;
      consoleSpy.mockRestore();
    });

    it('should not log when LOG_LEVEL is not DEBUG', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const oldLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'INFO';

      formatterUtils.logInfo('test message');
      expect(consoleSpy).not.toHaveBeenCalled();

      process.env.LOG_LEVEL = oldLevel;
      consoleSpy.mockRestore();
    });
  });
});
