import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import { AccountDto } from '../accounts/dtos/account.dto';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class NewEmailsTemplatesDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  name: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('').optional())
  html_template?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('').optional())
  json_template?: string;

  @ApiProperty()
  @JoiSchema(AccountDto, (schema) => schema.optional())
  account?: AccountDto;
}
