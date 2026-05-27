import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { SENDGRID_API_KEY_MIN_LENGTH, SENDGRID_API_KEY_PATTERN, SENDGRID_API_KEY_PREFIX } from '../../setup/dtos/advance-step.dto';

// Per-account SendGrid configuration. The webhook URL is computed by the
// backend (SENDGRID_WEBHOOK_URL_BASE + ?account=<id>) and registered
// against SendGrid via API on save — never typed by the user.
export class SaveAccountSendgridDto {
  @JoiSchema(Joi.string().trim().pattern(SENDGRID_API_KEY_PATTERN, `starts with ${SENDGRID_API_KEY_PREFIX}`).min(SENDGRID_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}

export class TestAccountSendgridDto {
  @JoiSchema(Joi.string().trim().pattern(SENDGRID_API_KEY_PATTERN, `starts with ${SENDGRID_API_KEY_PREFIX}`).min(SENDGRID_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}
