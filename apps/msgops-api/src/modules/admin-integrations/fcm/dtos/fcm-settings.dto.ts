import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

const serviceAccountJsonValidator = Joi.string()
  .trim()
  .min(50)
  .max(64_000)
  .custom((value, helpers) => {
    let parsed: any;
    try {
      parsed = JSON.parse(value);
    } catch {
      return helpers.error('any.invalid', { message: 'serviceAccountJson não é JSON válido' });
    }
    if (!parsed || typeof parsed !== 'object') return helpers.error('any.invalid');
    const required = ['project_id', 'private_key', 'client_email'];
    const missing = required.filter((k) => !parsed[k]);
    if (missing.length) return helpers.error('any.invalid', { message: `serviceAccountJson missing fields: ${missing.join(',')}` });
    return value;
  }, 'service-account-json');

export class FcmSettingsDto {
  @JoiSchema(serviceAccountJsonValidator.optional())
  serviceAccountJson?: string;
}

export const fcmSettingsSaveSchema = Joi.object<FcmSettingsDto>({
  serviceAccountJson: serviceAccountJsonValidator.required(),
});

export class FcmTestConnectionDto {
  @JoiSchema(serviceAccountJsonValidator.optional())
  serviceAccountJson?: string;
}

export const fcmTestConnectionSchema = Joi.object<FcmTestConnectionDto>({
  serviceAccountJson: serviceAccountJsonValidator.optional(),
});
