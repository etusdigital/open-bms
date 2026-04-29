import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({ stripUnknown: true })
export class SuspendAccountDto {
  @JoiSchema(Joi.boolean().required())
  isActive: boolean;
}
