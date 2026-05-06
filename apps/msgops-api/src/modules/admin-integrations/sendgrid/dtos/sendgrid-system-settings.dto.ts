import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { SENDGRID_API_KEY_MIN_LENGTH, SENDGRID_API_KEY_PATTERN, SENDGRID_API_KEY_PREFIX } from '../../../setup/dtos/advance-step.dto';

export class SendgridSystemSettingsDto {
  // Optional on update — service merges with existing if absent.
  @JoiSchema(Joi.string().trim().pattern(SENDGRID_API_KEY_PATTERN, `starts with ${SENDGRID_API_KEY_PREFIX}`).min(SENDGRID_API_KEY_MIN_LENGTH).optional())
  apiKey?: string;

  @JoiSchema(Joi.string().uri().optional().allow(''))
  apiBaseUrl?: string;

  @JoiSchema(Joi.string().uri().optional().allow(''))
  webhookUrlBase?: string;

  @JoiSchema(Joi.string().trim().optional().allow(''))
  ipPool?: string;
}

export const sendgridSystemSettingsSaveSchema = Joi.object<SendgridSystemSettingsDto>({
  apiKey: Joi.string().trim().pattern(SENDGRID_API_KEY_PATTERN, `starts with ${SENDGRID_API_KEY_PREFIX}`).min(SENDGRID_API_KEY_MIN_LENGTH).required(),
  apiBaseUrl: Joi.string().uri().optional().allow(''),
  webhookUrlBase: Joi.string().uri().optional().allow(''),
  ipPool: Joi.string().trim().optional().allow(''),
});

export class SendgridSystemTestConnectionDto {
  @JoiSchema(Joi.string().trim().pattern(SENDGRID_API_KEY_PATTERN, `starts with ${SENDGRID_API_KEY_PREFIX}`).min(SENDGRID_API_KEY_MIN_LENGTH).optional())
  apiKey?: string;

  @JoiSchema(Joi.string().uri().optional().allow(''))
  apiBaseUrl?: string;
}

export const sendgridSystemTestConnectionSchema = Joi.object<SendgridSystemTestConnectionDto>({
  apiKey: Joi.string().trim().pattern(SENDGRID_API_KEY_PATTERN, `starts with ${SENDGRID_API_KEY_PREFIX}`).min(SENDGRID_API_KEY_MIN_LENGTH).optional(),
  apiBaseUrl: Joi.string().uri().optional().allow(''),
});
