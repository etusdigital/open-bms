import { PageDto } from '../../../dtos/filters/page.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class TagsPageDto extends PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.alternatives().try(Joi.array().allow(''), Joi.string().allow('')).optional())
  public title?: string | string[];

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  titleCreate?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public type?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  public accountId?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null, 'active', 'inactive').optional())
  public status?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  public withCount?: boolean;
}
