import { Injectable } from '@nestjs/common';
import { Logging } from '@google-cloud/logging';

@Injectable()
export class LoggingProvider {
  async createLogging(emailsJson: string) {
    const projectId = process.env.GCP_PROJECT;
    const logging = new Logging({ projectId });
    const log = logging.log('Tag-Process');
    const text = `[Tag-Process-Batch] - Contacts not found: ${emailsJson}`;
    const metadata = {
      resource: { type: 'global' },
      severity: 'WARNING',
    };
    const entry = log.entry(metadata, text);
    await log.write(entry);
  }
}
