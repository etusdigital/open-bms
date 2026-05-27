import { ApiProperty } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class FileUploadDto {
  @ApiProperty()
  @JoiSchema(Joi.number().required())
  messageId: number;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  name: string;

  @ApiProperty({ required: false, deprecated: true })
  @JoiSchema(Joi.boolean().optional())
  isAutomatedMessage?: boolean;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  data: string;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  pathExternal?: string;
}
