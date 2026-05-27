import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class StatisticsUsageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public month?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public accountId?: Array<number> | number;
}
