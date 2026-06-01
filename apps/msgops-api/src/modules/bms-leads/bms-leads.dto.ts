import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({ stripUnknown: true })
export class BmsLeadContactDto {
  @JoiSchema(Joi.string().email().max(256).required())
  email: string;

  @JoiSchema(Joi.string().allow('').max(256).optional())
  firstName?: string;

  @JoiSchema(Joi.string().allow('').max(256).optional())
  lastName?: string;

  // phone is enough on its own — ContactEntity @BeforeInsert mirrors it into
  // `whatsapp` when whatsapp is empty, so send-whatsapp picks it up. Accept
  // whatsapp explicitly too for callers that already split the columns.
  @JoiSchema(Joi.string().allow('').max(64).optional())
  phone?: string;

  @JoiSchema(Joi.string().allow('').max(64).optional())
  whatsapp?: string;
}

@JoiSchemaOptions({ stripUnknown: true })
export class BmsLeadDto {
  @JoiSchema(
    Joi.object({
      email: Joi.string().email().max(256).required(),
      firstName: Joi.string().allow('').max(256).optional(),
      lastName: Joi.string().allow('').max(256).optional(),
      phone: Joi.string().allow('').max(64).optional(),
      whatsapp: Joi.string().allow('').max(64).optional(),
    }).required(),
  )
  contact: BmsLeadContactDto;

  // Authenticated by BmsLeadsAuthMiddleware (copied to x-api-key header
  // before PrincipalContextGuard). Required in the body for compatibility
  // with the evo-academy BMS pixel payload shape.
  @JoiSchema(Joi.string().required())
  apiKey: string;

  @JoiSchema(Joi.string().trim().min(1).max(40).required())
  tagName: string;
}

// Payload from web-push.js sendTokenToServer(). The contact may be anonymous
// (no email) — only the device token is required. apiKey arrives in the body and
// is moved to x-api-key by BmsLeadsAuthMiddleware.
@JoiSchemaOptions({ stripUnknown: true })
export class WebPushSubscriptionDto {
  @JoiSchema(
    Joi.object({
      email: Joi.string().email().max(256).optional(),
      uuid: Joi.string().max(64).optional(),
      devices: Joi.array()
        .items(
          Joi.object({
            token: Joi.string().min(1).max(512).required(),
            type: Joi.string().max(40).optional(),
            os: Joi.string().allow('').max(60).optional(),
            browser: Joi.string().allow('').max(50).optional(),
            browserVersion: Joi.string().allow('').max(50).optional(),
            deviceType: Joi.string().allow('').max(60).optional(),
            resolution: Joi.string().allow('').max(50).optional(),
            subscriptionUrl: Joi.string().allow('').max(400).optional(),
          }),
        )
        .min(1)
        .required(),
    }).required(),
  )
  contact: {
    email?: string;
    uuid?: string;
    devices: Array<{ token: string; type?: string; os?: string; browser?: string; browserVersion?: string; deviceType?: string; resolution?: string; subscriptionUrl?: string }>;
  };

  @JoiSchema(Joi.string().required())
  apiKey: string;

  @JoiSchema(Joi.string().optional())
  type?: string;
}

// bmstrk.js POSTs {data: base64(JSON(...))} to /c and /bms/cs. The api key is in
// the `api-key` header (resolved by the normal guard), so it's not in the body.
@JoiSchemaOptions({ stripUnknown: true })
export class BmsTrackerDataDto {
  @JoiSchema(Joi.string().required())
  data: string;
}

// bmstrk.js trkEvent() POSTs this to /bms/leads/update (mode:'no-cors', so the
// client never reads the response — only the write matters).
@JoiSchemaOptions({ stripUnknown: true })
export class BmsLeadUpdateDto {
  @JoiSchema(
    Joi.object({
      uuid: Joi.string().max(64).required(),
      customFields: Joi.object().unknown(true).optional(),
    }).required(),
  )
  contact: { uuid: string; customFields?: Record<string, unknown> };

  @JoiSchema(Joi.string().allow('').max(40).optional())
  tagName?: string;

  @JoiSchema(Joi.string().required())
  apiKey: string;
}
