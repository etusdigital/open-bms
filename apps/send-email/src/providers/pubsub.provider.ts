import { Injectable } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import * as crypto from 'crypto';

@Injectable()
export class PubSubProvider {
  clientTopic: Topic;
  clientTopic2: Topic;

  constructor(topicName: string) {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.clientTopic = new PubSub(options).topic(topicName);
    this.clientTopic2 = new PubSub(options).topic('msgops-email-errors');
  }

  async sendAsyncMessage(message: any, customAttributes = {}): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    customAttributes['Content-Type'] = 'application/json';

    return this.clientTopic.publishMessage({ json: message, attributes: customAttributes });
  }

  async sendAsyncMessage2(message: any, customAttributes = {}): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    customAttributes['Content-Type'] = 'application/json';

    return this.clientTopic2.publishMessage({ json: message, attributes: customAttributes });
  }
}
