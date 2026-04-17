import { Injectable } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import * as crypto from 'crypto';
import { LeadMessage, ServiceAccountCredentials } from '../app.interfaces';

@Injectable()
export class PubSubProvider {
  private clientTopic: Topic;

  constructor() {
    if (!process.env.TOPIC_NAME_LEAD_CONCEPTION) {
      throw new Error('TOPIC_NAME_LEAD_CONCEPTION is not defined');
    }

    let credentials: ServiceAccountCredentials | undefined;

    if (process.env.SERVICE_ACCOUNT) {
      try {
        credentials = JSON.parse(process.env.SERVICE_ACCOUNT) as ServiceAccountCredentials;
      } catch (error) {
        console.error('Error parsing SERVICE_ACCOUNT:', error);
        throw new Error('Invalid SERVICE_ACCOUNT format', { cause: error });
      }
    }

    this.clientTopic = new PubSub(credentials ? { credentials } : {}).topic(process.env.TOPIC_NAME_LEAD_CONCEPTION);
  }

  async sendMessage(payload: LeadMessage, attributes: Record<string, string> = {}) {
    if (process.env.NODE_ENV !== 'production') {
      const messageId = crypto.randomBytes(20).toString('hex');

      return {
        messageId,
        message: `Message ${messageId} published.`,
        status: true,
      };
    }

    try {
      attributes['Content-Type'] = 'application/json';

      const messageId = await this.clientTopic.publishMessage({ json: payload, attributes });

      return {
        messageId,
        message: `Message ${messageId} published.`,
        status: true,
      };
    } catch (error) {
      throw new Error(`Error to send message to ${process.env.TOPIC_NAME_LEAD_CONCEPTION}. ${error}`, { cause: error });
    }
  }
}
