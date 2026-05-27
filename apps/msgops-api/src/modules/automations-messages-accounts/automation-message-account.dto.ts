import { ApiProperty } from '@nestjs/swagger';
import { AccountDto } from '../accounts/dtos/account.dto';
import { MessageDto } from '../messages/messages.dto';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class AutomationMessageAccountDto {
  @ApiProperty()
  @JoiSchema(Joi.number().required())
  id?: number;

  @ApiProperty()
  @JoiSchema(Joi.string().optional())
  testId?: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  providerAccountId: string;

  @ApiProperty({ type: [MessageDto] })
  @JoiSchema(MessageDto, (schema) => schema.optional())
  message: MessageDto;

  @ApiProperty()
  @JoiSchema(Joi.string().allow(null).optional())
  provider?: string;

  @JoiSchema(AccountDto, (schema) => schema.optional())
  account?: AccountDto;
}
