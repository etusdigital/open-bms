import { ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import { PageDto } from 'src/dtos/filters/page.dto';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class LabelsFilterDto extends PageDto {
  @ApiPropertyOptional({ description: 'Account ID to filter labels' })
  @JoiSchema(Joi.number().optional())
  accountId?: number;

  @ApiPropertyOptional({ description: 'Search by label name' })
  @JoiSchema(Joi.string().optional())
  name?: string;

  @ApiPropertyOptional({ description: 'Search by label description' })
  @JoiSchema(Joi.string().optional())
  description?: string;

  @ApiPropertyOptional({ description: 'Include deleted labels', default: false })
  @JoiSchema(Joi.boolean().optional().default(false))
  includeDeleted?: boolean;
}

@JoiSchemaOptions({
  stripUnknown: true,
})
export class LabelsContentsFilterDto extends PageDto {
  @ApiPropertyOptional({ description: 'Label ID to filter contents' })
  @JoiSchema(Joi.number().optional())
  labelId?: number;

  @ApiPropertyOptional({ description: 'Label name to filter contents' })
  @JoiSchema(Joi.string().optional())
  labelName?: string;

  @ApiPropertyOptional({ description: 'Entity name to filter contents' })
  @JoiSchema(Joi.string().optional())
  entityName?: string;

  @ApiPropertyOptional({ description: 'Entity ID to filter contents' })
  @JoiSchema(Joi.number().optional())
  entityId?: number;
}
