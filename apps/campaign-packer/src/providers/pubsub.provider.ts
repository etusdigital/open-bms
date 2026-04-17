import { Injectable } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import * as crypto from 'crypto';

@Injectable()
export class PubSubProvider {
  private client: PubSub;
  private pageTopic: Topic;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.client = new PubSub(options);
    this.pageTopic = new PubSub(options).topic(`${process.env.TOPIC_MSGOPS_CAMPAIGN_SCHEDULE_PAGE}`);
  }

  async publishMessage<T>(topicName: string, json: T, attributes?: { [K: string]: string }): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    attributes = {
      ...attributes,
      'Content-Type': 'application/json',
    };

    const publishOptions = {
      gaxOpts: {
        timeout: 100000,
      },
    };

    return this.client.topic(topicName, publishOptions).publishMessage({ json, attributes });
  }

  async publishMessagePagesOnTopic<T>(json: T, attributes?: { [K: string]: string }): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    attributes = {
      ...attributes,
      'Content-Type': 'application/json',
    };

    return this.pageTopic.publishMessage({ json, attributes });
  }
}
