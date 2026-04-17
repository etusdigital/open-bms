import { Utils } from './utils';

describe('Utils', () => {
  let utils: Utils;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    utils = new Utils();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = utils.safeJsonParse('{"key":"value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse JSON arrays', () => {
      const result = utils.safeJsonParse('[1,2,3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should throw on invalid JSON', () => {
      expect(() => utils.safeJsonParse('not json')).toThrow();
    });

    it('should parse JSON with nested objects', () => {
      const result = utils.safeJsonParse('{"a":{"b":"c"}}');
      expect(result).toEqual({ a: { b: 'c' } });
    });
  });

  describe('isValidLeadMessage', () => {
    it('should return true for valid lead message', () => {
      const data = {
        contact: { email: 'test@test.com', firstName: 'John' },
        apiKey: 'key123',
        tagName: 'tag1',
      };
      expect(utils.isValidLeadMessage(data)).toBe(true);
    });

    it('should return false when contact is missing', () => {
      const data = { apiKey: 'key123', tagName: 'tag1' };
      expect(utils.isValidLeadMessage(data)).toBe(false);
    });

    it('should return false when apiKey is missing', () => {
      const data = { contact: { email: 'test@test.com' }, tagName: 'tag1' };
      expect(utils.isValidLeadMessage(data)).toBe(false);
    });

    it('should return false when tagName is missing', () => {
      const data = { contact: { email: 'test@test.com' }, apiKey: 'key123' };
      expect(utils.isValidLeadMessage(data)).toBe(false);
    });

    it('should return false for null', () => {
      expect(utils.isValidLeadMessage(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(utils.isValidLeadMessage('string')).toBe(false);
    });

    it('should return false when contact is not an object', () => {
      const data = { contact: 'not-object', apiKey: 'key123', tagName: 'tag1' };
      expect(utils.isValidLeadMessage(data)).toBe(false);
    });

    it('should return false when apiKey is not a string', () => {
      const data = { contact: { email: 'test@test.com' }, apiKey: 123, tagName: 'tag1' };
      expect(utils.isValidLeadMessage(data)).toBe(false);
    });
  });

  describe('isValidMessageType', () => {
    it('should return true for valid LeadMessage', () => {
      const data = {
        contact: { email: 'test@test.com', firstName: 'John' },
        apiKey: 'key123',
        tagName: 'tag1',
      };
      expect(utils.isValidMessageType(data)).toBe(true);
    });

    it('should return true for QuizMakerPayload with app', () => {
      const data = { app: 'plusdin-quiz-cc', email: 'test@test.com' };
      expect(utils.isValidMessageType(data)).toBe(true);
    });

    it('should return false for null', () => {
      expect(utils.isValidMessageType(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(utils.isValidMessageType(42)).toBe(false);
    });

    it('should return false when neither contact nor app present', () => {
      expect(utils.isValidMessageType({ apiKey: 'key' })).toBe(false);
    });

    it('should return false when contact is not an object', () => {
      expect(utils.isValidMessageType({ contact: 'string' })).toBe(false);
    });

    it('should return false when app is not a string', () => {
      expect(utils.isValidMessageType({ app: 123 })).toBe(false);
    });
  });

  describe('getRawBody', () => {
    it('should return undefined when raw-body throws', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const { Readable } = require('stream');
      const mockStream = new Readable({
        read() {
          this.destroy(new Error('stream error'));
        },
      });

      const result = await utils.getRawBody(mockStream);
      expect(result).toBeUndefined();
    });

    it('should parse valid LeadMessage from stream', async () => {
      const { Readable } = require('stream');
      const data = JSON.stringify({
        contact: { email: 'test@test.com', firstName: 'John' },
        apiKey: 'key123',
        tagName: 'tag1',
      });
      const stream = Readable.from([Buffer.from(data)]);

      const result = await utils.getRawBody(stream);

      expect(result).toEqual({
        contact: { email: 'test@test.com', firstName: 'John' },
        apiKey: 'key123',
        tagName: 'tag1',
      });
    });

    it('should parse valid QuizMakerPayload from stream', async () => {
      const { Readable } = require('stream');
      const data = JSON.stringify({
        app: 'plusdin-quiz-cc',
        email: 'test@test.com',
      });
      const stream = Readable.from([Buffer.from(data)]);

      const result = await utils.getRawBody(stream);

      expect(result).toEqual({
        app: 'plusdin-quiz-cc',
        email: 'test@test.com',
      });
    });

    it('should return undefined for empty body', async () => {
      const { Readable } = require('stream');
      const stream = Readable.from([Buffer.from('')]);

      const result = await utils.getRawBody(stream);
      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid JSON', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const { Readable } = require('stream');
      const stream = Readable.from([Buffer.from('not valid json')]);

      const result = await utils.getRawBody(stream);
      expect(result).toBeUndefined();
    });

    it('should return undefined for valid JSON that is not a valid message type', async () => {
      const { Readable } = require('stream');
      const data = JSON.stringify({ random: 'data' });
      const stream = Readable.from([Buffer.from(data)]);

      const result = await utils.getRawBody(stream);
      expect(result).toBeUndefined();
    });
  });

  describe('logInfo', () => {
    it('should log when LOG_LEVEL is INFO', () => {
      process.env.LOG_LEVEL = 'INFO';
      const spy = jest.spyOn(console, 'log').mockImplementation();
      utils.logInfo('test message', { key: 'value' });
      expect(spy).toHaveBeenCalledWith('test message', '{"key":"value"}');
    });

    it('should log when LOG_LEVEL is DEBUG', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const spy = jest.spyOn(console, 'log').mockImplementation();
      utils.logInfo('test message', 'simple');
      expect(spy).toHaveBeenCalledWith('test message', 'simple');
    });

    it('should not log when LOG_LEVEL is ERROR', () => {
      process.env.LOG_LEVEL = 'ERROR';
      const spy = jest.spyOn(console, 'log').mockImplementation();
      utils.logInfo('test message');
      expect(spy).not.toHaveBeenCalled();
    });

    it('should default to INFO level when LOG_LEVEL is not set', () => {
      delete process.env.LOG_LEVEL;
      const spy = jest.spyOn(console, 'log').mockImplementation();
      utils.logInfo('test message');
      expect(spy).toHaveBeenCalled();
    });

    it('should handle undefined args', () => {
      process.env.LOG_LEVEL = 'INFO';
      const spy = jest.spyOn(console, 'log').mockImplementation();
      utils.logInfo('test message');
      expect(spy).toHaveBeenCalledWith('test message', undefined);
    });

    it('should stringify object args', () => {
      process.env.LOG_LEVEL = 'INFO';
      const spy = jest.spyOn(console, 'log').mockImplementation();
      utils.logInfo('test', [1, 2, 3]);
      expect(spy).toHaveBeenCalledWith('test', '[1,2,3]');
    });

    it('should pass non-object args directly', () => {
      process.env.LOG_LEVEL = 'INFO';
      const spy = jest.spyOn(console, 'log').mockImplementation();
      utils.logInfo('test', 42);
      expect(spy).toHaveBeenCalledWith('test', 42);
    });
  });
});
