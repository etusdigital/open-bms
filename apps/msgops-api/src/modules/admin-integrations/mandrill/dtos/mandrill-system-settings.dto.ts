import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

// Mandrill API keys are 22-char alphanumeric (no fixed prefix). We only
// enforce length to catch obvious typos; the testConnection call validates
// authenticity properly.
export const MANDRILL_API_KEY_MIN_LENGTH = 16;

export class MandrillSystemSettingsDto {
  @JoiSchema(Joi.string().trim().min(MANDRILL_API_KEY_MIN_LENGTH).optional())
  apiKey?: string;

  // Mandrill webhook signing key (base64 secret displayed in the dashboard
  // when the webhook is created). Used for HMAC SHA-1 verification.
  @JoiSchema(Joi.string().trim().min(8).optional().allow(''))
  webhookKey?: string;

  @JoiSchema(Joi.string().uri().optional().allow(''))
  webhookUrlBase?: string;
}

export const mandrillSystemSettingsSaveSchema = Joi.object<MandrillSystemSettingsDto>({
  apiKey: Joi.string().trim().min(MANDRILL_API_KEY_MIN_LENGTH).required(),
  webhookKey: Joi.string().trim().min(8).optional().allow(''),
  webhookUrlBase: Joi.string().uri().optional().allow(''),
});

export class MandrillTestConnectionDto {
  @JoiSchema(Joi.string().trim().min(MANDRILL_API_KEY_MIN_LENGTH).optional())
  apiKey?: string;
}

export const mandrillTestConnectionSchema = Joi.object<MandrillTestConnectionDto>({
  apiKey: Joi.string().trim().min(MANDRILL_API_KEY_MIN_LENGTH).optional(),
});
