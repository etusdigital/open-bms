import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { RESEND_API_KEY_MIN_LENGTH, RESEND_API_KEY_PATTERN, RESEND_API_KEY_PREFIX } from '../../admin-integrations/resend/dtos/resend-system-settings.dto';

export class SaveAccountResendDto {
  @JoiSchema(Joi.string().trim().pattern(RESEND_API_KEY_PATTERN, `starts with ${RESEND_API_KEY_PREFIX}`).min(RESEND_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}

export class TestAccountResendDto {
  @JoiSchema(Joi.string().trim().pattern(RESEND_API_KEY_PATTERN, `starts with ${RESEND_API_KEY_PREFIX}`).min(RESEND_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}
