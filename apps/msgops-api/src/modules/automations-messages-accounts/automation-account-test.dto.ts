import { ApiProperty } from '@nestjs/swagger';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class AutomationAccountTestDto {
  @ApiProperty()
  @JoiSchema(Joi.string().required())
  testId: string;

  @ApiProperty()
  @JoiSchema(Joi.string().required())
  accountId: string;
}
