import { ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export const LabelsFilterJoiSchema = Joi.array().items(Joi.number()).allow(null).optional();

export interface LabelsFilterable {
  labels?: Array<number>;
}

export abstract class LabelsFilterableDto implements LabelsFilterable {
  @ApiPropertyOptional({
    description: 'Filter by label IDs',
    type: [Number],
    example: [1, 2, 3],
  })
  @JoiSchema(LabelsFilterJoiSchema)
  labels?: Array<number>;
}
