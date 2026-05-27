import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class TestCreatedDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  accountId?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  siloName?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  testId: string;

  @ApiProperty()
  @JoiSchema(Joi.number().required())
  version: number;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  provider: string;
}
