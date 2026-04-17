import { ApiProperty } from '@nestjs/swagger';
import * as Joi from 'joi';
import { AccountDto } from '../accounts/dtos/account.dto';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

export interface ContactDto {
  id?: number;
  email?: string;
  uuid?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  customFields?: any;
}

export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  TRANSACTIONAL = 'transactional',
}

export interface Email {
  id?: number;
  title?: string;
  name?: string;
  ippool?: string;
  previewText?: string;
  subject?: string;
  replyTo?: string;
  priority?: EmailPriority;
  content?: string;
  providerMessageId?: string;
  location?: {
    bucketName: string;
    fileName: string;
  };
  from: {
    firstName: string;
    email: string;
  };
}

export interface Next {
  pubName: string;
  data: any;
}

export interface SendEmailMessage {
  automationType: 'retargeting' | 'email' | 'transactional';
  utmContent: string;
  utmCampaign: string;
  account: AccountDto;
  contact: ContactDto;
  message: Email;
  next?: Next;
}

@JoiSchemaOptions({
  stripUnknown: true,
})
export class SendEmailMessageDto {
  @ApiProperty({ required: true })
  @JoiSchema(
    Joi.object({
      id: Joi.number(),
      email: Joi.string().email(),
      uuid: Joi.string(),
      firstName: Joi.string(),
      lastName: Joi.string().optional(),
      phone: Joi.string().optional(),
      customFields: Joi.object().optional(),
    }).when(Joi.ref('loadContactFromDatabase'), {
      is: true,
      then: Joi.object({
        id: Joi.number().optional(),

        email: Joi.string().email().optional(),

        uuid: Joi.string().optional(),

        firstName: Joi.string().optional(),
        lastName: Joi.string().optional(),
        phone: Joi.string().optional(),
        customFields: Joi.object().optional(),
      }).or('id', 'email', 'uuid'),
      otherwise: Joi.object({
        id: Joi.number().optional(),
        email: Joi.string().email().required(),
        uuid: Joi.string().optional(),
        firstName: Joi.string().required(),
        lastName: Joi.string().optional(),
        phone: Joi.string().optional(),
        customFields: Joi.object().optional(),
      }),
    }),
  )
  contact: ContactDto;

  @ApiProperty()
  @JoiSchema(
    Joi.object({
      id: Joi.number().allow('', null).optional(),
      title: Joi.string().allow('', null).optional(),
      name: Joi.string().allow('', null).optional(),
      previewText: Joi.string().allow('', null).optional(),
      ippool: Joi.string().allow('', null).optional(),
      subject: Joi.string().required(),
      priority: Joi.string()
        .valid(...Object.values(EmailPriority))
        .optional(),
      content: Joi.string().required(),
      from: Joi.object({
        firstName: Joi.string().required(),
        email: Joi.string().email().required(),
      }).required(),
    }).required(),
  )
  message: Email;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  automationName?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  utmContent?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  utmCampaign?: string;

  @ApiProperty()
  @JoiSchema(Joi.number().optional())
  sendAt?: number | string;

  @ApiProperty()
  @JoiSchema(Joi.boolean().optional())
  loadContactFromDatabase?: boolean;
}

export interface Contact {
  email?: string;
  hashedEmail?: string;
  firstName?: string;
  lastName?: string;
  customFields?: any;
  whatsapp?: string;
  code?: number;
  hasWhatsapp?: boolean;
}

export interface ContactCustomField {
  contact: Contact[];
  tagName?: string;
  apiKey?: number;
}

export interface TransactionalMessage {
  contact: Contact;
  name: string;
}

// Add this schema for testing
export const SendEmailMessageSchema = Joi.object({
  contact: Joi.object({
    id: Joi.number(),
    email: Joi.string().email(),
    uuid: Joi.string(),
    firstName: Joi.string(),
    lastName: Joi.string().optional(),
    phone: Joi.string().optional(),
    customFields: Joi.object().optional(),
  }).when(Joi.ref('loadContactFromDatabase'), {
    is: true,
    then: Joi.object({
      id: Joi.number().optional(),

      email: Joi.string().email().optional(),

      uuid: Joi.string().optional(),

      firstName: Joi.string().optional(),
      lastName: Joi.string().optional(),
      phone: Joi.string().optional(),
      customFields: Joi.object().optional(),
    }).or('id', 'email', 'uuid'),
    otherwise: Joi.object({
      id: Joi.number().optional(),
      email: Joi.string().email().required(),
      uuid: Joi.string().optional(),
      firstName: Joi.string().required(),
      lastName: Joi.string().optional(),
      phone: Joi.string().optional(),
      customFields: Joi.object().optional(),
    }),
  }),
  message: Joi.object({
    id: Joi.number().allow('', null).optional(),
    title: Joi.string().allow('', null).optional(),
    name: Joi.string().allow('', null).optional(),
    ippool: Joi.string().allow('', null).optional(),
    previewText: Joi.string().allow('', null).optional(),
    subject: Joi.string().required(),
    replyTo: Joi.string().allow('', null).optional(),
    priority: Joi.string()
      .valid(...Object.values(EmailPriority))
      .optional(),
    content: Joi.string().required(),
    location: Joi.object({
      bucketName: Joi.string().optional(),
      fileName: Joi.string().optional(),
    }).optional(),
    from: Joi.object({
      firstName: Joi.string().required(),
      email: Joi.string().email().required(),
    }).required(),
  }).required(),
  automationName: Joi.string().optional(),
  utmContent: Joi.string().optional(),
  utmCampaign: Joi.string().optional(),
  sendAt: Joi.number().optional(),
  loadContactFromDatabase: Joi.boolean().optional(),
});
