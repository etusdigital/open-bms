import { ApiProperty } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import { TagDto } from './tags.dto';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class SegmentDto extends TagDto {
  @ApiProperty()
  @JoiSchema(Joi.string().allow(null).optional())
  query?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow(null).optional())
  scheduleCloudTaskId?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow(null, 'active', 'inactive').optional())
  status?: string;

  @ApiProperty()
  @JoiSchema(Joi.number().allow(null).optional())
  recurrence?: number;

  @ApiProperty()
  @JoiSchema(Joi.allow(null).optional())
  steps?: any;

  @ApiProperty()
  @JoiSchema(Joi.allow(null).optional())
  addBounced?: boolean;

  @ApiProperty()
  @JoiSchema(Joi.allow(null).optional())
  addUnsubscribed?: boolean;

  @ApiProperty()
  @JoiSchema(Joi.allow(null).optional())
  isRealTimeSegment?: boolean;

  @ApiProperty()
  @JoiSchema(Joi.allow(null).optional())
  addInvalid?: boolean;

  @ApiProperty()
  @JoiSchema(Joi.allow(null).optional())
  isClickhouseSegment?: boolean;

  @ApiProperty()
  @JoiSchema(Joi.allow(null).optional())
  externalQuerySteps?: any;

  @ApiProperty()
  @JoiSchema(Joi.allow(null).optional())
  contactsLimit?: number;
}
