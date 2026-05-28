import { PageDto } from '../../../dtos/filters/page.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class ContactsPageDto extends PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('').optional())
  public title?: string | string[];

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public name?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.bool().optional())
  public isActive?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.bool().optional())
  public isUnsubscribed?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.bool().optional())
  public hasBounced?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.bool().optional())
  public isBlocked?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public type?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public tags?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public startDate?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public endDate?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public segments?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public contacts?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.bool().optional())
  public countOnly?: boolean;

  // `.single()` coerces a scalar query value (`?activities=message`) into a
  // 1-element array at the DTO boundary, so the service can always assume
  // `string[]`. Without it, Express parses single-occurrence query params as
  // strings and `params.activities.map(...)` / `.includes(...)` either crash
  // or silently match the wrong substring.
  @ApiPropertyOptional()
  @JoiSchema(Joi.array().items(Joi.string()).single().optional())
  public activities?: string[];

  @ApiPropertyOptional()
  @JoiSchema(Joi.array().items(Joi.string()).single().optional())
  public channels?: string[];

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public exportId?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public exportTotal?: number;
}
