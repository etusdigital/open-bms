import { Injectable } from '@nestjs/common';
import { EmailPriority, SendEmailMessage } from '../interfaces';

@Injectable()
export class EmailPullSenderFeature {
  getFeature() {
    return process.env.FEATURE_EMAIL_PULL_SENDER || '';
  }

  getTopicFeature() {
    return process.env.TOPIC_FEATURE_EMAIL_PULL_SENDER || '';
  }

  isActive(): boolean {
    return this.getFeature() ? true : false;
  }

  checkProcess(flowname: string): boolean {
    const feature = this.getFeature();

    if (!feature) return false;

    if (feature === 'ALL') return true;

    return flowname.toLowerCase().includes(feature.toLowerCase());
  }

  sendEmailMessageConfig(sendEmailMessage: SendEmailMessage) {
    const message = {
      topic: this.getTopicFeature(),
      message: sendEmailMessage,
      attrs: {
        priority: sendEmailMessage.message.priority || EmailPriority.NORMAL,
        type: 'pull-sender',
      },
    };

    return message;
  }
}
