import { HttpException, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { createLeadMessage, createQuizPayload, createAccountEntity } from './__mocks__/test-fixtures';

describe('AppService', () => {
  let service: AppService;
  let mockMsgopsService: any;
  let mockLeadPublisher: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockMsgopsService = {
      findAccountByApiKey: jest.fn(),
    };
    mockLeadPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    service = new AppService(mockMsgopsService, mockLeadPublisher);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('process', () => {
    it('should throw 403 when account not found', async () => {
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(null);
      const message = createLeadMessage();

      await expect(service.process(message)).rejects.toThrow(
        new HttpException('Account not found', HttpStatus.FORBIDDEN),
      );
    });

    it('should publish message when account is found', async () => {
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(createAccountEntity());
      const message = createLeadMessage();

      const result = await service.process(message);

      expect(mockLeadPublisher.publish).toHaveBeenCalledWith(message, { type: 'lead' });
      expect(result.status).toBe(200);
      expect(result.message).toBe('Message published successfully.');
    });

    it('should map custom fields when account has customFieldsKeys', async () => {
      const account = createAccountEntity({
        customFieldsKeys: ['company', 'role'],
      });
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(account);
      const message = createLeadMessage();
      (message as any).company = 'TestCorp';
      (message as any).role = 'Developer';

      await service.process(message);

      expect(message.contact.customFields).toEqual({
        company: 'TestCorp',
        role: 'Developer',
      });
    });

    it('should initialize customFields if not present and custom fields match', async () => {
      const account = createAccountEntity({
        customFieldsKeys: ['company'],
      });
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(account);
      const message = createLeadMessage();
      message.contact.customFields = undefined;
      (message as any).company = 'TestCorp';

      await service.process(message);

      expect(message.contact.customFields).toEqual({ company: 'TestCorp' });
    });

    it('should not modify message when no customFieldsKeys match', async () => {
      const account = createAccountEntity({
        customFieldsKeys: ['nonexistent'],
      });
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(account);
      const message = createLeadMessage();
      const originalContact = { ...message.contact };

      await service.process(message);

      expect(message.contact.customFields).toBeUndefined();
    });

    it('should clean up questions for quiz payloads', async () => {
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(createAccountEntity());
      const message = createLeadMessage({
        app: 'plusdin-quiz-cc',
      }) as any;
      message.questions = [{ question: 'Q1', answer: 'A1' }, null, { question: 'Q2', answer: 'A2' }];

      await service.process(message);

      expect(mockLeadPublisher.publish).toHaveBeenCalled();
    });

    it('should call findAccountByApiKey with the correct apiKey', async () => {
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(createAccountEntity());
      const message = createLeadMessage({ apiKey: 'specific-key' });

      await service.process(message);

      expect(mockMsgopsService.findAccountByApiKey).toHaveBeenCalledWith('specific-key');
    });

    it('should handle case-insensitive custom field matching', async () => {
      const account = createAccountEntity({
        customFieldsKeys: ['company'],
      });
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(account);
      const message = createLeadMessage();
      (message as any).Company = 'TestCorp';

      await service.process(message);

      // customFieldsKeys includes 'company' (lowercase)
      // The code checks item.toLocaleLowerCase() against customFieldsKeys
      expect(message.contact.customFields).toEqual({ Company: 'TestCorp' });
    });

    it('should not create customFields when account has no customFieldsKeys', async () => {
      const account = createAccountEntity({
        customFieldsKeys: undefined as any,
      });
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(account);
      const message = createLeadMessage();

      await service.process(message);

      expect(mockLeadPublisher.publish).toHaveBeenCalled();
    });
  });

  describe('updateContact', () => {
    it('should throw 403 when account not found', async () => {
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(null);
      const message = createLeadMessage();

      await expect(service.updateContact(message)).rejects.toThrow(
        new HttpException('Account not found', HttpStatus.FORBIDDEN),
      );
    });

    it('should publish update message when account is found', async () => {
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(createAccountEntity());
      const message = createLeadMessage();

      const result = await service.updateContact(message);

      expect(mockLeadPublisher.publish).toHaveBeenCalledWith(message, { type: 'update' });
      expect(result.status).toBe(200);
    });

    it('should call findAccountByApiKey with correct key', async () => {
      mockMsgopsService.findAccountByApiKey.mockResolvedValue(createAccountEntity());
      const message = createLeadMessage({ apiKey: 'update-key' });

      await service.updateContact(message);

      expect(mockMsgopsService.findAccountByApiKey).toHaveBeenCalledWith('update-key');
    });
  });

  describe('parsePayloadQuiz', () => {
    const mockHeaders = {
      origin: 'https://example.com',
      referer: 'https://example.com/quiz',
    } as any;

    it('should throw 400 when contact is missing', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({ contact: undefined });

      await expect(service.parsePayloadQuiz(payload, mockHeaders)).rejects.toThrow(
        new HttpException('Invalid payload', HttpStatus.BAD_REQUEST),
      );
    });

    it('should send slack webhook when contact is missing', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      const slackSpy = jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({ contact: undefined });

      try {
        await service.parsePayloadQuiz(payload, mockHeaders);
      } catch {}

      expect(slackSpy).toHaveBeenCalled();
    });

    it('should send slack webhook when apiKey is missing', async () => {
      const slackSpy = jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({
        apiKey: undefined as any,
        contact: { email: 'test@test.com', firstName: 'Test' },
      });

      await service.parsePayloadQuiz(payload, mockHeaders);

      expect(slackSpy).toHaveBeenCalled();
    });

    it('should send slack webhook when tagName is missing', async () => {
      const slackSpy = jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({
        tagName: undefined as any,
        contact: { email: 'test@test.com', firstName: 'Test' },
      });

      await service.parsePayloadQuiz(payload, mockHeaders);

      expect(slackSpy).toHaveBeenCalled();
    });

    it('should throw 400 when app is invalid', async () => {
      jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({
        app: 'invalid-app',
        contact: { email: 'test@test.com', firstName: 'Test' },
      });

      await expect(service.parsePayloadQuiz(payload, mockHeaders)).rejects.toThrow(
        new HttpException('Invalid app in payload quiz', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw 400 when app is empty', async () => {
      jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({
        app: '',
        contact: { email: 'test@test.com', firstName: 'Test' },
      });

      await expect(service.parsePayloadQuiz(payload, mockHeaders)).rejects.toThrow(
        new HttpException('Invalid app in payload quiz', HttpStatus.BAD_REQUEST),
      );
    });

    it('should split name into firstName and lastName', async () => {
      jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({
        name: 'John Michael Doe',
        contact: { email: 'test@test.com', firstName: 'Test' },
      });

      const result = await service.parsePayloadQuiz(payload, mockHeaders);

      expect(result.contact.firstName).toBe('John');
      expect(result.contact.lastName).toBe('Michael Doe');
    });

    it('should handle single name (no lastName)', async () => {
      jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({
        name: 'John',
        contact: { email: 'test@test.com', firstName: 'Test' },
      });

      const result = await service.parsePayloadQuiz(payload, mockHeaders);

      expect(result.contact.firstName).toBe('John');
      expect(result.contact.lastName).toBe('');
    });

    it('should use email from payload in contact', async () => {
      jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({
        email: 'quiz@test.com',
        contact: { email: 'test@test.com', firstName: 'Test' },
      });

      const result = await service.parsePayloadQuiz(payload, mockHeaders);

      expect(result.contact.email).toBe('quiz@test.com');
    });

    it('should apply app config (apiKey and tagName) from apps.json', async () => {
      jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({
        app: 'plusdin-quiz-cc',
        contact: { email: 'test@test.com', firstName: 'Test' },
      });

      const result = await service.parsePayloadQuiz(payload, mockHeaders);

      expect(result.apiKey).toBe('cbf3883074639ea9e3aced35ac37d706');
      expect(result.tagName).toBe('plusdin-quiz-cc');
    });

    it('should handle empty name', async () => {
      jest.spyOn(service, 'sendSlackWebhook').mockResolvedValue();
      const payload = createQuizPayload({
        name: '',
        contact: { email: 'test@test.com', firstName: 'Test' },
      });

      const result = await service.parsePayloadQuiz(payload, mockHeaders);

      expect(result.contact.firstName).toBe('');
      expect(result.contact.lastName).toBe('');
    });
  });

  describe('cleanUpQuestions', () => {
    it('should clean valid questions array', () => {
      const payload = createQuizPayload({
        questions: [
          { question: 'Q1', answer: 'A1' },
          { question: 'Q2', answer: 'A2' },
        ],
      });

      const result = service.cleanUpQuestions(payload);

      expect(result.questions).toEqual([
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' },
      ]);
    });

    it('should filter out null questions', () => {
      const payload = createQuizPayload({
        questions: [{ question: 'Q1', answer: 'A1' }, null as any, { question: 'Q2', answer: 'A2' }],
      });

      const result = service.cleanUpQuestions(payload);

      expect(result.questions).toHaveLength(2);
    });

    it('should filter out undefined questions', () => {
      const payload = createQuizPayload({
        questions: [{ question: 'Q1', answer: 'A1' }, undefined as any],
      });

      const result = service.cleanUpQuestions(payload);

      expect(result.questions).toHaveLength(1);
    });

    it('should return original payload when questions is not an array', () => {
      const payload = createQuizPayload();
      (payload as any).questions = 'not-an-array';

      const result = service.cleanUpQuestions(payload);

      expect(result).toEqual(payload);
    });

    it('should return original payload when error occurs', () => {
      jest.spyOn(console, 'error').mockImplementation();
      const payload = createQuizPayload();
      // Force an error by making questions a getter that throws
      const brokenPayload = {
        ...payload,
        get questions(): any {
          throw new Error('broken');
        },
      };

      const result = service.cleanUpQuestions(brokenPayload as any);

      expect(result).toBe(brokenPayload);
    });

    it('should warn on invalid question format (missing question property)', () => {
      jest.spyOn(console, 'warn').mockImplementation();
      const payload = createQuizPayload({
        questions: [{ question: 'Q1', answer: 'A1' }, { answer: 'A2' } as any],
      });

      const result = service.cleanUpQuestions(payload);

      expect(console.warn).toHaveBeenCalled();
    });

    it('should warn on invalid question format (missing answer property)', () => {
      jest.spyOn(console, 'warn').mockImplementation();
      const payload = createQuizPayload({
        questions: [{ question: 'Q1' } as any],
      });

      const result = service.cleanUpQuestions(payload);

      expect(console.warn).toHaveBeenCalled();
    });

    it('should warn on non-object question', () => {
      jest.spyOn(console, 'warn').mockImplementation();
      const payload = createQuizPayload({
        questions: [{ question: 'Q1', answer: 'A1' }, 'string-question' as any],
      });

      const result = service.cleanUpQuestions(payload);

      expect(console.warn).toHaveBeenCalled();
    });

    it('should strip extra properties from questions', () => {
      const payload = createQuizPayload({
        questions: [{ question: 'Q1', answer: 'A1', quiz_name: 'quiz', step_id: 1 }],
      });

      const result = service.cleanUpQuestions(payload);

      expect(result.questions[0]).toEqual({ question: 'Q1', answer: 'A1' });
    });
  });

  describe('sendSlackWebhook', () => {
    it('should not send in non-production environment', async () => {
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.sendSlackWebhook('test message');

      expect(consoleSpy).toHaveBeenCalledWith('Slack webhook not sent in non-production environment');
    });

    it('should send webhook in production environment', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      await service.sendSlackWebhook('test message');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should include text in slack payload blocks', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      await service.sendSlackWebhook('alert message');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toBe('alert message');
      expect(body.blocks[0].type).toBe('context');
      expect(body.blocks[0].elements[0].text).toBe('alert message');
    });

    it('should not call fetch in test environment', async () => {
      process.env.NODE_ENV = 'test';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.sendSlackWebhook('test');

      expect(consoleSpy).toHaveBeenCalledWith('Slack webhook not sent in non-production environment');
    });
  });
});
