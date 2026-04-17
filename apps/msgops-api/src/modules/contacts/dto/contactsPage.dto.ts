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

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public activities?: string[];

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public channels?: string[];

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public exportId?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public exportTotal?: number;
}
