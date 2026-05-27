import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class LabelsDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  accountId?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().max(100).required())
  name: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  createdAt?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  updatedAt?: Date;

  @ApiPropertyOptional()
  @JoiSchema(Joi.date().allow(null).optional())
  deletedAt?: Date;

  @ApiPropertyOptional()
  labelsContents?: LabelsContentsDto[];
}

@JoiSchemaOptions({
  stripUnknown: true,
})
export class LabelsContentsDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiProperty()
  @JoiSchema(Joi.number().required())
  labelId: number;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  entityName: string;

  @ApiProperty()
  @JoiSchema(Joi.number().required())
  entityId: number;

  @ApiPropertyOptional()
  label?: LabelsDto;
}

@JoiSchemaOptions({
  stripUnknown: true,
})
export class CreateLabelContentDto {
  @ApiProperty()
  @JoiSchema(Joi.number().required())
  labelId: number;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  entityName: string;

  @ApiProperty()
  @JoiSchema(Joi.array().items(Joi.number()).min(1).required())
  entityIds: number[];
}

@JoiSchemaOptions({
  stripUnknown: true,
})
export class RemoveLabelContentDto {
  @ApiProperty()
  @JoiSchema(Joi.number().required())
  labelId: number;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  entityName: string;

  @ApiProperty()
  @JoiSchema(Joi.array().items(Joi.number()).min(1).required())
  entityIds: number[];
}
