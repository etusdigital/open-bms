import { MessageDto } from '../messages/messages.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class AutomationPatchDto {
  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  id?: number;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  title?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.bool().optional())
  isActive?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().optional())
  audienceName?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().optional())
  audienceIdExternal?: number;

  @ApiPropertyOptional()
  @JoiSchema(MessageDto, (schema) => schema.optional())
  message?: MessageDto;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow(null).optional())
  version?: string;
}
