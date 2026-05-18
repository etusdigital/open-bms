import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class NewSenderDto {
  @ApiProperty()
  @JoiSchema(Joi.string().required())
  senderEmail: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  senderName: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.string().allow('', null).optional())
  senderReplyTo?: string;

  @ApiPropertyOptional()
  @JoiSchema(Joi.boolean().allow('', null).optional())
  isDefault?: boolean;

  @ApiPropertyOptional()
  @JoiSchema(Joi.number().allow(null).optional())
  accountId?: number;
}
