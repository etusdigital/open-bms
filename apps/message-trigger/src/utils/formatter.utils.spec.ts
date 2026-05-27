import { Test, TestingModule } from '@nestjs/testing';
import { FormatterUtils } from './formatter.utils';
import { BadRequestException } from '@nestjs/common';
import { NewMessageDto } from '../dtos/message.dto';
import { LeadStateMessage } from '../interfaces';

describe('FormatterUtils', () => {
  let utils: FormatterUtils;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FormatterUtils],
    }).compile();

    utils = module.get<FormatterUtils>(FormatterUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(utils).toBeDefined();
    });

    it('should initialize accentsMap', () => {
      expect(utils.accentsMap).toBeDefined();
      expect(utils.accentsMap.a).toBe('á|à|ã|â|À|Á|Ã|Â');
      expect(utils.accentsMap.e).toBe('é|è|ê|É|È|Ê');
      expect(utils.accentsMap.i).toBe('í|ì|î|Í|Ì|Î');
      expect(utils.accentsMap.o).toBe('ó|ò|ô|õ|Ó|Ò|Ô|Õ');
      expect(utils.accentsMap.u).toBe('ú|ù|û|ü|Ú|Ù|Û|Ü');
      expect(utils.accentsMap.c).toBe('ç|Ç');
      expect(utils.accentsMap.n).toBe('ñ|Ñ');
    });
  });

  describe('stripString', () => {
    it('should remove simple HTML tags', () => {
      // Arrange
      const input = '<p>Hello World</p>';

      // Act
      const result = utils.stripString(input);

      // Assert
      expect(result).toBe('Hello World');
    });

    it('should remove HTML tags with attributes', () => {
      // Arrange
      const input = '<div class="container" id="main">Content</div>';

      // Act
      const result = utils.stripString(input);

      // Assert
      expect(result).toBe('Content');
    });

    it('should remove nested HTML tags', () => {
      // Arrange
      const input = '<div><p><strong>Bold text</strong> in paragraph</p></div>';

      // Act
      const result = utils.stripString(input);

      // Assert
      expect(result).toBe('Bold text in paragraph');
    });

    it('should remove multiple HTML tags', () => {
      // Arrange
      const input = '<h1>Title</h1><p>Paragraph</p><span>Span</span>';

      // Act
      const result = utils.stripString(input);

      // Assert
      expect(result).toBe('TitleParagraphSpan');
    });

    it('should keep text without HTML tags', () => {
      // Arrange
      const input = 'Plain text without tags';

      // Act
      const result = utils.stripString(input);

      // Assert
      expect(result).toBe('Plain text without tags');
    });

    it('should handle empty string', () => {
      // Arrange
      const input = '';

      // Act
      const result = utils.stripString(input);

      // Assert
      expect(result).toBe('');
    });

    it('should handle self-closing tags', () => {
      // Arrange
      const input = 'Text with <br/> line break and <img src="test.jpg"/> image';

      // Act
      const result = utils.stripString(input);

      // Assert
      expect(result).toBe('Text with  line break and  image');
    });

    it('should handle tags with special characters', () => {
      // Arrange
      const input = '<a href="http://example.com?param=value&other=123">Link</a>';

      // Act
      const result = utils.stripString(input);

      // Assert
      expect(result).toBe('Link');
    });

    it('should handle incomplete tags', () => {
      // Arrange
      const input = 'Text with <incomplete tag';

      // Act
      const result = utils.stripString(input);

      // Assert
      // Incomplete tags are removed by the regex if they end without >
      expect(result).toBe('Text with <incomplete tag');
    });
  });

  describe('parseBase64ToObject', () => {
    it('should parse valid base64 encoded JSON to LeadStateMessage', () => {
      // Arrange
      const mockLeadState: LeadStateMessage = {
        id: 'lead-123',
        activeStepId: '1',
        startedAt: 1234567890,
        automation: {
          id: 50,
          name: 'Test Automation',
          type: 'email',
          version: '1.0.0',
        },
        contact: {
          id: 100,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      } as LeadStateMessage;

      const base64Data = Buffer.from(JSON.stringify(mockLeadState)).toString('base64');
      const subscriptionMessage: NewMessageDto = {
        message: {
          data: base64Data,
          messageId: 'msg-123',
          message_id: 'msg-123',
          publishTime: '2024-01-15T10:00:00Z',
          publish_time: '2024-01-15T10:00:00Z',
        },
        subscription: 'projects/test/subscriptions/test-sub',
      };

      // Act
      const result = utils.parseBase64ToObject(subscriptionMessage);

      // Assert
      expect(result).toEqual(mockLeadState);
      expect(result.id).toBe('lead-123');
      expect(result.automation.name).toBe('Test Automation');
      expect(result.contact.email).toBe('test@example.com');
    });

    it('should parse base64 with complex nested objects', () => {
      // Arrange
      const complexData = {
        id: 'complex-123',
        nested: {
          level1: {
            level2: {
              value: 'deep',
            },
          },
        },
        array: [1, 2, 3],
      };

      const base64Data = Buffer.from(JSON.stringify(complexData)).toString('base64');
      const subscriptionMessage: NewMessageDto = {
        message: {
          data: base64Data,
          messageId: 'msg-456',
          message_id: 'msg-456',
          publishTime: '2024-01-15T10:00:00Z',
          publish_time: '2024-01-15T10:00:00Z',
        },
        subscription: 'projects/test/subscriptions/test-sub',
      };

      // Act
      const result: any = utils.parseBase64ToObject(subscriptionMessage);

      // Assert
      expect(result).toEqual(complexData);
      expect(result.nested.level1.level2.value).toBe('deep');
      expect(result.array).toEqual([1, 2, 3]);
    });

    it('should throw BadRequestException for invalid base64 data', () => {
      // Arrange
      const subscriptionMessage: NewMessageDto = {
        message: {
          data: 'invalid-base64-!@#$%',
          messageId: 'msg-789',
          message_id: 'msg-789',
          publishTime: '2024-01-15T10:00:00Z',
          publish_time: '2024-01-15T10:00:00Z',
        },
        subscription: 'projects/test/subscriptions/test-sub',
      };

      // Act & Assert
      expect(() => utils.parseBase64ToObject(subscriptionMessage)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for valid base64 but invalid JSON', () => {
      // Arrange
      const invalidJSON = 'not a valid JSON {]';
      const base64Data = Buffer.from(invalidJSON).toString('base64');
      const subscriptionMessage: NewMessageDto = {
        message: {
          data: base64Data,
          messageId: 'msg-999',
          message_id: 'msg-999',
          publishTime: '2024-01-15T10:00:00Z',
          publish_time: '2024-01-15T10:00:00Z',
        },
        subscription: 'projects/test/subscriptions/test-sub',
      };

      // Act & Assert
      expect(() => utils.parseBase64ToObject(subscriptionMessage)).toThrow(BadRequestException);
    });

    it('should include subscription message in error message', () => {
      // Arrange
      const subscriptionMessage: NewMessageDto = {
        message: {
          data: 'invalid-data',
          messageId: 'error-msg-123',
          message_id: 'error-msg-123',
          publishTime: '2024-01-15T10:00:00Z',
          publish_time: '2024-01-15T10:00:00Z',
        },
        subscription: 'projects/test/subscriptions/error-sub',
      };

      // Act & Assert
      try {
        utils.parseBase64ToObject(subscriptionMessage);
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Unable to parse data to Batch');
        expect(error.message).toContain(JSON.stringify(subscriptionMessage));
      }
    });

    it('should handle empty base64 data', () => {
      // Arrange
      const base64Data = Buffer.from('').toString('base64');
      const subscriptionMessage: NewMessageDto = {
        message: {
          data: base64Data,
          messageId: 'msg-empty',
          message_id: 'msg-empty',
          publishTime: '2024-01-15T10:00:00Z',
          publish_time: '2024-01-15T10:00:00Z',
        },
        subscription: 'projects/test/subscriptions/test-sub',
      };

      // Act & Assert
      expect(() => utils.parseBase64ToObject(subscriptionMessage)).toThrow(BadRequestException);
    });

    it('should parse base64 with special characters in JSON', () => {
      // Arrange
      const specialData = {
        message: 'Hello "World" with\nnewlines\tand\ttabs',
        emoji: '😊🎉',
        unicode: 'Olá, 你好',
      };

      const base64Data = Buffer.from(JSON.stringify(specialData)).toString('base64');
      const subscriptionMessage: NewMessageDto = {
        message: {
          data: base64Data,
          messageId: 'msg-special',
          message_id: 'msg-special',
          publishTime: '2024-01-15T10:00:00Z',
          publish_time: '2024-01-15T10:00:00Z',
        },
        subscription: 'projects/test/subscriptions/test-sub',
      };

      // Act
      const result: any = utils.parseBase64ToObject(subscriptionMessage);

      // Assert
      expect(result).toEqual(specialData);
      expect(result.emoji).toBe('😊🎉');
      expect(result.unicode).toBe('Olá, 你好');
    });
  });

  describe('slugify', () => {
    it('should remove accents from lowercase vowels', () => {
      // Act & Assert
      expect(utils.slugify('café')).toBe('cafe');
      expect(utils.slugify('açúcar')).toBe('acucar');
      expect(utils.slugify('pão')).toBe('pao');
      expect(utils.slugify('ñoño')).toBe('nono');
    });

    it('should remove accents from uppercase vowels', () => {
      // Act & Assert
      // Note: slugify replaces all accented chars (upper and lower) with lowercase
      expect(utils.slugify('CAFÉ')).toBe('CAFe');
      expect(utils.slugify('AÇÚCAR')).toBe('AcuCAR');
      expect(utils.slugify('PÃO')).toBe('PaO');
    });

    it('should remove all types of "a" accents', () => {
      // Act
      const result = utils.slugify('á à ã â À Á Ã Â');

      // Assert
      // Note: all accented "a" characters (upper and lower) are replaced with lowercase "a"
      expect(result).toBe('a a a a a a a a');
    });

    it('should remove all types of "e" accents', () => {
      // Act
      const result = utils.slugify('é è ê É È Ê');

      // Assert
      // Note: all accented "e" characters (upper and lower) are replaced with lowercase "e"
      expect(result).toBe('e e e e e e');
    });

    it('should remove all types of "i" accents', () => {
      // Act
      const result = utils.slugify('í ì î Í Ì Î');

      // Assert
      // Note: all accented "i" characters (upper and lower) are replaced with lowercase "i"
      expect(result).toBe('i i i i i i');
    });

    it('should remove all types of "o" accents', () => {
      // Act
      const result = utils.slugify('ó ò ô õ Ó Ò Ô Õ');

      // Assert
      // Note: all accented "o" characters (upper and lower) are replaced with lowercase "o"
      expect(result).toBe('o o o o o o o o');
    });

    it('should remove all types of "u" accents', () => {
      // Act
      const result = utils.slugify('ú ù û ü Ú Ù Û Ü');

      // Assert
      // Note: all accented "u" characters (upper and lower) are replaced with lowercase "u"
      expect(result).toBe('u u u u u u u u');
    });

    it('should remove cedilla from "c"', () => {
      // Act & Assert
      expect(utils.slugify('ç')).toBe('c');
      expect(utils.slugify('Ç')).toBe('c');
      expect(utils.slugify('açúcar')).toBe('acucar');
      expect(utils.slugify('AÇÚCAR')).toBe('AcuCAR');
    });

    it('should remove tilde from "n"', () => {
      // Act & Assert
      expect(utils.slugify('ñ')).toBe('n');
      expect(utils.slugify('Ñ')).toBe('n');
      expect(utils.slugify('niño')).toBe('nino');
      expect(utils.slugify('NIÑO')).toBe('NInO');
    });

    it('should handle text without accents', () => {
      // Arrange
      const input = 'hello world 123';

      // Act
      const result = utils.slugify(input);

      // Assert
      expect(result).toBe('hello world 123');
    });

    it('should handle empty string', () => {
      // Act
      const result = utils.slugify('');

      // Assert
      expect(result).toBe('');
    });

    it('should handle null by returning empty string', () => {
      // Act
      const result = utils.slugify(null);

      // Assert
      expect(result).toBe('');
    });

    it('should handle undefined by returning empty string', () => {
      // Act
      const result = utils.slugify(undefined);

      // Assert
      expect(result).toBe('');
    });

    it('should handle mixed accented and non-accented text', () => {
      // Arrange
      const input = 'São Paulo - Brasil (país tropical)';

      // Act
      const result = utils.slugify(input);

      // Assert
      expect(result).toBe('Sao Paulo - Brasil (pais tropical)');
    });

    it('should handle Portuguese sentence', () => {
      // Arrange
      const input = 'A ação foi rápida e decisiva';

      // Act
      const result = utils.slugify(input);

      // Assert
      expect(result).toBe('A acao foi rapida e decisiva');
    });

    it('should handle Spanish sentence', () => {
      // Arrange
      const input = 'El niño español comió ñoquis';

      // Act
      const result = utils.slugify(input);

      // Assert
      expect(result).toBe('El nino espanol comio noquis');
    });

    it('should handle French sentence', () => {
      // Arrange
      const input = 'Café à la crème';

      // Act
      const result = utils.slugify(input);

      // Assert
      expect(result).toBe('Cafe a la creme');
    });

    it('should preserve numbers and special characters', () => {
      // Arrange
      const input = 'Test-123_ação@email.com';

      // Act
      const result = utils.slugify(input);

      // Assert
      expect(result).toBe('Test-123_acao@email.com');
    });

    it('should handle only accented characters', () => {
      // Arrange
      const input = 'áéíóúçñ';

      // Act
      const result = utils.slugify(input);

      // Assert
      expect(result).toBe('aeioucn');
    });

    it('should replace accented chars with lowercase equivalents', () => {
      // Arrange
      const input = 'Ação RÁPIDA';

      // Act
      const result = utils.slugify(input);

      // Assert
      // Accented uppercase letters are replaced with lowercase
      expect(result).toBe('Acao RaPIDA');
      expect(result).not.toBe('acao rapida');
      expect(result).not.toBe('Acao RAPIDA');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long strings in stripString', () => {
      // Arrange
      const longText = 'A'.repeat(10000);
      const input = `<div>${longText}</div>`;

      // Act
      const result = utils.stripString(input);

      // Assert
      expect(result).toBe(longText);
      expect(result.length).toBe(10000);
    });

    it('should handle very long strings in slugify', () => {
      // Arrange
      const longText = 'á'.repeat(10000);

      // Act
      const result = utils.slugify(longText);

      // Assert
      expect(result).toBe('a'.repeat(10000));
      expect(result.length).toBe(10000);
    });

    it('should handle multiple consecutive accents', () => {
      // Arrange
      const input = 'ááááééééííííóóóóúúúú';

      // Act
      const result = utils.slugify(input);

      // Assert
      expect(result).toBe('aaaaeeeeiiiioooouuuu');
    });
  });
});
