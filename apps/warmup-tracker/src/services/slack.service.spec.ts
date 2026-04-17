import { SlackService } from './slack.service';

jest.mock('@slack/web-api', () => {
  const mockPostMessage = jest.fn();
  return {
    WebClient: jest.fn().mockImplementation(() => ({
      chat: {
        postMessage: mockPostMessage,
      },
    })),
    __mockPostMessage: mockPostMessage,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockPostMessage } = require('@slack/web-api');

describe('SlackService', () => {
  let slackService: SlackService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SLACK_TOKEN = 'xoxb-test-token';
    slackService = new SlackService();
  });

  it('should be defined', () => {
    expect(slackService).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should call chat.postMessage with the correct parameters', async () => {
      __mockPostMessage.mockResolvedValue({ ok: true });

      await slackService.sendMessage({
        userId: 'U12345',
        text: 'Hello',
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: 'Hello' },
          },
        ],
      });

      expect(__mockPostMessage).toHaveBeenCalledWith({
        unfurl_links: false,
        unfurl_media: false,
        channel: 'U12345',
        text: 'Hello',
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: 'Hello' },
          },
        ],
      });
    });

    it('should pass undefined text when not provided', async () => {
      __mockPostMessage.mockResolvedValue({ ok: true });

      await slackService.sendMessage({
        userId: 'U12345',
      });

      expect(__mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'U12345',
          text: undefined,
          blocks: undefined,
        })
      );
    });

    it('should return the Slack API response', async () => {
      const mockResponse = { ok: true, ts: '1234567890.123456' };
      __mockPostMessage.mockResolvedValue(mockResponse);

      const result = await slackService.sendMessage({
        userId: 'U12345',
        text: 'test',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should propagate errors from chat.postMessage', async () => {
      __mockPostMessage.mockRejectedValue(new Error('network error'));

      await expect(slackService.sendMessage({ userId: 'U12345', text: 'test' })).rejects.toThrow('network error');
    });

    it('should set unfurl_links and unfurl_media to false', async () => {
      __mockPostMessage.mockResolvedValue({ ok: true });

      await slackService.sendMessage({ userId: 'U12345' });

      expect(__mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          unfurl_links: false,
          unfurl_media: false,
        })
      );
    });
  });
});
