import { Injectable } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';
import * as crypto from 'crypto';

@Injectable()
export class PubSubProvider {
  client: PubSub;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.client = new PubSub(options);
  }

  sendAsyncMessage(topic: string, message: any, customAttributes = {}): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    customAttributes = {
      ...customAttributes,
      'Content-Type': 'application/json',
    };

    return this.client.topic(topic).publishMessage({ json: message, attributes: customAttributes });
  }

  sendAsyncMessageData(topic: string, message: any): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    return this.client.topic(topic).publishMessage({ data: message });
  }
}
