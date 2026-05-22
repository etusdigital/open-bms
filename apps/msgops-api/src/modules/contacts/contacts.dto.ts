import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
@JoiSchemaOptions({
  stripUnknown: true,
})
export class ContactDto {
  @JoiSchema(Joi.number().optional())
  id?: number;

  @JoiSchema(Joi.string().email().max(256).optional())
  email?: string;

  @JoiSchema(Joi.string().allow('').max(256).optional())
  firstName: string;

  @JoiSchema(Joi.string().allow('').max(256).optional())
  lastName?: string;

  @JoiSchema(Joi.string().optional())
  emailProvider?: string;

  @JoiSchema(Joi.string().optional())
  hashedEmail?: string;

  @JoiSchema(Joi.string().allow('').optional())
  phone?: string;

  // Pet's external integrations send `whatsapp` on the contact; column exists
  // on ContactEntity (`whatsapp varchar(255)`).
  @JoiSchema(Joi.string().allow('').max(255).optional())
  whatsapp?: string;

  // `isValid` ships as string `"true"` / `"false"` from some integrations.
  // Joi's default convert=true coerces those to booleans.
  @JoiSchema(Joi.boolean().optional())
  isValid?: boolean;

  @JoiSchema(Joi.string().allow('').optional())
  city: string;

  @JoiSchema(Joi.string().allow('').optional())
  region: string;

  @JoiSchema(Joi.string().allow('').optional())
  country: string;

  @JoiSchema(Joi.string().allow('').optional())
  postal: string;

  @JoiSchema(Joi.string().ip().optional())
  ip: string;

  @JoiSchema(Joi.string().optional())
  latitude: number;

  @JoiSchema(Joi.string().optional())
  longitude: number;

  @JoiSchema(Joi.string().optional())
  timezone: string;

  @JoiSchema(Joi.boolean().optional())
  isActive?: boolean;

  @JoiSchema(Joi.boolean().optional())
  isBlocked?: boolean;

  @JoiSchema(Joi.boolean().optional())
  isUnsubscribed?: boolean;

  @JoiSchema(Joi.boolean().optional())
  hasBounced?: boolean;

  @JoiSchema(Joi.boolean().optional())
  hasEmail?: boolean;

  @JoiSchema(Joi.boolean().optional())
  hasPhone?: boolean;

  @JoiSchema(Joi.boolean().optional())
  hasWebPush?: boolean;

  @JoiSchema(Joi.boolean().optional())
  hasMobilePush?: boolean;

  @JoiSchema(Joi.number().optional())
  lastOpen?: Date;

  @JoiSchema(Joi.number().optional())
  lastClick?: Date;

  @JoiSchema(Joi.number().optional())
  sendingLimit?: number;

  @JoiSchema(Joi.number().optional())
  lastSent?: Date;

  @JoiSchema(Joi.number().optional())
  lastAutomation?: Date;

  @JoiSchema(Joi.number().optional())
  score?: number;

  @JoiSchema(Joi.number().optional())
  scoreForecast?: number;

  @JoiSchema(Joi.date().optional())
  createdAt?: Date;

  @JoiSchema(Joi.date().optional())
  createdAtDate?: Date;

  @JoiSchema(Joi.date().optional())
  updatedAt?: Date;

  @JoiSchema(Joi.string().allow(null).optional())
  lastVerticalType?: string;

  // Optional tag names to assign on create/update. Resolved to tag ids
  // (account-scoped) and linked in the same transaction as the contact write.
  // Not a column — destructured out before the contact is persisted.
  // Two shapes accepted for back-compat:
  //   - `tagNames: string[]` — used by the React/Vue frontend.
  //   - `tagName: "x"`       — singular, used by Pet's external integrations.
  // Both are normalized to an array inside the service.
  @JoiSchema(Joi.array().items(Joi.string().trim().min(1).max(40)).max(50).optional())
  tagNames?: string[];

  @JoiSchema(Joi.string().trim().min(1).max(40).optional())
  tagName?: string;

  // Optional custom fields keyed by the custom_fields.name (case-insensitive on
  // resolve; the column is uppercased at @BeforeInsert). Persisted to
  // contacts_custom_fields in the same transaction as the contact write.
  // Values are coerced to string (varchar column).
  @JoiSchema(Joi.object().pattern(Joi.string().min(1).max(40), Joi.string().allow('').max(1024)).max(50).optional())
  customFields?: Record<string, string>;
}
