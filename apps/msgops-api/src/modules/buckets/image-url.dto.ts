import { ApiProperty } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class ImageUrlDto {
  @ApiProperty()
  @JoiSchema(Joi.string().required())
  url: string;
}
