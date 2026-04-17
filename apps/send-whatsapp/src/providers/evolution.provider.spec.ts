import { EvolutionProvider } from './evolution.provider';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EvolutionProvider', () => {
  let provider: EvolutionProvider;

  beforeEach(() => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    process.env.EVOLUTION_API_URL = 'https://evo-api.test.com';
    process.env.WHATSAPP_CALLBACK_EVOLUTION = 'https://callback.test.com/webhook';

    provider = new EvolutionProvider('instance-1', 'api-key-1');

    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
  });

  describe('sendWhatsappTemplate', () => {
    it('should return undefined in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const testProvider = new EvolutionProvider('inst', 'key');
      const result = await testProvider.sendWhatsappTemplate('tmpl', 'pt_BR', '+5511999999999', 'utms=test', null);
      expect(result).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should send template without components when no shortCode or codeMessage', async () => {
      process.env.NODE_ENV = 'development';
      mockedAxios.post.mockResolvedValue({ data: { id: 'msg-1' } });

      const result = await provider.sendWhatsappTemplate('template-name', 'pt_BR', '+5511999999999', 'utms=test', null);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://evo-api.test.com/message/sendTemplate/instance-1',
        expect.objectContaining({
          number: '5511999999999',
          name: 'template-name',
          language: 'pt_BR',
          webhookUrl: 'https://callback.test.com/webhook?utms=test',
          components: undefined,
        }),
        expect.objectContaining({
          headers: { apikey: 'api-key-1' },
        }),
      );
      expect(result).toEqual({ id: 'msg-1' });
    });

    it('should include button component when shortCode is provided', async () => {
      process.env.NODE_ENV = 'development';
      mockedAxios.post.mockResolvedValue({ data: { id: 'msg-2' } });

      await provider.sendWhatsappTemplate('template-name', 'pt_BR', '+5511999999999', 'utms=test', 'shortcode123');

      const callArgs = mockedAxios.post.mock.calls[0][1] as any;
      expect(callArgs.components).toEqual([
        {
          type: 'button',
          sub_type: 'URL',
          index: '0',
          parameters: [{ type: 'text', text: 'shortcode123' }],
        },
      ]);
    });

    it('should include body and button components when codeMessage is provided', async () => {
      process.env.NODE_ENV = 'development';
      mockedAxios.post.mockResolvedValue({ data: { id: 'msg-3' } });

      await provider.sendWhatsappTemplate('template-name', 'pt_BR', '+5511999999999', 'utms=test', null, 'CODE123');

      const callArgs = mockedAxios.post.mock.calls[0][1] as any;
      expect(callArgs.components).toHaveLength(2);
      expect(callArgs.components[0].type).toBe('body');
      expect(callArgs.components[0].parameters[0].text).toBe('CODE123');
      expect(callArgs.components[1].type).toBe('button');
    });

    it('should strip whatsapp: prefix and + from phone number', async () => {
      process.env.NODE_ENV = 'development';
      mockedAxios.post.mockResolvedValue({ data: { id: 'msg-4' } });

      await provider.sendWhatsappTemplate('tmpl', 'en', 'whatsapp:+5511999999999', 'utms=test', null);

      const callArgs = mockedAxios.post.mock.calls[0][1] as any;
      expect(callArgs.number).toBe('5511999999999');
    });

    it('should return error object when axios throws', async () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Network error');
      mockedAxios.post.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await provider.sendWhatsappTemplate('tmpl', 'en', '+5511999999999', 'utms=test', null);

      expect(consoleSpy).toHaveBeenCalledWith(error);
      expect(result).toBe(error);
      consoleSpy.mockRestore();
    });
  });
});
