import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class WarmupsDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  sender: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  ippool: string;

  @ApiProperty()
  @JoiSchema(Joi.string().optional().allow(null))
  replyTo: string;

  @ApiProperty()
  @JoiSchema(Joi.number().required())
  accountId: number;

  @ApiProperty()
  @JoiSchema(Joi.number().required())
  targetAccountId: number;

  @ApiProperty()
  @JoiSchema(Joi.number().optional().allow(null))
  targetSegmentId: number;

  @ApiProperty()
  @JoiSchema(Joi.number().required())
  target?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  currentSend?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  status?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow(null).optional())
  type?: string;

  @ApiProperty()
  @JoiSchema(Joi.number().allow(null).optional())
  stage?: number;

  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;
}
