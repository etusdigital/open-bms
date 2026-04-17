import { ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import { PageDto } from '../../dtos/filters/page.dto';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class CampaignsRulesFilterDto extends PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  name?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  declare sortBy?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().valid('ASC', 'DESC').optional())
  declare order?: 'ASC' | 'DESC';

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().optional())
  countOnly?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  startDate?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  endDate?: string;
}

@JoiSchemaOptions({
  stripUnknown: true,
})
export class CampaignsConfigsFilterDto extends PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  name?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  declare sortBy?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().valid('ASC', 'DESC').optional())
  declare order?: 'ASC' | 'DESC';

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().optional())
  countOnly?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  startDate?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  endDate?: string;
}
