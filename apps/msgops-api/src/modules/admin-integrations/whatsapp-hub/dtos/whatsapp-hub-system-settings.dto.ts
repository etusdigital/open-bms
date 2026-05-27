import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

/**
 * Wave 7.8 — EvoHub credentials (turnkey WhatsApp Cloud mode).
 *
 * Persisted under WHATSAPP_HUB_KEY in `system_config`. Includes the master
 * `enabled` toggle that the WhatsappModeResolverService reads at runtime;
 * flipping it from this UI requires a process restart of msgops-api so the
 * env file overlay takes effect (same constraint as SendGrid / Mandrill).
 */
export class WhatsappHubSystemSettingsDto {
  @JoiSchema(Joi.boolean().optional())
  enabled?: boolean;

  @JoiSchema(Joi.string().uri().optional().allow(''))
  url?: string;

  @JoiSchema(Joi.string().trim().optional().allow(''))
  apiKey?: string;

  @JoiSchema(Joi.string().trim().optional().allow(''))
  webhookSecret?: string;
}

export const whatsappHubSystemSettingsSaveSchema = Joi.object<WhatsappHubSystemSettingsDto>({
  enabled: Joi.boolean().required(),
  url: Joi.string().uri().required(),
  apiKey: Joi.when('enabled', {
    is: true,
    then: Joi.string().trim().min(8).required(),
    otherwise: Joi.string().trim().optional().allow(''),
  }),
  webhookSecret: Joi.when('enabled', {
    is: true,
    then: Joi.string().trim().min(16).required(),
    otherwise: Joi.string().trim().optional().allow(''),
  }),
});
