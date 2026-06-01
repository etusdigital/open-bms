import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

// A Firebase service account JSON must carry at least these fields. We validate
// shape (not just non-empty) so a malformed paste is rejected before it reaches
// the push worker (which would otherwise fail silently at send time).
export const FIREBASE_REQUIRED_FIELDS = ['project_id', 'private_key', 'client_email'] as const;

// Joi custom validator: parses the JSON string and asserts the required fields.
const firebaseServiceAccountSchema = Joi.string()
  .trim()
  .required()
  .custom((value: string, helpers) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(value);
    } catch {
      return helpers.error('any.invalid');
    }
    for (const field of FIREBASE_REQUIRED_FIELDS) {
      if (!parsed[field] || typeof parsed[field] !== 'string') {
        return helpers.error('any.invalid');
      }
    }
    return value;
  }, 'firebase-service-account-json')
  .messages({ 'any.invalid': 'JSON do service account inválido (campos project_id/private_key/client_email obrigatórios).' });

export class SaveAccountPushDto {
  // → firebase_service_account_app (shared by mobile-push AND web-push)
  @JoiSchema(firebaseServiceAccountSchema)
  firebaseServiceAccount: string;
}

export class TestAccountPushDto {
  @JoiSchema(firebaseServiceAccountSchema)
  firebaseServiceAccount: string;
}
