import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

// SparkPost API keys are 40-char alphanumeric (no fixed prefix). No
// admin-integrations module exists for SparkPost yet, so the constant
// lives here. If a system-wide module is added in V3+, this constant
// should move to admin-integrations/sparkpost/dtos and be imported.
export const SPARKPOST_API_KEY_MIN_LENGTH = 30;

export class SaveAccountSparkpostDto {
  @JoiSchema(Joi.string().trim().min(SPARKPOST_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}

export class TestAccountSparkpostDto {
  @JoiSchema(Joi.string().trim().min(SPARKPOST_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}
