import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class PoolsDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  name: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  poolName?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  ip?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  accountId?: number;

  @ApiProperty()
  @JoiSchema(Joi.boolean().optional())
  isDefault?: boolean;

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
