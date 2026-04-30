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
}
