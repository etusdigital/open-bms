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

// Firebase WEB config — client-side PUBLIC values (the browser apiKey is not a
// secret). Used only to (re)generate the platform web-push service worker.
const webConfigValidator = Joi.object({
  apiKey: Joi.string().trim().max(200).optional(),
  authDomain: Joi.string().trim().max(200).optional(),
  projectId: Joi.string().trim().max(200).optional(),
  storageBucket: Joi.string().trim().max(200).optional(),
  messagingSenderId: Joi.string().trim().max(100).optional(),
  appId: Joi.string().trim().max(200).optional(),
  measurementId: Joi.string().trim().max(100).optional(),
}).optional();

const vapidValidator = Joi.string().trim().max(400).optional();

export class FcmSettingsDto {
  @JoiSchema(serviceAccountJsonValidator.optional())
  serviceAccountJson?: string;

  @JoiSchema(webConfigValidator)
  webConfig?: Record<string, string>;

  @JoiSchema(vapidValidator)
  vapidPublicKey?: string;
}

// serviceAccountJson stays required to save (it's the send credential); web
// config + VAPID are optional add-ons for web-push registration.
export const fcmSettingsSaveSchema = Joi.object<FcmSettingsDto>({
  serviceAccountJson: serviceAccountJsonValidator.required(),
  webConfig: webConfigValidator,
  vapidPublicKey: vapidValidator,
});

export class FcmTestConnectionDto {
  @JoiSchema(serviceAccountJsonValidator.optional())
  serviceAccountJson?: string;
}

export const fcmTestConnectionSchema = Joi.object<FcmTestConnectionDto>({
  serviceAccountJson: serviceAccountJsonValidator.optional(),
});
