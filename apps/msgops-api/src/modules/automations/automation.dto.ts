import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import { MessageDto } from '../messages/messages.dto';
import { AccountDto } from '../accounts/dtos/account.dto';
import { Labelable, LabelDto, LabelsJoiSchema } from 'src/interfaces/labelable.interface';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class AutomationDto implements Labelable {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiProperty()
  @JoiSchema(Joi.number().allow('', null).optional())
  accountId?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().allow(null).optional())
  title?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.bool().optional())
  isActive?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.bool().optional())
  isRateLimit?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  type?: string;

  @ApiProperty()
  @JoiSchema(Joi.optional())
  steps?: any;

  @ApiProperty()
  @JoiSchema(Joi.optional())
  triggers?: any;

  @ApiProperty()
  @JoiSchema(Joi.number().optional())
  stepId?: number;

  @ApiProperty()
  @JoiSchema(Joi.number().allow(null).optional())
  countSteps?: number;

  @ApiProperty()
  @JoiSchema(MessageDto, (schema) => schema.optional())
  message?: MessageDto;

  @ApiProperty()
  @JoiSchema(AccountDto, (schema) => schema.optional())
  account?: AccountDto;

  @ApiProperty()
  @JoiSchema(Joi.date().allow(null).optional())
  createdAt?: Date;

  @ApiProperty()
  @JoiSchema(Joi.date().allow(null).optional())
  updatedAt?: Date;

  @ApiProperty()
  @JoiSchema(Joi.date().allow('', null).optional())
  deletedAt?: Date;

  @ApiProperty()
  @JoiSchema(Joi.string().allow(null).optional())
  version?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow(null).optional())
  verticalType?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().valid('open', 'click').allow(null).optional())
  target?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.object().allow(null).optional())
  flowLayout?: Record<string, unknown>;

  @ApiPropertyOptional()
  @JoiSchema(LabelsJoiSchema)
  labels?: Array<LabelDto>;
}
