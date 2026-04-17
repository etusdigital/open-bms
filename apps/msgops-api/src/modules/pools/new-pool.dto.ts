import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class NewPoolsDto {
  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  name: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('').optional())
  poolName: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('').optional())
  ip?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('').optional())
  accountId?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  senderEmail?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  senderName?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  senderReplyTo?: string;

  @ApiProperty()
  @JoiSchema(Joi.boolean().allow('', null).optional())
  isDefault?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().allow(null).optional())
  isWarmup?: boolean;
}
