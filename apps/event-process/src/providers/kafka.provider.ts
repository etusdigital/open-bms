import { Injectable } from '@nestjs/common';
import { Kafka, Producer, logLevel } from 'kafkajs';
import crypto from 'crypto';
import { SASLOptions } from 'kafkajs';

@Injectable()
export class KafkaProvider {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    const sasl: SASLOptions = {
      mechanism: 'scram-sha-512',
      username: process.env.KAFKA_USERNAME,
      password: process.env.KAFKA_PASSWORD,
    };

    this.kafka = new Kafka({
      clientId: 'my-app',
      brokers: [process.env.KAFKA_BROKERS],
      ssl: false,
      sasl,
      logLevel: logLevel.ERROR,
    });

    this.producer = this.kafka.producer();
    this.producer.connect();
  }

  async sendAsyncMessage(message: any, topic) {
    if (process.env.NODE_ENV !== 'production') {
      return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
    }

    const result = await this.producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
        },
      ],
    });

    return result;
  }
}
