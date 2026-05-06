import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

const DEFAULT_URL = 'https://api.emailable.com/v1/verify';

export class EmailableSettingsDto {
  @JoiSchema(Joi.string().uri().optional().default(DEFAULT_URL))
  url?: string;

  @JoiSchema(Joi.string().trim().min(8).max(512).optional())
  apiKey?: string;
}

export const emailableSettingsSaveSchema = Joi.object<EmailableSettingsDto>({
  url: Joi.string().uri().optional().default(DEFAULT_URL),
  apiKey: Joi.string().trim().min(8).max(512).required(),
});

export class EmailableTestConnectionDto {
  @JoiSchema(Joi.string().uri().optional())
  url?: string;

  @JoiSchema(Joi.string().trim().min(8).max(512).optional())
  apiKey?: string;
}

export const emailableTestConnectionSchema = Joi.object<EmailableTestConnectionDto>({
  url: Joi.string().uri().optional(),
  apiKey: Joi.string().trim().min(8).max(512).optional(),
});

export const EMAILABLE_DEFAULT_URL = DEFAULT_URL;
