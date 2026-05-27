import { FormatterUtils } from './formatter.utils';

describe('Formatter Utils', () => {
  const formatterUtils = new FormatterUtils();

  describe('Function: Slugify', () => {
    it('should be return mae with arg mãe', () => {
      expect(formatterUtils.slugify('mãe')).toBe('mae');
    });

    it('should be return empty with arg is empty', () => {
      expect(formatterUtils.slugify('')).toBe('');
    });

    it('should be return mae with arg mae', () => {
      expect(formatterUtils.slugify('mae')).toBe('mae');
    });
  });

  describe('Function: Slugify with numbers', () => {
    it('should convert number to string and return it', () => {
      expect(formatterUtils.slugify(12345)).toBe('12345');
    });
  });

  describe('Function: stripString', () => {
    it('should remove HTML tags from string', () => {
      expect(formatterUtils.stripString('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('should return plain text unchanged', () => {
      expect(formatterUtils.stripString('no tags here')).toBe('no tags here');
    });
  });

  describe('Function: replaceSpecialChars', () => {
    it('should replace spaces with hyphens', () => {
      expect(formatterUtils.replaceSpecialChars('hello world')).toBe('hello-world');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(formatterUtils.replaceSpecialChars('-hello-')).toBe('hello-');
    });

    it('should collapse multiple hyphens', () => {
      expect(formatterUtils.replaceSpecialChars('hello---world')).toBe('hello-world');
    });
  });

  describe('Function: parseBase64', () => {
    it('should parse valid base64 JSON', () => {
      const data = Buffer.from(JSON.stringify({ key: 'value' })).toString('base64');
      const result = formatterUtils.parseBase64<{ key: string }>(data);
      expect(result).toEqual({ key: 'value' });
    });

    it('should throw BadRequestException for invalid base64 data', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      expect(() => formatterUtils.parseBase64('not-valid-json-base64===')).toThrow('Unable to parse data to Batch');
      consoleSpy.mockRestore();
    });
  });

  describe('Function: isValidEmail', () => {
    it('should return true for valid email', () => {
      expect(formatterUtils.isValidEmail('user@example.com')).toBe(true);
    });

    it('should return false for email without @', () => {
      expect(formatterUtils.isValidEmail('userexample.com')).toBe(false);
    });

    it('should return false for email without domain', () => {
      expect(formatterUtils.isValidEmail('user@')).toBe(false);
    });

    it('should return false for email with spaces', () => {
      expect(formatterUtils.isValidEmail('user @example.com')).toBe(false);
    });
  });

  describe('Function: NormalizeString', () => {
    it('should be remove accents', () => {
      expect(formatterUtils.normalizeString('coração')).toBe('coracao');
    });

    it('should be remove spaces', () => {
      expect(formatterUtils.normalizeString('galo doido')).toBe('galo-doido');
    });

    it('should be remove accents and spaces', () => {
      expect(formatterUtils.normalizeString('galão doido')).toBe('galao-doido');
    });

    it('should return empty string', () => {
      expect(formatterUtils.normalizeString('')).toBe('');
    });

    it('should be string with no-ASCII characters', () => {
      expect(formatterUtils.normalizeString('RTG Empréstimo Pessoal Losango P1')).toBe('rtg-emprestimo-pessoal-losango-p1');
    });
  });
});
