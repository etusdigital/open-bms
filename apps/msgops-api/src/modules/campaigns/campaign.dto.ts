import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import { CampaignRecurrenceSettings } from './campaigns.interface';
import { Labelable, LabelDto, LabelsJoiSchema } from 'src/interfaces/labelable.interface';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class CampaignDto implements Labelable {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  accountId?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  title: string;

  @ApiProperty()
  @JoiSchema(Joi.string())
  name: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string())
  type: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  messageType?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().allow(null).default(false))
  sendToAll?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().allow(null).default(false))
  sendAfterCreate?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  publisher?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  scheduleTo?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  scheduleToCloudTaskId?: string;

  // `steps` and `triggers` belonged to the premium Trigger Campaigns feature
  // (removed in remove-premium-features). Kept as optional `any` so the
  // remaining campaigns.service code paths that branch on `isTriggerCampaign`
  // (and never run in the OSS build) still type-check.
  @ApiPropertyOptional()
  @JoiSchema(Joi.allow(null).optional())
  steps?: any;

  @ApiPropertyOptional()
  @JoiSchema(Joi.allow(null).optional())
  triggers?: any;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  query?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.allow(null).optional())
  campaignMessage?: any;

  @ApiPropertyOptional()
  @JoiSchema(Joi.allow(null).optional())
  tags?: any;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  testabScheduleTo?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  testabScheduleEnd?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  testabScheduleToCloudTaskId?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  testabScheduleEndCloudTaskId?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow(null).optional())
  testabAudiencePercent?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  testabCriteria?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().allow(null).optional())
  testabSentAfterTest?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().allow(null).optional())
  isRateLimit?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().allow(null).optional())
  runSegment?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow(null).optional())
  testabLastId?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow(null).optional())
  spreadSending?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow(null).optional())
  sentContacts?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow(null).optional())
  sentPercentage?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().allow(null).optional())
  isWarmup?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  createdAt?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  updatedAt?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  deletedAt?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow(null).optional())
  status?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().allow(null).optional())
  confirmSaveDuplicate?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(
    Joi.when(Joi.ref('type'), {
      is: 'recurring',
      then: Joi.object({
        date: Joi.date().required().messages({ '*': 'Recurring settings without date or invalid date' }),
        interval: Joi.number().min(1).required().messages({ '*': 'Recurring interval needs to be greater than 0' }),
        frequency: Joi.number().allow(1, 2, 3).required().messages({ '*': 'Missing frequency interval' }),
        weekDays: Joi.when(Joi.ref('...recurrenceSettings.frequency'), {
          is: 2,
          then: Joi.array().items(Joi.number().min(0).max(6).required()).messages({ '*': 'Missing days for frequency interval' }),
        }),
        hasExpiration: Joi.boolean().default(false).required(),
        untilDate: Joi.date().greater(Joi.ref('...recurrenceSettings.date')).allow(null).optional().messages({ '*': 'Invalid date for recurring expiration' }),
        untilSend: Joi.when(Joi.ref('...recurrenceSettings.untilDate'), {
          is: Joi.any().valid(null, ''),
          then: Joi.number().min(1).allow(null).optional().messages({ '*': 'Invalid number for recurring expiration, min: 1' }),
        }),
        firstSentDate: Joi.date().allow(null, '').optional(),
        lastSentDate: Joi.date().allow(null, '').optional(),
      }).required(),
      otherwise: Joi.object().allow(null).optional(),
    }),
  )
  recurrenceSettings: CampaignRecurrenceSettings;

  @ApiPropertyOptional()
  @JoiSchema(LabelsJoiSchema)
  labels?: Array<LabelDto>;
}
