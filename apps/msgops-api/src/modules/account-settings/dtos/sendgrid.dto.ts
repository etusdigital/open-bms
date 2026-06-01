import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { SENDGRID_API_KEY_MIN_LENGTH, SENDGRID_API_KEY_PATTERN, SENDGRID_API_KEY_PREFIX } from '../../setup/dtos/advance-step.dto';

// Sender domain (EVO-1466). Net-new pattern: `advance-step.dto` only carries
// SendGrid API-key patterns, none for domains. Requires at least one dot, RFC-ish
// labels (alnum + internal hyphens), and a 2+ alpha TLD; rejects spaces, leading/
// trailing dots/hyphens, and bare single labels. We do NOT validate the TLD against
// the IANA list — that is version-dependent in Joi and overkill for OSS.
export const SENDGRID_FROM_DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

// Per-account SendGrid configuration. The webhook URL is computed by the
// backend (SENDGRID_WEBHOOK_URL_BASE + ?account=<id>) and registered
// against SendGrid via API on save — never typed by the user.
//
// `apiKey` is optional to support metadata-only edits: an account that already
// has a stored key can update just `fromDomain` without re-submitting (and
// re-registering the webhook for) the key. The service enforces "apiKey absent
// requires an existing stored key".
export class SaveAccountSendgridDto {
  @JoiSchema(Joi.string().trim().pattern(SENDGRID_API_KEY_PATTERN, `starts with ${SENDGRID_API_KEY_PREFIX}`).min(SENDGRID_API_KEY_MIN_LENGTH).optional())
  apiKey?: string;

  @JoiSchema(Joi.string().trim().lowercase().pattern(SENDGRID_FROM_DOMAIN_PATTERN, 'valid sender domain').required())
  fromDomain: string;
}

export class TestAccountSendgridDto {
  @JoiSchema(Joi.string().trim().pattern(SENDGRID_API_KEY_PATTERN, `starts with ${SENDGRID_API_KEY_PREFIX}`).min(SENDGRID_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}
