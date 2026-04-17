import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
@JoiSchemaOptions({
  stripUnknown: true,
})
export class FieldsDto {
  @ApiProperty()
  @JoiSchema(Joi.string().required())
  public id: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().required())
  public name: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().required())
  public field: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().required())
  public type: string;
}
