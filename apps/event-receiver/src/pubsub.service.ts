import { Injectable } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import * as crypto from 'crypto';

@Injectable()
export class PubSubService {
  private clientTopic: Topic;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    if (!process.env.TOPIC_NAME_EVENT_PROCESS) {
      throw new Error('TOPIC_NAME_EVENT_PROCESS environment variable is required in production');
    }

    this.clientTopic = new PubSub(options).topic(process.env.TOPIC_NAME_EVENT_PROCESS);
  }

  async sendAsyncMessage(message: any, customAttributes = {}): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Sending message to ${process.env.TOPIC_NAME_EVENT_PROCESS} topic`, JSON.stringify(message));
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    customAttributes['Content-Type'] = 'application/json';

    return await this.clientTopic.publishMessage({ json: message, attributes: customAttributes });
  }
}
