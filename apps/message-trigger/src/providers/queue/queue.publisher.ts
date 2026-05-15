import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AmqpPublisher, EXCHANGES, type ExchangeName } from '@bms/messaging';
import { StepType } from '../../interfaces';

export const QUEUE_MESSAGE_TRIGGER = 'message-trigger';
export const QUEUE_TIMER = 'queueTimer';
export const QUEUE_CONDITION = 'queueCondition';
export const QUEUE_SEND_EMAIL = 'send-email';
export const QUEUE_SEND_PUSH = 'send-push';
export const QUEUE_SEND_TWILIO = 'send-twilio';
export const QUEUE_SEND_WHATSAPP = 'send-whatsapp';
export const QUEUE_HTTP_REQUEST = 'http-request';
export const QUEUE_TAG_PROCESS = 'tag-process';
export const QUEUE_EVENT_PROCESS = 'event-process';

interface AmqpRoute {
  exchange: ExchangeName;
  routingKey: string;
}

// Topic name → AMQP route. Workers downstream (send-email, event-process,
// notifications) consume AMQP — we publish there. BullMQ stays for internal
// flows (queueTimer/queueCondition/message-trigger) where delay is used.
const AMQP_ROUTES: Record<string, AmqpRoute> = {
  [QUEUE_SEND_EMAIL]: { exchange: EXCHANGES.email, routingKey: 'email.send' },
  [QUEUE_SEND_PUSH]: { exchange: EXCHANGES.push, routingKey: 'push.send' },
  [QUEUE_SEND_TWILIO]: { exchange: EXCHANGES.sms, routingKey: 'sms.send' },
  [QUEUE_SEND_WHATSAPP]: { exchange: EXCHANGES.whatsapp, routingKey: 'whatsapp.send' },
  [QUEUE_EVENT_PROCESS]: { exchange: EXCHANGES.events, routingKey: 'event.received.internal' },
};

@Injectable()
export class QueuePublisher implements OnModuleInit {
  private readonly logger = new Logger(QueuePublisher.name);
  private readonly queueMap: Map<string, Queue>;
  private readonly amqpRoutes: Map<string, AmqpRoute>;
  private readonly amqpPublisher: AmqpPublisher | null;

  constructor(
    @InjectQueue(QUEUE_MESSAGE_TRIGGER) private readonly messageTriggerQueue: Queue,
    @InjectQueue(QUEUE_TIMER) private readonly timerQueue: Queue,
    @InjectQueue(QUEUE_CONDITION) private readonly conditionQueue: Queue,
    @InjectQueue(QUEUE_SEND_EMAIL) private readonly sendEmailQueue: Queue,
    @InjectQueue(QUEUE_SEND_PUSH) private readonly sendPushQueue: Queue,
    @InjectQueue(QUEUE_SEND_TWILIO) private readonly sendTwilioQueue: Queue,
    @InjectQueue(QUEUE_SEND_WHATSAPP) private readonly sendWhatsappQueue: Queue,
    @InjectQueue(QUEUE_HTTP_REQUEST) private readonly httpRequestQueue: Queue,
    @InjectQueue(QUEUE_TAG_PROCESS) private readonly tagProcessQueue: Queue,
    @InjectQueue(QUEUE_EVENT_PROCESS) private readonly eventProcessQueue: Queue,
  ) {
    this.queueMap = new Map([
      [process.env.TOPIC_NAME_MESSAGE_TRIGGER || QUEUE_MESSAGE_TRIGGER, messageTriggerQueue],
      [process.env.TOPIC_NAME_SEND_EMAIL || QUEUE_SEND_EMAIL, sendEmailQueue],
      [process.env.TOPIC_NAME_SEND_PUSH || QUEUE_SEND_PUSH, sendPushQueue],
      [process.env.TOPIC_NAME_SEND_TWILIO || QUEUE_SEND_TWILIO, sendTwilioQueue],
      [process.env.TOPIC_NAME_SEND_WHATSAPP || QUEUE_SEND_WHATSAPP, sendWhatsappQueue],
      [process.env.TOPIC_NAME_HTTP_REQUEST || QUEUE_HTTP_REQUEST, httpRequestQueue],
      [process.env.TOPIC_NAME_TAG_PROCESS || QUEUE_TAG_PROCESS, tagProcessQueue],
      [process.env.TOPIC_NAME_EVENT_PROCESS || QUEUE_EVENT_PROCESS, eventProcessQueue],
    ]);

    this.amqpRoutes = new Map([
      [process.env.TOPIC_NAME_SEND_EMAIL || QUEUE_SEND_EMAIL, AMQP_ROUTES[QUEUE_SEND_EMAIL]],
      [process.env.TOPIC_NAME_SEND_PUSH || QUEUE_SEND_PUSH, AMQP_ROUTES[QUEUE_SEND_PUSH]],
      [process.env.TOPIC_NAME_SEND_TWILIO || QUEUE_SEND_TWILIO, AMQP_ROUTES[QUEUE_SEND_TWILIO]],
      [process.env.TOPIC_NAME_SEND_WHATSAPP || QUEUE_SEND_WHATSAPP, AMQP_ROUTES[QUEUE_SEND_WHATSAPP]],
      [process.env.TOPIC_NAME_EVENT_PROCESS || QUEUE_EVENT_PROCESS, AMQP_ROUTES[QUEUE_EVENT_PROCESS]],
    ]);

    this.amqpPublisher = process.env.AMQP_URL ? new AmqpPublisher({ url: process.env.AMQP_URL }) : null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.amqpPublisher) {
      this.logger.warn('AMQP_URL not set — downstream workers (send-email/push/twilio/whatsapp/event-process) will not receive messages');
    }
  }

  async sendAsyncMessage(topicOrQueue: string, message: any, _compressPayload?: any, attrs?: Record<string, any>): Promise<string> {
    const route = this.amqpRoutes.get(topicOrQueue);
    if (route) {
      if (!this.amqpPublisher) {
        throw new Error(`AMQP_URL is required to publish to ${topicOrQueue} (route ${route.exchange}/${route.routingKey})`);
      }
      const headers: Record<string, string | number> = {};
      if (attrs && typeof attrs === 'object') {
        for (const [k, v] of Object.entries(attrs)) {
          if (typeof v === 'string' || typeof v === 'number') headers[k] = v;
          else if (typeof v === 'boolean') headers[k] = v ? 'true' : 'false';
        }
      }
      await this.amqpPublisher.publish({ exchange: route.exchange, routingKey: route.routingKey, payload: message, headers });
      return `amqp:${route.exchange}/${route.routingKey}`;
    }

    const queue = this.queueMap.get(topicOrQueue);
    if (!queue) {
      throw new Error(`No queue mapped for topic/queue: ${topicOrQueue}`);
    }
    const job = await queue.add('process', message, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });
    return String(job.id);
  }

  async sendInternalEvent(payload: any, attrs?: Record<string, string>): Promise<void> {
    if (this.amqpPublisher) {
      const headers: Record<string, string | number> = {};
      if (attrs && typeof attrs === 'object') {
        for (const [k, v] of Object.entries(attrs)) {
          if (typeof v === 'string' || typeof v === 'number') headers[k] = v;
        }
      }
      await this.amqpPublisher.publish({
        exchange: EXCHANGES.events,
        routingKey: 'event.received.internal',
        payload: { payload: [payload], platform: 'internal' },
        headers,
      });
      return;
    }
    // AMQP not configured — fall back to BullMQ Redis (legacy/dev only).
    await this.eventProcessQueue.add('track', { payload: [payload], platform: 'internal' }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true });
  }

  async scheduleDelayedStep(message: any, waitForMinutes: number, stepType: StepType): Promise<Job> {
    const delayMs = Math.max(0, waitForMinutes * 60 * 1000);
    const queue = stepType === StepType.CONDITIONAL_TIME ? this.conditionQueue : this.timerQueue;
    return queue.add('process', message, {
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
  }

  async closeAmqp(): Promise<void> {
    if (this.amqpPublisher) {
      await this.amqpPublisher.close();
    }
  }
}
