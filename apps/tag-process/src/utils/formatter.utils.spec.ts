import { BadRequestException } from '@nestjs/common';
import { FormatterUtils } from './formatter.utils';

describe('FormatterUtils', () => {
  let formatter: FormatterUtils;

  beforeEach(() => {
    formatter = new FormatterUtils();
  });

  describe('stripString', () => {
    it('should remove HTML tags', () => {
      expect(formatter.stripString('<p>Hello</p>')).toBe('Hello');
    });

    it('should handle nested tags', () => {
      expect(formatter.stripString('<div><span>Test</span></div>')).toBe('Test');
    });

    it('should return empty string for only tags', () => {
      expect(formatter.stripString('<br/>')).toBe('');
    });

    it('should return plain text unchanged', () => {
      expect(formatter.stripString('Hello World')).toBe('Hello World');
    });
  });

  describe('parseLead', () => {
    it('should parse base64 encoded lead message', () => {
      const leadData = { id: 1, tagName: 'test' };
      const encoded = Buffer.from(JSON.stringify(leadData)).toString('base64');
      const subscriptionMessage = { message: { data: encoded } };

      const result = formatter.parseLead(subscriptionMessage);

      expect(result).toEqual(leadData);
    });

    it('should throw BadRequestException for invalid data', () => {
      const subscriptionMessage = { message: { data: 'not-valid-base64!!!' } };

      expect(() => formatter.parseLead(subscriptionMessage)).toThrow(BadRequestException);
    });
  });

  describe('parseBatch', () => {
    it('should parse base64 encoded tag batch', () => {
      const batchData = { action: 'add', tag: 'test-tag', contacts: [] };
      const encoded = Buffer.from(JSON.stringify(batchData)).toString('base64');
      const subscriptionMessage = {
        message: {
          data: encoded,
          messageId: '123',
          message_id: '123',
          publishTime: '2024-01-01',
          publish_time: '2024-01-01',
          attributes: {},
        },
        subscription: 'sub-1',
      };

      const result = formatter.parseBatch(subscriptionMessage);

      expect(result).toEqual(batchData);
    });

    it('should throw BadRequestException for invalid data', () => {
      const subscriptionMessage = {
        message: {
          data: '!!!invalid!!!',
          messageId: '123',
          message_id: '123',
          publishTime: '2024-01-01',
          publish_time: '2024-01-01',
          attributes: {},
        },
        subscription: 'sub-1',
      };

      expect(() => formatter.parseBatch(subscriptionMessage)).toThrow(BadRequestException);
    });
  });

  describe('slugify', () => {
    it('should replace accented characters', () => {
      expect(formatter.slugify('caf\u00e9')).toBe('cafe');
      expect(formatter.slugify('\u00e7\u00e3o')).toBe('cao');
    });

    it('should handle uppercase accents', () => {
      expect(formatter.slugify('\u00c9')).toBe('e');
      expect(formatter.slugify('\u00c7')).toBe('c');
    });

    it('should return empty string for falsy input', () => {
      expect(formatter.slugify('')).toBe('');
      expect(formatter.slugify(null)).toBe('');
      expect(formatter.slugify(undefined)).toBe('');
    });

    it('should return text unchanged when no accents', () => {
      expect(formatter.slugify('hello world')).toBe('hello world');
    });
  });
});
