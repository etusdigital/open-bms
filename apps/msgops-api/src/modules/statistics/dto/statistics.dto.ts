import { PageDto } from '../../../dtos/filters/page.dto';
import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class StatisticsDto extends PageDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public startDate?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  public endDate?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.array().optional())
  public messages?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.array().optional())
  public segments?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.array().optional())
  public tags?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.array().optional())
  public senders?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.array().optional())
  public email?: Array<string>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.array().optional())
  public webPush?: Array<string>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.array().optional())
  public mobilePush?: Array<string>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().optional().default(false))
  public afterTestAb?: boolean | string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().optional().default(false))
  public groupByMessage?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  public automationId?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public groupItems?: Array<string>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public type?: string;
}

export class DashboardStatisticsDto extends OmitType(StatisticsDto, ['messages'] as const) {
  @ApiPropertyOptional()
  @JoiSchema(Joi.array().optional())
  public messages?: Array<number>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public campaigns?: Array<number> | string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public automations?: Array<number> | string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.optional())
  public subUsers?: Array<string>;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().optional().default(false))
  public groupByCampaign?: boolean;
}
