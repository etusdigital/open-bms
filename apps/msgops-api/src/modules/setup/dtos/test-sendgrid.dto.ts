import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { SENDGRID_API_KEY_MIN_LENGTH, SENDGRID_API_KEY_PATTERN, SENDGRID_API_KEY_PREFIX } from './advance-step.dto';

export class TestSendgridDto {
  @JoiSchema(Joi.string().trim().pattern(SENDGRID_API_KEY_PATTERN, `starts with ${SENDGRID_API_KEY_PREFIX}`).min(SENDGRID_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}
