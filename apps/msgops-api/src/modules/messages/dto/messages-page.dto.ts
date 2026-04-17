import { PageDto } from '../../../dtos/filters/page.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { LabelsFilterable, LabelsFilterJoiSchema } from 'src/dtos/filters/labels-filterable.dto';

export class MessagesPageDto extends PageDto implements LabelsFilterable {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('').optional())
  public title?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  public titleCreate?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('').optional())
  public ipPool?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow('', null).optional())
  public selectedAutomation?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().allow(null).optional())
  public withTests?: boolean = false;

  @ApiPropertyOptional()
  @JoiSchema(Joi.allow('').optional())
  public type?: string | string[];

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('').optional())
  public status?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.array().optional())
  public messagesIds?: Array<number>;

  @ApiPropertyOptional({ description: 'Filter by label IDs', type: [Number] })
  @JoiSchema(LabelsFilterJoiSchema)
  labels?: Array<number>;
}
