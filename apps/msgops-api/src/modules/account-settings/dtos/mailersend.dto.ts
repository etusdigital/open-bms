import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { MAILERSEND_API_KEY_MIN_LENGTH, MAILERSEND_API_KEY_PATTERN, MAILERSEND_API_KEY_PREFIX } from '../../admin-integrations/mailersend/dtos/mailersend-system-settings.dto';

export class SaveAccountMailersendDto {
  @JoiSchema(Joi.string().trim().pattern(MAILERSEND_API_KEY_PATTERN, `starts with ${MAILERSEND_API_KEY_PREFIX}`).min(MAILERSEND_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}

export class TestAccountMailersendDto {
  @JoiSchema(Joi.string().trim().pattern(MAILERSEND_API_KEY_PATTERN, `starts with ${MAILERSEND_API_KEY_PREFIX}`).min(MAILERSEND_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}
