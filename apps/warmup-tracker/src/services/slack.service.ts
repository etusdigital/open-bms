import { Injectable } from '@nestjs/common';
import { KnownBlock, WebClient } from '@slack/web-api';

@Injectable()
export class SlackService {
  private web: WebClient;

  constructor() {
    this.web = new WebClient(process.env.SLACK_TOKEN);
  }

  async sendMessage(params: { userId: string; text?: string; blocks?: KnownBlock[] }) {
    return this.web.chat.postMessage({
      unfurl_links: false,
      unfurl_media: false,
      channel: params.userId,
      text: params.text,
      blocks: params.blocks,
    });
  }
}
