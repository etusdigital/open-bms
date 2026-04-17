import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SlackProvider {
  private readonly logger = new Logger(SlackProvider.name);

  /**
   * Sends a message to Slack via webhook
   * @param text The message text to send
   * @throws Error if webhook fails in production
   */
  public async sendSlackWebhook(text: string, webhookUrl: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log('Slack webhook not sent in non-production environment');
      return;
    }

    const payload = {
      text,
      blocks: [
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text,
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed with status: ${response.status}`);
      }

      this.logger.log('Slack webhook sent successfully');
    } catch (error) {
      this.logger.error('Failed to send Slack webhook', error);
      throw error;
    }
  }
}
