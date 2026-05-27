import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import { AccountDto } from '../accounts/dtos/account.dto';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class EmailsTemplatesDto {
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
  html_template?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  json_template?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  image_template?: string;

  @ApiProperty()
  @JoiSchema(AccountDto, (schema) => schema.optional())
  account?: AccountDto;

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
