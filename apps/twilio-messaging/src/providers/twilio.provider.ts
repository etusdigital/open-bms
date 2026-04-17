import { Injectable } from '@nestjs/common';
import { env } from 'process';
import { Twilio } from 'twilio';
@Injectable()
export class TwilioProvider {
  private clientTwilio: Twilio;
  constructor(secret: string, sid: string, accountSid: string) {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.clientTwilio = new Twilio(sid, secret, { accountSid });
  }
  async sendSingleSms(body: string, to: string, utms: string, messageService: string) {
    try {
      if (process.env.NODE_ENV === 'test') {
        return;
      }

      return await this.clientTwilio.messages.create({
        body,
        to,
        messagingServiceSid: messageService,
        statusCallback: `${env.SMS_CALLBACK_TWILIO}?${utms}`,
      });
    } catch (error) {
      console.error(error);
      return error;
    }
  }

  async sendSingleWhatsapp(messageId: string, to: string, utms: string, messageService: string, shortCode: string) {
    try {
      if (process.env.NODE_ENV === 'test') {
        return;
      }

      return await this.clientTwilio.messages.create({
        contentSid: messageId,
        to,
        messagingServiceSid: messageService,
        statusCallback: `${env.WHATSAPP_CALLBACK_TWILIO}?${utms}`,
        ...(shortCode
          ? {
              contentVariables: JSON.stringify({
                shortCode,
              }),
            }
          : undefined),
      });
    } catch (error) {
      console.error(error);
      return error;
    }
  }
}
