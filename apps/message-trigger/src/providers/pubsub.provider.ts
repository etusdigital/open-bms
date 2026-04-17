import { Injectable } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import * as crypto from 'crypto';
import { RedisService } from './redis/redis.service';
import { ClickHousePayload, CompressedPayload } from 'src/interfaces';

@Injectable()
export class PubSubProvider {
  client: PubSub;
  internlEventTopic: Topic;

  constructor(private readonly redisService: RedisService) {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.client = new PubSub(options);
    this.internlEventTopic = new PubSub(options).topic(process.env.TOPIC_NAME_EVENT_PROCESS);
  }

  async sendAsyncMessage(topic: string, message: any, compressPayload: CompressedPayload, customAttributes = {}): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    customAttributes['Content-Type'] = 'application/json';
    // if (compressPayload) {
    //   const redisClient = this.redisService.getOrThrow();
    //   await redisClient.set(compressPayload.automationKey, JSON.stringify(message), 'EX', 43200);
    //   message = compressPayload;
    // }

    const [messageId] = await this.client.topic(topic).publishMessage({ json: message, attributes: customAttributes });

    return messageId;
  }

  async sendMessageInternalEvent(payload: ClickHousePayload, customAttributes: Record<string, string> = {}) {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }
    try {
      customAttributes['Content-Type'] = 'application/json';

      const messageId = await this.internlEventTopic.publishMessage({ json: { payload: [payload], platform: 'internal' }, attributes: customAttributes });

      return {
        messageId,
        message: `Message ${messageId} published.`,
        status: true,
      };
    } catch (error) {
      console.error(error);
      throw new Error(`Error to send internal message to. ${JSON.stringify(payload)}`);
    }
  }
}
