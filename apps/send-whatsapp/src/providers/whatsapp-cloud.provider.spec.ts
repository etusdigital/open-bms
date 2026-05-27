import axios from 'axios';
import { WhatsappCloudProvider } from './whatsapp-cloud.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function buildHttpMock() {
  const post = jest.fn();
  (mockedAxios.create as jest.Mock).mockReturnValue({ post } as any);
  return { post };
}

describe('WhatsappCloudProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('constructor', () => {
    it('throws when required config is missing', () => {
      expect(() => new WhatsappCloudProvider({ baseUrl: '', bearerToken: 't', phoneNumberId: '1' })).toThrow(/baseUrl/);
      expect(() => new WhatsappCloudProvider({ baseUrl: 'b', bearerToken: '', phoneNumberId: '1' })).toThrow(/bearerToken/);
      expect(() => new WhatsappCloudProvider({ baseUrl: 'b', bearerToken: 't', phoneNumberId: '' })).toThrow(/phoneNumberId/);
    });

    it('strips trailing slash from baseUrl and sets Bearer header', () => {
      buildHttpMock();
      new WhatsappCloudProvider({ baseUrl: 'https://graph.facebook.com/v18.0/', bearerToken: 'tok', phoneNumberId: '111' });
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://graph.facebook.com/v18.0',
          headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        }),
      );
    });
  });

  describe('sendTemplate', () => {
    it('posts the WhatsApp Cloud template payload to /{phoneNumberId}/messages', async () => {
      const { post } = buildHttpMock();
      post.mockResolvedValueOnce({ data: { messaging_product: 'whatsapp', messages: [{ id: 'wamid.X' }] } });

      const p = new WhatsappCloudProvider({ baseUrl: 'https://graph.facebook.com/v18.0', bearerToken: 'tok', phoneNumberId: '111' });
      const r = await p.sendTemplate({ to: '+55 11 99999-0000', templateName: 'order_update', languageCode: 'pt_BR' });

      expect(post).toHaveBeenCalledWith('/111/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '55 11 99999-0000',
        type: 'template',
        template: { name: 'order_update', language: { code: 'pt_BR' } },
      });
      expect(r.messages[0].id).toBe('wamid.X');
    });

    it('passes components when provided', async () => {
      const { post } = buildHttpMock();
      post.mockResolvedValueOnce({ data: { messaging_product: 'whatsapp', messages: [{ id: 'wamid.Y' }] } });
      const p = new WhatsappCloudProvider({ baseUrl: 'https://graph.facebook.com/v18.0', bearerToken: 'tok', phoneNumberId: '111' });
      await p.sendTemplate({ to: '5511', templateName: 't', languageCode: 'pt_BR', components: [{ type: 'body', parameters: [{ type: 'text', text: 'foo' }] }] });
      const body = post.mock.calls[0][1];
      expect(body.template.components).toHaveLength(1);
    });

    it('strips "whatsapp:" prefix and leading "+" from the recipient', async () => {
      const { post } = buildHttpMock();
      post.mockResolvedValueOnce({ data: { messaging_product: 'whatsapp', messages: [{ id: 'x' }] } });
      const p = new WhatsappCloudProvider({ baseUrl: 'b', bearerToken: 't', phoneNumberId: '1' });
      await p.sendTemplate({ to: 'whatsapp:+5511999990000', templateName: 't', languageCode: 'pt_BR' });
      const body = post.mock.calls[0][1];
      expect(body.to).toBe('5511999990000');
    });
  });

  describe('sendText', () => {
    it('posts a text payload with preview_url default false', async () => {
      const { post } = buildHttpMock();
      post.mockResolvedValueOnce({ data: { messaging_product: 'whatsapp', messages: [{ id: 'wamid.T' }] } });
      const p = new WhatsappCloudProvider({ baseUrl: 'b', bearerToken: 't', phoneNumberId: '1' });
      await p.sendText({ to: '5511', text: 'oi' });
      expect(post).toHaveBeenCalledWith('/1/messages', expect.objectContaining({ type: 'text', text: { body: 'oi', preview_url: false } }));
    });
  });

  describe('retry on 5xx', () => {
    it('retries 5xx 3 times then throws', async () => {
      const { post } = buildHttpMock();
      const error = { isAxiosError: true, response: { status: 503, data: { error: { message: 'Service Unavailable' } } }, config: { url: '/1/messages' } } as any;
      post.mockRejectedValue(error);

      const p = new WhatsappCloudProvider({ baseUrl: 'b', bearerToken: 't', phoneNumberId: '1' });

      // Replace timer to keep the test fast.
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

      await expect(p.sendText({ to: '5511', text: 'oi' })).rejects.toBe(error);
      expect(post).toHaveBeenCalledTimes(3);
    });

    it('does not retry on 4xx', async () => {
      const { post } = buildHttpMock();
      const error = { isAxiosError: true, response: { status: 400, data: { error: { message: 'Invalid Number' } } }, config: { url: '/1/messages' } } as any;
      post.mockRejectedValue(error);

      const p = new WhatsappCloudProvider({ baseUrl: 'b', bearerToken: 't', phoneNumberId: '1' });
      await expect(p.sendText({ to: '5511', text: 'oi' })).rejects.toBe(error);
      expect(post).toHaveBeenCalledTimes(1);
    });

    it('returns on 5xx that eventually succeeds', async () => {
      const { post } = buildHttpMock();
      const error = { isAxiosError: true, response: { status: 503, data: {} }, config: { url: '/1/messages' } } as any;
      post.mockRejectedValueOnce(error).mockResolvedValueOnce({ data: { messaging_product: 'whatsapp', messages: [{ id: 'ok' }] } });

      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

      const p = new WhatsappCloudProvider({ baseUrl: 'b', bearerToken: 't', phoneNumberId: '1' });
      const result = await p.sendText({ to: '5511', text: 'oi' });
      expect(result.messages[0].id).toBe('ok');
      expect(post).toHaveBeenCalledTimes(2);
    });
  });
});
