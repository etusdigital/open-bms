import { PageDto } from '../../../dtos/filters/page.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class CustomEventsPageDto extends PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.alternatives().try(Joi.array().allow(''), Joi.string().allow('')).optional())
  public title?: string | string[];
}
