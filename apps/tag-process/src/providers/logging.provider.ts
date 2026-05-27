import { Injectable } from '@nestjs/common';
import pino, { Logger } from 'pino';

@Injectable()
export class LoggingProvider {
  private readonly logger: Logger;

  constructor() {
    this.logger = pino({
      name: 'tag-process',
      level: process.env.LOG_LEVEL?.toLowerCase() ?? 'info',
    });
  }

  async createLogging(emailsJson: string): Promise<void> {
    this.logger.warn({ emails: emailsJson }, '[Tag-Process-Batch] contacts not found');
  }
}
