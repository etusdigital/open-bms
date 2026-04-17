import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { PageDto } from 'src/dtos/filters/page.dto';

export class WarmupPageDto extends PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.alternatives().try(Joi.array().allow(''), Joi.string().allow('')).optional())
  public name?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.alternatives().try(Joi.array().allow(''), Joi.string().allow('')).optional())
  public status?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow(null).optional())
  accountId?: number;
}
