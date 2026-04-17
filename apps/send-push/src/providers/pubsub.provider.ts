import { Injectable } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';
import * as crypto from 'crypto';

@Injectable()
export class PubSubProvider {
  private client: PubSub;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.client = new PubSub(options);
  }

  async sendMessage(payload: any, topic: string, attributes: any = {}) {
    if (process.env.NODE_ENV !== 'production') {
      const messageId = crypto.randomBytes(20).toString('hex');

      return {
        messageId,
        message: `Message ${messageId} published.`,
        status: true,
      };
    }

    try {
      attributes['Content-type'] = 'application/json';
      const messageId = await this.client.topic(topic).publishMessage({ json: payload, attributes });

      return {
        messageId,
        message: `Message ${messageId} published.`,
        status: true,
      };
    } catch (error) {
      throw new Error(`Error to send message to ${topic}. ${error}`);
    }
  }
}
