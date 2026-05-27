import { FiltersDto } from './../../dtos/filters/filters.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import * as Joi from 'joi';
import { LabelsFilterable, LabelsFilterJoiSchema } from 'src/dtos/filters/labels-filterable.dto';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class AutomationsFiltersDto extends FiltersDto implements LabelsFilterable {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  title?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  titleCreate?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  name?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  isActive?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  type?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  audience_name?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  accountId?: number;

  @ApiPropertyOptional({ description: 'Filter by label IDs', type: [Number] })
  @JoiSchema(LabelsFilterJoiSchema)
  labels?: Array<number>;
}
