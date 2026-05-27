import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
@Injectable()
export class TwilioHandler {
  private uri: string;

  constructor(private readonly httpService: HttpService) {
    this.uri = `https://content.twilio.com/v1/Content`;
  }
  public async createMessage(message: any, twilioSidAccount: string, twillioAuth: string) {
    try {
      const response = await this.httpService
        .post(`${this.uri}`, message, {
          headers: {
            Authorization: 'Basic ' + btoa(`${twilioSidAccount}:${twillioAuth}`),
          },
        })
        .toPromise();
      return response.data;
    } catch (e) {
      console.error(e);
      throw new HttpException(`Create error message!`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async sendToApprovalMessage(messageId, name, twilioSidAccount: string, twillioAuth: string) {
    try {
      const response = await this.httpService
        .post(
          `${this.uri}/${messageId}/ApprovalRequests/whatsapp`,
          {
            name,
            category: 'Utility',
          },
          {
            headers: {
              Authorization: 'Basic ' + btoa(`${twilioSidAccount}:${twillioAuth}`),
            },
          },
        )
        .toPromise();

      return response.data;
    } catch (e) {
      console.error(e);
      throw new HttpException(`Error to send approval!`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  public async getMessageStatus(messageId, twilioSidAccount: string, twillioAuth: string) {
    try {
      const response = await this.httpService
        .get(`${this.uri}/${messageId}/ApprovalRequests`, {
          headers: {
            Authorization: 'Basic ' + btoa(`${twilioSidAccount}:${twillioAuth}`),
          },
        })
        .toPromise();

      return response.data;
    } catch (e) {
      console.error(e);
      throw new HttpException(`Error to send approval!`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
