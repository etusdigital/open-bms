export class ContactDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  grupo?: string;
  beneficio?: string;
  renda?: string;
  audienceName?: string;
  audienceUrl?: string;
  hashedEmail?: string;
  leadTdSscId?: string;
  leadTdClientId?: string;
  campaignIdAquisicao?: string;
  utmCampaignAquisicao?: string;
  recommendationName?: string;
  recommendationUrl?: string;
  quizId?: string;
  leadTdGlobalId?: string;
  utmContent?: string;
}

export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}
export interface Email {
  id?: number;
  title: string;
  ippool: string;
  subject: string;
  replyTo: string;
  priority: EmailPriority;
  content: string;
  from: {
    firstName: string;
    email: string;
  };
}

export interface EmailFormProps {
  subject: any;
  ippool: any;
  priority: any;
  fromMail: any;
  replyTo: any;
  fromName: any;
  previewText: any;
}

export interface SendEmailMessage {
  contact: ContactDto;
  message: Email;
}

export class SendEmailMessageDto {
  contact: ContactDto;
  message: Email;

  constructor(sendEmailMessageDto: SendEmailMessageDto = {} as SendEmailMessageDto) {
    this.contact = sendEmailMessageDto.contact;
    this.message = sendEmailMessageDto.message;
  }
}
