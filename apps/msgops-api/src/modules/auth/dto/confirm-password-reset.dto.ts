import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({ stripUnknown: true })
export class ConfirmPasswordResetDto {
  @JoiSchema(Joi.string().uuid().required())
  token: string;

  @JoiSchema(
    Joi.string().min(10).max(128).pattern(/[a-z]/, 'lowercase').pattern(/[A-Z]/, 'uppercase').pattern(/[0-9]/, 'digit').required().messages({
      'string.pattern.name': 'Password must contain at least one {#name} character',
      'string.min': 'Password must be at least 10 characters long',
    }),
  )
  newPassword: string;
}
