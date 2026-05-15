import { BadRequestException } from '@nestjs/common';
import { FormatterUtils } from './formatter.utils';
import { SubscriptionMessage } from '../interfaces';

describe('FormatterUtils', () => {
  let formatter: FormatterUtils;

  beforeEach(() => {
    formatter = new FormatterUtils();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('stripString', () => {
    it('should remove HTML tags', () => {
      expect(formatter.stripString('<p>Hello <b>World</b></p>')).toBe('Hello World');
    });

    it('should return plain string unchanged', () => {
      expect(formatter.stripString('Hello World')).toBe('Hello World');
    });
  });

  describe('parseBatch', () => {
    it('should decode valid base64 Pub/Sub message', () => {
      const original = { campaign: { id: 1, title: 'Test' } };
      const data = Buffer.from(JSON.stringify(original)).toString('base64');
      const msg: SubscriptionMessage = {
        message: { data, messageId: '123', message_id: '123', publishTime: '', publish_time: '', attributes: { key: '' } },
        subscription: 'sub',
      };
      const result = formatter.parseBatch(msg);
      expect(result).toEqual(original);
    });

    it('should throw BadRequestException on invalid base64', () => {
      const msg: SubscriptionMessage = {
        message: { data: '!!!invalid!!!', messageId: '123', message_id: '123', publishTime: '', publish_time: '', attributes: { key: '' } },
        subscription: 'sub',
      };
      expect(() => formatter.parseBatch(msg)).toThrow(BadRequestException);
    });
  });
});
