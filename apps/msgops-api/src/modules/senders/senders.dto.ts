import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class SendersDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  senderEmail?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  senderName?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  senderReplyTo?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  accountId?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().optional())
  isDefault?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  sgVerifiedSenderId?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  removedAtSource?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().optional())
  createdAt?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().optional())
  updatedAt?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().optional())
  deletedAt?: Date;
}

export class SyncResultDto {
  @ApiProperty()
  created: number;

  @ApiProperty()
  updated: number;

  @ApiProperty()
  removed: number;
}
