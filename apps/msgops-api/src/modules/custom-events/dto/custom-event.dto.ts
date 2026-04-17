import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class CustomEventDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().max(40).required())
  name: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @ApiProperty()
  @JoiSchema(Joi.number().optional())
  accountId?: number;

  @ApiProperty()
  @JoiSchema(Joi.boolean().optional())
  isDefault?: boolean;

  @ApiProperty()
  @JoiSchema(Joi.optional())
  properties?: string;

  @ApiProperty()
  @JoiSchema(Joi.date().optional())
  createdAt?: Date;

  @ApiProperty()
  @JoiSchema(Joi.date().allow(null).optional())
  updatedAt?: Date;

  @ApiProperty()
  @JoiSchema(Joi.date().allow(null).optional())
  deletedAt?: Date;
}
