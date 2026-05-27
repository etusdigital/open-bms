import { ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({ stripUnknown: true })
export class ActivityQueryDto {
  @ApiPropertyOptional({ description: 'GitHub-style filter query (account:, contact:, event:, ...)' })
  @JoiSchema(Joi.string().allow('').optional())
  q?: string;

  @ApiPropertyOptional({ description: '1-based page number', default: 1 })
  @JoiSchema(Joi.number().integer().min(1).max(10_000).optional().default(1))
  page?: number;

  @ApiPropertyOptional({ description: 'Page size (1-200)', default: 50 })
  @JoiSchema(Joi.number().integer().min(1).max(200).optional().default(50))
  limit?: number;
}
