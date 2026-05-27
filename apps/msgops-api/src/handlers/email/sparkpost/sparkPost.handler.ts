import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class SparkPostHandler {
  private SparkPost = require('sparkpost');
  private client = new this.SparkPost(process.env.SPARKPOST_API_KEY);

  async createMail(sendEmailMessage: any, createdTest: any) {
    const { SeedList, InsertInBody } = createdTest;
    const formatedMessage = sendEmailMessage.content.concat(InsertInBody);

    const sendList = [];
    SeedList.map((item) => {
      sendList.push({
        address: {
          email: item,
        },
      });
    });

    return {
      options: {
        open_tracking: true,
        click_tracking: true,
      },
      content: {
        from: {
          name: sendEmailMessage.fromName,
          email: sendEmailMessage.fromMail,
        },
        subject: sendEmailMessage.subject,
        html: formatedMessage,
      },
      recipients: sendList,
    };
  }

  async sendEmail(sendEmail, createdTest) {
    try {
      const mail = await this.createMail(sendEmail, createdTest);
      return await this.client.transmissions.send(mail);
    } catch (e) {
      console.error(`Email not sent error: ${JSON.stringify(e)}`);
      throw new HttpException('Cannot send this email!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
