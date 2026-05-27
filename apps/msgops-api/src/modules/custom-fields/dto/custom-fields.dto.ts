import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class CustomFieldsDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiProperty()
  @JoiSchema(Joi.number().optional())
  accountId?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().max(40).required())
  title: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @ApiProperty()
  @JoiSchema(Joi.number().allow(null).optional())
  order?: number;

  @ApiProperty()
  @JoiSchema(Joi.date().optional())
  createdAt?: Date;

  @ApiProperty()
  @JoiSchema(Joi.date().allow(null).optional())
  updatedAt?: Date;

  @ApiProperty()
  @JoiSchema(Joi.string().valid('text', 'number', 'date', 'list', 'file').default('text').required())
  type: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  label?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  placeholder?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  fieldType?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  fieldFormat?: string;

  @ApiProperty()
  @JoiSchema(Joi.array().items(Joi.string()).allow('', null).optional())
  fileFormats?: string[];

  @ApiProperty()
  @JoiSchema(Joi.number().allow(null).optional())
  characterLimit?: number;

  @ApiProperty()
  @JoiSchema(Joi.number().allow(null).optional())
  decimalLength?: number;

  @ApiProperty()
  @JoiSchema(Joi.array().items(Joi.string()).allow('', null).optional())
  options?: string[];

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  mask?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().allow('', null).optional())
  attributionType?: string;
}
