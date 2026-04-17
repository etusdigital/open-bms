import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class CampaignsRulesDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  accountId?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  name: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  description: string;

  @ApiProperty()
  @JoiSchema(Joi.array().items(Joi.number().required()))
  weekDays?: number[];

  @ApiProperty()
  @JoiSchema(Joi.array().items(Joi.object().required()))
  configs?: CampaignsConfigsDto[];

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().optional())
  createdAt?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().optional())
  updatedAt?: Date;
}

@JoiSchemaOptions({
  stripUnknown: true,
})
export class CampaignsConfigsDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  accountId?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  name: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  description: string;

  @ApiProperty()
  @JoiSchema(Joi.object().required())
  configs: any;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().optional())
  createdAt?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().optional())
  updatedAt?: Date;
}
