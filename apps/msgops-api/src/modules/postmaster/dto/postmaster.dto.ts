import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class PostmasterDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public startDate?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public endDate?: Date;
}
