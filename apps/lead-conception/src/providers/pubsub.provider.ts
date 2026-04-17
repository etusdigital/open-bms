import { Injectable } from '@nestjs/common';
import { PubSub, Topic } from '@google-cloud/pubsub';
import { LeadMessage } from '../interfaces';
import * as crypto from 'crypto';

@Injectable()
export class PubSubProvider {
  clientTopic: Topic;
  eventProcessTopic: Topic;
  emcCampaignTriggerTopic: Topic;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.clientTopic = new PubSub(options).topic(process.env.TOPIC_NAME_TAG_PROCESS);
    this.eventProcessTopic = new PubSub(options).topic(process.env.TOPIC_NAME_EVENT_PROCESS);
    this.emcCampaignTriggerTopic = new PubSub(options).topic(process.env.TOPIC_NAME_EMC_CAMPAIGN_TRIGGER);
  }

  async sendAsyncMessage(message: LeadMessage, customAttributes = {}): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    customAttributes['Content-Type'] = 'application/json';

    const messageId = await this.clientTopic.publishMessage({ json: message, attributes: customAttributes });

    return messageId;
  }

  async sendEventProcessMessage(message: any, customAttributes = {}): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return crypto.randomBytes(20).toString('hex');
    }

    customAttributes['Content-Type'] = 'application/json';

    const messageId = await this.eventProcessTopic.publishMessage({ json: message, attributes: customAttributes });

    return messageId;
  }

  async sendEmcCampaignTriggerMessage(message: any, customAttributes = {}): Promise<string> {
    if (process.env.NODE_ENV !== 'production') {
      return crypto.randomBytes(20).toString('hex');
    }

    customAttributes['Content-Type'] = 'application/json';

    const messageId = await this.emcCampaignTriggerTopic.publishMessage({ json: message, attributes: customAttributes });

    return messageId;
  }
}
