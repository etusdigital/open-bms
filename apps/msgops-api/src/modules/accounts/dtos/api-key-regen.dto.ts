import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class RequestRegenDto {
  @JoiSchema(Joi.string().valid('api_key', 'api_key_tracker').required())
  keyType: 'api_key' | 'api_key_tracker';

  @JoiSchema(Joi.string().isoDate().allow(null).optional())
  expiresAt?: string | null;
}

@JoiSchemaOptions({
  stripUnknown: true,
})
export class ConfirmRegenDto {
  @JoiSchema(Joi.string().hex().length(64).required())
  token: string;

  @JoiSchema(Joi.string().valid('api_key', 'api_key_tracker').required())
  keyType: 'api_key' | 'api_key_tracker';
}
