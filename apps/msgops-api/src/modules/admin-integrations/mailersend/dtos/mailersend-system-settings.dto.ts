import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

// MailerSend tokens are prefixed with `mlsn.` and are 60+ chars
// (verified against the docs and a real fresh token in 2026-05).
export const MAILERSEND_API_KEY_PREFIX = 'mlsn.';
export const MAILERSEND_API_KEY_PATTERN = /^mlsn\./;
export const MAILERSEND_API_KEY_MIN_LENGTH = 30;

export class MailerSendSystemSettingsDto {
  @JoiSchema(Joi.string().trim().pattern(MAILERSEND_API_KEY_PATTERN, `starts with ${MAILERSEND_API_KEY_PREFIX}`).min(MAILERSEND_API_KEY_MIN_LENGTH).optional())
  apiKey?: string;

  @JoiSchema(Joi.string().trim().min(8).optional().allow(''))
  webhookSigningSecret?: string;

  @JoiSchema(Joi.string().uri().optional().allow(''))
  webhookUrlBase?: string;
}

export const mailerSendSystemSettingsSaveSchema = Joi.object<MailerSendSystemSettingsDto>({
  apiKey: Joi.string().trim().pattern(MAILERSEND_API_KEY_PATTERN, `starts with ${MAILERSEND_API_KEY_PREFIX}`).min(MAILERSEND_API_KEY_MIN_LENGTH).required(),
  webhookSigningSecret: Joi.string().trim().min(8).optional().allow(''),
  webhookUrlBase: Joi.string().uri().optional().allow(''),
});

export class MailerSendTestConnectionDto {
  @JoiSchema(Joi.string().trim().pattern(MAILERSEND_API_KEY_PATTERN, `starts with ${MAILERSEND_API_KEY_PREFIX}`).min(MAILERSEND_API_KEY_MIN_LENGTH).optional())
  apiKey?: string;
}

export const mailerSendTestConnectionSchema = Joi.object<MailerSendTestConnectionDto>({
  apiKey: Joi.string().trim().pattern(MAILERSEND_API_KEY_PATTERN, `starts with ${MAILERSEND_API_KEY_PREFIX}`).min(MAILERSEND_API_KEY_MIN_LENGTH).optional(),
});
