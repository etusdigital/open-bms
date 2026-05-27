import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

/**
 * Wave 4 — POST /accounts/:accountId/whatsapp-channels
 *
 * Discriminated by `mode`:
 *   - mode='meta'   → admin completed FB.login, sends { code, phone_number_id,
 *                     waba_id, business_id }. Service does the code→access_token
 *                     exchange.
 *   - mode='evohub' → only `name` is needed. Service calls the Hub to create
 *                     the channel and returns { public_link } so the frontend
 *                     can open the Embedded Signup hosted by the Hub.
 *
 * Joi schema accepts both shapes via Joi.alternatives so the controller can
 * keep a single endpoint.
 */
export class CreateWhatsappChannelDto {
  @JoiSchema(Joi.string().trim().min(1).max(255).required())
  name: string;

  @JoiSchema(Joi.string().valid('meta', 'evohub').required())
  mode: 'meta' | 'evohub';

  // Meta-mode fields (required when mode === 'meta')
  @JoiSchema(Joi.string().trim().optional())
  code?: string;

  @JoiSchema(Joi.string().trim().optional())
  phone_number_id?: string;

  @JoiSchema(Joi.string().trim().optional())
  waba_id?: string;

  @JoiSchema(Joi.string().trim().optional())
  business_id?: string;
}

// Cross-field validation: enforce required Meta fields when mode='meta'.
export const createChannelSchema = Joi.alternatives().try(
  Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    mode: Joi.string().valid('meta').required(),
    code: Joi.string().trim().required(),
    phone_number_id: Joi.string().trim().required(),
    waba_id: Joi.string().trim().required(),
    business_id: Joi.string().trim().optional(),
  }),
  Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    mode: Joi.string().valid('evohub').required(),
  }),
);
