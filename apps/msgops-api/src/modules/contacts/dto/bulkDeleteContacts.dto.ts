import { ApiProperty } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export const BULK_DELETE_MAX_IDS = 1000;

export class BulkDeleteContactsDto {
  @ApiProperty({ type: [Number], maxItems: BULK_DELETE_MAX_IDS })
  @JoiSchema(Joi.array().items(Joi.number().integer().positive()).min(1).max(BULK_DELETE_MAX_IDS).required())
  public ids: number[];
}
