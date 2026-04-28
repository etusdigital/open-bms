import { PageDto } from '../../dtos/filters/page.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class PoolPageDto extends PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.alternatives().try(Joi.array().allow(''), Joi.string().allow('')).optional())
  public name?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow(null).optional())
  accountId?: number;
}
