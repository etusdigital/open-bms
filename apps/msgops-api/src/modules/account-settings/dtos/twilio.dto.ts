import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

// Twilio Account SID always starts with "AC" + 32 hex chars. The API Key SID
// (used for sending) starts with "SK". Auth Token is a 32-char hex string.
export const TWILIO_ACCOUNT_SID_PATTERN = /^AC[0-9a-fA-F]{32}$/;
export const TWILIO_API_KEY_SID_PATTERN = /^SK[0-9a-fA-F]{32}$/;
export const TWILIO_SECRET_MIN_LENGTH = 16;
export const TWILIO_AUTH_TOKEN_MIN_LENGTH = 16;
// Messaging Service SID starts with "MG" + 32 hex chars.
export const TWILIO_MESSAGING_SERVICE_PATTERN = /^MG[0-9a-fA-F]{32}$/;

export class SaveAccountTwilioDto {
  // → twilio_sid_account
  @JoiSchema(Joi.string().trim().pattern(TWILIO_ACCOUNT_SID_PATTERN, 'AC-prefixed Account SID').required())
  accountSid: string;

  // → twilio_sid (API Key SID, used by the sending worker)
  @JoiSchema(Joi.string().trim().pattern(TWILIO_API_KEY_SID_PATTERN, 'SK-prefixed API Key SID').required())
  apiSid: string;

  // → twilio_secret (API Key secret)
  @JoiSchema(Joi.string().trim().min(TWILIO_SECRET_MIN_LENGTH).required())
  apiSecret: string;

  // → twilio_auth_account (Account Auth Token). Required when WhatsApp is used:
  // template approval/creation (messages.service.ts → twilio.handler) auths with
  // Basic accountSid:authToken — distinct from the API-Key send credentials.
  @JoiSchema(Joi.string().trim().min(TWILIO_AUTH_TOKEN_MIN_LENGTH).when('whatsappServiceSid', { is: Joi.exist(), then: Joi.required(), otherwise: Joi.optional() }))
  authToken?: string;

  // → twilio_sms_service (Messaging Service SID for SMS)
  @JoiSchema(Joi.string().trim().pattern(TWILIO_MESSAGING_SERVICE_PATTERN, 'MG-prefixed Messaging Service SID').optional())
  smsServiceSid?: string;

  // → twilio_whatsapp_service (Messaging Service SID for WhatsApp)
  @JoiSchema(Joi.string().trim().pattern(TWILIO_MESSAGING_SERVICE_PATTERN, 'MG-prefixed Messaging Service SID').optional())
  whatsappServiceSid?: string;
}

export class TestAccountTwilioDto {
  @JoiSchema(Joi.string().trim().pattern(TWILIO_ACCOUNT_SID_PATTERN, 'AC-prefixed Account SID').required())
  accountSid: string;

  @JoiSchema(Joi.string().trim().pattern(TWILIO_API_KEY_SID_PATTERN, 'SK-prefixed API Key SID').required())
  apiSid: string;

  @JoiSchema(Joi.string().trim().min(TWILIO_SECRET_MIN_LENGTH).required())
  apiSecret: string;
}
