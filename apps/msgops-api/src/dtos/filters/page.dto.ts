import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
@JoiSchemaOptions({
  stripUnknown: true,
})
export class PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public itemsPerPage?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public page?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  public totalItems?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  public totalPages?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional().uppercase())
  public order?: 'ASC' | 'DESC';

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  public sortBy?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.alternatives().try(Joi.array().allow(''), Joi.string().allow('')).optional())
  public search?: string | string[];
}
