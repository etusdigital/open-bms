import { ApiPropertyOptional } from '@nestjs/swagger';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import * as Joi from 'joi';
import { PageDto } from '../../dtos/filters/page.dto';
import { LabelsFilterable, LabelsFilterJoiSchema } from 'src/dtos/filters/labels-filterable.dto';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class CampaignFilterDto extends PageDto implements LabelsFilterable {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow('', null).optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  title?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  titleCreate?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  time?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  type?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  startDate?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  endDate?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.allow('', null).optional())
  types?: Array<string>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.allow('', null).optional())
  messages?: Array<string>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.allow(null).optional())
  status?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.allow(null).optional())
  tags?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.allow(null).optional())
  segments?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.allow(null).optional())
  isWarmup?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.array().optional())
  public campaignsIds?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().optional())
  public isTrigger?: boolean;

  @ApiPropertyOptional({ description: 'Filter by label IDs', type: [Number] })
  @JoiSchema(LabelsFilterJoiSchema)
  labels?: Array<number>;
}
