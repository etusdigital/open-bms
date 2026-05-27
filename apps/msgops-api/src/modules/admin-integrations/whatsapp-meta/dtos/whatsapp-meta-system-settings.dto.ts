import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

/**
 * Wave 7.8 — Meta App credentials (direct WhatsApp Cloud mode).
 *
 * Persisted in `system_config` under WHATSAPP_META_KEY. Mirrored to a
 * `whatsapp-meta.env` file at boot so workers can pick them up without
 * a DB roundtrip on cold start.
 *
 * Mirrors the SendGrid/SES pattern — all fields optional on PUT; the
 * service merges with existing values so a partial save (e.g. only
 * rotating the App Secret) doesn't wipe other fields.
 */
export class WhatsappMetaSystemSettingsDto {
  @JoiSchema(Joi.string().trim().optional().allow(''))
  appId?: string;

  @JoiSchema(Joi.string().trim().optional().allow(''))
  appSecret?: string;

  @JoiSchema(Joi.string().trim().optional().allow(''))
  configId?: string;

  @JoiSchema(Joi.string().trim().optional().allow(''))
  verifyToken?: string;

  // e.g. v18.0, v19.0 — defaults to v18.0 when empty.
  @JoiSchema(
    Joi.string()
      .trim()
      .pattern(/^v\d+\.\d+$/, 'graph version like v18.0')
      .optional()
      .allow(''),
  )
  graphVersion?: string;
}

export const whatsappMetaSystemSettingsSaveSchema = Joi.object<WhatsappMetaSystemSettingsDto>({
  appId: Joi.string().trim().required(),
  appSecret: Joi.string().trim().required(),
  configId: Joi.string().trim().required(),
  verifyToken: Joi.string().trim().min(8).required(),
  graphVersion: Joi.string()
    .trim()
    .pattern(/^v\d+\.\d+$/)
    .optional()
    .allow(''),
});
