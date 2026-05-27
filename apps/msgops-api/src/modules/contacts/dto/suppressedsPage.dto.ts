import { PageDto } from '../../../dtos/filters/page.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class SuppressedsPageDto extends PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('').optional())
  public title?: string | string[];

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public startDate?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public endDate?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public emails?: Array<string>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.bool().optional())
  public countOnly?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.bool().optional())
  public blockedOnly?: boolean;

  @ApiPropertyOptional({ enum: ['blocked', 'unsubscribed'] })
  @JoiSchema(Joi.string().valid('blocked', 'unsubscribed').optional())
  public type?: 'blocked' | 'unsubscribed';
}
