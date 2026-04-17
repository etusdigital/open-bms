import { TestResultDto } from '../tests/test-result.dto';
import { AutomationDto } from '../automations/automation.dto';
import { AccountDto } from '../accounts/dtos/account.dto';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import { PageDto } from 'src/dtos/filters/page.dto';
import { Labelable, LabelDto, LabelsJoiSchema } from 'src/interfaces/labelable.interface';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class MessageDto implements Labelable {
  @JoiSchema(Joi.number().allow('', null).optional())
  accountId?: number;

  @JoiSchema(Joi.number().optional())
  id?: number;

  @JoiSchema(Joi.string().max(40).optional())
  title?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  ippool?: string;

  @JoiSchema(
    Joi.string()
      .optional()
      .valid(...['low', 'normal', 'high']),
  )
  priority?: string;

  @JoiSchema(
    Joi.string()
      .optional()
      .valid(
        ...[
          'email',
          'web-push',
          'mobile-push',
          'sms',
          'whatsapp',
          'transactional-email',
          'transactional-web-push',
          'transactional-mobile-push',
          'transactional-sms',
          'transactional-whatsapp',
          '2FA-email',
          '2FA-sms',
          '2FA-whatsapp',
        ],
      ),
  )
  type?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  subject?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  previewText?: string;

  @JoiSchema(Joi.string().optional())
  content?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  text?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  fromMail?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  fromName?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  templateUrl?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  fileName?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  bucketName?: string;

  @JoiSchema(Joi.bool().optional())
  isTested?: boolean;

  @JoiSchema(Joi.number().allow('', null).optional())
  messageId?: number;

  @JoiSchema(Joi.string().allow('', null).optional())
  replyTo?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  image?: string;

  @JoiSchema(Joi.number().allow('', null).optional())
  version?: number;

  @JoiSchema(Joi.string().allow(null).optional())
  content_json?: string;

  @JoiSchema(Joi.number().allow(null).optional())
  expiryPushInSeconds?: number;

  @JoiSchema(Joi.string().allow(null).optional())
  expiryPushFilter?: string;

  @JoiSchema(Joi.string().allow(null).optional())
  notificationSound?: string;

  @JoiSchema(
    Joi.string()
      .allow(null)
      .optional()
      .valid(...['draft', 'send_approval']),
  )
  status?: string;

  @JoiSchema(
    Joi.string()
      .allow(null)
      .optional()
      .valid(...['text', 'call-to-action']),
  )
  whatsappType?: string;

  @JoiSchema(Joi.string().allow(null).optional())
  callToActionText?: string;

  @JoiSchema(Joi.string().allow(null).optional())
  providerMessageId?: string;

  @JoiSchema(Joi.array().optional())
  automations?: AutomationDto[];

  @JoiSchema(AccountDto, (schema) => schema.optional())
  account?: AccountDto;

  @JoiSchema(Joi.date().allow('', null).optional())
  updatedAt?: Date;

  @JoiSchema(Joi.date().optional())
  createdAt?: Date;

  @JoiSchema(Joi.date().allow('', null).optional())
  deletedAt?: Date;

  @JoiSchema(TestResultDto, (schema) => schema.optional())
  testStats?: TestResultDto;

  @JoiSchema(
    Joi.string()
      .allow('', null)
      .optional()
      .custom((value, helper) => {
        if (value.length === 0) {
          return true;
        }

        if (value.charAt(0) === '%' && /^%.+%$/.test(value) === false) {
          helper.message({ custom: 'Mensagem com placeholder deu erro' });
          return;
        }

        if (value.charAt(0) !== '%' && /^(https?:\/\/)([a-z0-9-]+\.)+[a-z]{2,63}(\/?\S*)?$/i.test(value) === false) {
          helper.message({ custom: 'Mensagem com url deu erro' });
          return;
        }

        return value;
      }),
  )
  url?: string;

  @JoiSchema(LabelsJoiSchema)
  labels?: Array<LabelDto>;
}

@JoiSchemaOptions({
  stripUnknown: true,
})
export class EmailsLabelsDto extends PageDto {
  @JoiSchema(Joi.string().optional().allow(''))
  product: string;

  @JoiSchema(Joi.string().required())
  language: string;
}
