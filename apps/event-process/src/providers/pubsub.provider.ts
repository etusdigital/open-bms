import { Injectable } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import crypto from 'crypto';

@Injectable()
export class PubSubProvider {
  private clientTopic: Topic;
  private eventProccessTopic: Topic;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.clientTopic = new PubSub(options).topic(process.env.TOPIC_NAME_TAG_PROCESS);
    this.eventProccessTopic = new PubSub(options).topic(process.env.TOPIC_NAME_EVENT_PROCESS);
  }

  async sendAsyncMessage(message: any, customAttributes = {}): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    customAttributes['Content-Type'] = 'application/json';

    return await this.clientTopic.publishMessage({ json: message, attributes: customAttributes });
  }

  async sendAsyncMessageBms(message: any, customAttributes = {}): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    customAttributes['Content-Type'] = 'application/json';

    return await this.eventProccessTopic.publishMessage({ json: message, attributes: customAttributes });
  }
}
