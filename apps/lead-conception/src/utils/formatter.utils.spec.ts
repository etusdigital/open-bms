import { FormatterUtils } from './formatter.utils';

describe('FormatterUtils', () => {
  let utils: FormatterUtils;

  beforeEach(() => {
    utils = new FormatterUtils();
  });

  describe('slugify', () => {
    it('should replace accented characters', () => {
      expect(utils.slugify('email@domínio.com.br')).toBe('email@dominio.com.br');
    });

    it('should replace cedilha', () => {
      expect(utils.slugify('Comunicação')).toBe('Comunicacao');
    });

    it('should return empty string for undefined/null', () => {
      expect(utils.slugify(undefined)).toBe('');
      expect(utils.slugify(null)).toBe('');
    });

    it('should not modify text without accents', () => {
      expect(utils.slugify('hello world')).toBe('hello world');
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid email', () => {
      expect(utils.isValidEmail('user@example.com')).toBe(true);
    });

    it('should return true for email with subdomain', () => {
      expect(utils.isValidEmail('user@mail.example.com')).toBe(true);
    });

    it('should return false for email without @', () => {
      expect(utils.isValidEmail('invalidemail')).toBe(false);
    });

    it('should return false for email without domain', () => {
      expect(utils.isValidEmail('user@')).toBe(false);
    });

    it('should return false for email without TLD', () => {
      expect(utils.isValidEmail('user@domain')).toBe(false);
    });

    it('should return false for email with single char TLD', () => {
      expect(utils.isValidEmail('user@domain.c')).toBe(false);
    });
  });

  describe('formatterEmail', () => {
    it('should convert to lowercase', () => {
      expect(utils.formatterEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    it('should trim spaces', () => {
      expect(utils.formatterEmail('  user@example.com  ')).toBe('user@example.com');
    });

    it('should normalize NFKD/NFC', () => {
      const result = utils.formatterEmail('user@example.com');
      expect(result).toBe('user@example.com');
    });

    it('should strip gmail suffix after @gmail.com', () => {
      expect(utils.formatterEmail('user@gmail.comextra')).toBe('user@gmail.com');
    });
  });

  describe('getMailBoxProvider', () => {
    it('should return Gmail for @gmail.com', () => {
      expect(utils.getMailBoxProvider('user@gmail.com')).toBe('Gmail');
    });

    it('should return Gmail for @googlemail.com', () => {
      expect(utils.getMailBoxProvider('user@googlemail.com')).toBe('Gmail');
    });

    it('should return Yahoo for yahoo domains', () => {
      expect(utils.getMailBoxProvider('user@yahoo.com.br')).toBe('Yahoo');
    });

    it('should return Microsoft for @hotmail.com', () => {
      expect(utils.getMailBoxProvider('user@hotmail.com')).toBe('Microsoft');
    });

    it('should return Microsoft for @outlook.com', () => {
      expect(utils.getMailBoxProvider('user@outlook.com')).toBe('Microsoft');
    });

    it('should return iCloud for @icloud.com', () => {
      expect(utils.getMailBoxProvider('user@icloud.com')).toBe('iCloud');
    });

    it('should return iCloud for @me.com', () => {
      expect(utils.getMailBoxProvider('user@me.com')).toBe('iCloud');
    });

    it('should return Other for unknown domains', () => {
      expect(utils.getMailBoxProvider('user@custom.com')).toBe('Other');
    });
  });

  describe('removeQueryString', () => {
    it('should remove query string from URL', () => {
      expect(utils.removeQueryString('https://example.com?foo=bar')).toBe('https://example.com');
    });

    it('should return URL unchanged when no query string', () => {
      expect(utils.removeQueryString('https://example.com')).toBe('https://example.com');
    });

    it('should return falsy value as-is', () => {
      expect(utils.removeQueryString(null)).toBeNull();
      expect(utils.removeQueryString(undefined)).toBeUndefined();
    });
  });

  describe('cleanUpObjects', () => {
    it('should remove keys with null/undefined/empty string values', () => {
      const obj = { a: 'hello', b: null, c: undefined, d: '' };
      const result = utils.cleanUpObjects(obj);
      expect(result).toEqual({ a: 'hello' });
    });

    it('should process nested objects recursively', () => {
      const obj = { a: { b: 'value', c: null } };
      const result = utils.cleanUpObjects(obj);
      expect(result).toEqual({ a: { b: 'value' } });
    });

    it('should filter arrays removing null/empty elements', () => {
      const arr = ['hello', null, '', 'world'];
      const result = utils.cleanUpObjects(arr);
      expect(result).toEqual(['hello', 'world']);
    });

    it('should return null for array that becomes empty', () => {
      const arr = [null, '', undefined];
      const result = utils.cleanUpObjects(arr);
      expect(result).toBeNull();
    });

    it('should return null for object that becomes empty', () => {
      const obj = { a: null, b: '' };
      const result = utils.cleanUpObjects(obj);
      expect(result).toBeNull();
    });

    it('should not modify strings', () => {
      expect(utils.cleanUpObjects('hello')).toBe('hello');
    });

    it('should remove control characters from strings', () => {
      const obj = { a: 'hello\x00world\x1F' };
      const result = utils.cleanUpObjects(obj);
      expect(result).toEqual({ a: 'helloworld' });
    });
  });

  describe('toPostgresTimestampWithTimezone', () => {
    it('should convert date string to postgres timestamp format', () => {
      const result = utils.toPostgresTimestampWithTimezone('2024-01-15T12:30:00.000Z');
      expect(result).toBe('2024-01-15 12:30:00+00');
    });

    it('should format without milliseconds with +00 suffix', () => {
      const result = utils.toPostgresTimestampWithTimezone('2024-01-15');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+00/);
    });
  });

  describe('removeQuotes', () => {
    it('should remove single and double quotes', () => {
      expect(utils.removeQuotes('"test"')).toBe('test');
      expect(utils.removeQuotes("'test'")).toBe('test');
    });
  });

  describe('configByName', () => {
    it('should return matching config entity', () => {
      const account = {
        accountConfigs: [
          { name: 'api_key', value: 'abc' },
          { name: 'time_zone', value: 'UTC' },
        ],
      } as any;
      const result = utils.configByName(account, 'time_zone');
      expect(result.value).toBe('UTC');
    });

    it('should return undefined when config does not exist', () => {
      const account = { accountConfigs: [{ name: 'api_key', value: 'abc' }] } as any;
      const result = utils.configByName(account, 'nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('stripString', () => {
    it('should remove HTML tags', () => {
      expect(utils.stripString('<p>Hello</p>')).toBe('Hello');
    });

    it('should handle nested tags', () => {
      expect(utils.stripString('<div><b>Bold</b> text</div>')).toBe('Bold text');
    });
  });
});
