import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

// Resend tokens are prefixed with `re_` and are 30+ chars.
export const RESEND_API_KEY_PREFIX = 're_';
export const RESEND_API_KEY_PATTERN = /^re_/;
export const RESEND_API_KEY_MIN_LENGTH = 20;

export class ResendSystemSettingsDto {
  @JoiSchema(Joi.string().trim().pattern(RESEND_API_KEY_PATTERN, `starts with ${RESEND_API_KEY_PREFIX}`).min(RESEND_API_KEY_MIN_LENGTH).optional())
  apiKey?: string;

  // Resend uses Svix; the endpoint secret typically starts with `whsec_`.
  @JoiSchema(Joi.string().trim().min(8).optional().allow(''))
  webhookSigningSecret?: string;

  @JoiSchema(Joi.string().uri().optional().allow(''))
  webhookUrlBase?: string;
}

export const resendSystemSettingsSaveSchema = Joi.object<ResendSystemSettingsDto>({
  apiKey: Joi.string().trim().pattern(RESEND_API_KEY_PATTERN, `starts with ${RESEND_API_KEY_PREFIX}`).min(RESEND_API_KEY_MIN_LENGTH).required(),
  webhookSigningSecret: Joi.string().trim().min(8).optional().allow(''),
  webhookUrlBase: Joi.string().uri().optional().allow(''),
});

export class ResendTestConnectionDto {
  @JoiSchema(Joi.string().trim().pattern(RESEND_API_KEY_PATTERN, `starts with ${RESEND_API_KEY_PREFIX}`).min(RESEND_API_KEY_MIN_LENGTH).optional())
  apiKey?: string;
}

export const resendTestConnectionSchema = Joi.object<ResendTestConnectionDto>({
  apiKey: Joi.string().trim().pattern(RESEND_API_KEY_PATTERN, `starts with ${RESEND_API_KEY_PREFIX}`).min(RESEND_API_KEY_MIN_LENGTH).optional(),
});
