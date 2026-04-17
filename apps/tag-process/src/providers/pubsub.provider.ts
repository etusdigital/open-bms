import { Injectable } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import * as crypto from 'crypto';
import { ClickHousePayload } from '../interfaces';

@Injectable()
export class PubSubProvider {
  clientTopic: Topic;
  clickHouseTopic: Topic;
  segmentTopic: Topic;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.clientTopic = new PubSub(options).topic(process.env.TOPIC_NAME_MESSAGE_TRIGGER);
    this.clickHouseTopic = new PubSub(options).topic(process.env.TOPIC_NAME_CLICK_HOUSE);
    this.segmentTopic = new PubSub(options).topic(process.env.TOPIC_NAME_SEGMENT_TO_CLICK_HOUSE);
  }

  async sendMessage(payload, customAttributes = {}) {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }
    try {
      customAttributes['Content-Type'] = 'application/json';

      const messageId = await this.clientTopic.publishMessage({ json: payload, attributes: customAttributes });

      return {
        messageId,
        message: `Message ${messageId} published.`,
        status: true,
      };
    } catch (_error) {
      throw new Error(`Error to send message to. ${JSON.stringify(payload)}`);
    }
  }

  async sendMessageClickHouse(payload: ClickHousePayload, customAttributes: Record<string, string> = {}) {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }
    try {
      customAttributes['Content-Type'] = 'application/json';

      const messageId = await this.clickHouseTopic.publishMessage({
        json: { payload: [payload], platform: 'internal' },
        attributes: customAttributes,
      });

      return {
        messageId,
        message: `Message ${messageId} published.`,
        status: true,
      };
    } catch (error) {
      console.error(error);
      throw new Error(`Error to send message to. ${JSON.stringify(payload)}`);
    }
  }

  async sendMessageSegment(payload, customAttributes: Record<string, string> = {}) {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }
    try {
      customAttributes['Content-Type'] = 'application/json';

      const messageId = await this.segmentTopic.publishMessage({ json: payload, attributes: customAttributes });

      return {
        messageId,
        message: `Message ${messageId} published.`,
        status: true,
      };
    } catch (error) {
      console.error(error);
      throw new Error(`Error to send message to. ${JSON.stringify(payload)}`);
    }
  }
}
