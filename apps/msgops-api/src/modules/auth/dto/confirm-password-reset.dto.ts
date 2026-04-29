import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({ stripUnknown: true })
export class ConfirmPasswordResetDto {
  @JoiSchema(Joi.string().uuid().required())
  token: string;

  @JoiSchema(Joi.string().min(10).required())
  newPassword: string;
}
