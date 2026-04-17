export interface MobilePush {
  id?: number;
  title: string;
  subject: string;
  content: string;
  url: string;
  expiryPushInSeconds: string;
}

export class SendMobilePushMessageDto {
  email: string;
  message: MobilePush;

  constructor(sendEmailMessageDto: SendMobilePushMessageDto = {} as SendMobilePushMessageDto) {
    this.email = sendEmailMessageDto.email;
    this.message = sendEmailMessageDto.message;
  }
}
