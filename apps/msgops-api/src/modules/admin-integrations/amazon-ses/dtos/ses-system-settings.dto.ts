import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

// AWS Access Key IDs are 20-char alpha-numeric, prefixed AKIA (long-term)
// or ASIA (temporary). We accept both — many production setups use STS-issued
// temporary credentials so locking to AKIA would lock real deployments out.
export const AWS_ACCESS_KEY_PATTERN = /^(AKIA|ASIA)[A-Z0-9]{16}$/;
export const AWS_ACCESS_KEY_MIN_LENGTH = 20;
// Secret access keys are 40 chars base64-ish.
export const AWS_SECRET_KEY_MIN_LENGTH = 40;

// SES is GA in these regions (verified 2026-05). Refusing other regions
// avoids silent typos that would 404 at send-time. Update list as AWS
// expands SES coverage.
export const SES_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'sa-east-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'eu-south-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ca-central-1',
  'me-south-1',
] as const;

export class SesSystemSettingsDto {
  @JoiSchema(Joi.string().trim().pattern(AWS_ACCESS_KEY_PATTERN, 'AKIA/ASIA-prefixed').optional())
  accessKeyId?: string;

  @JoiSchema(Joi.string().trim().min(AWS_SECRET_KEY_MIN_LENGTH).optional())
  secretAccessKey?: string;

  @JoiSchema(
    Joi.string()
      .valid(...SES_REGIONS)
      .optional(),
  )
  region?: string;

  @JoiSchema(
    Joi.string()
      .trim()
      .pattern(/^arn:aws(-[a-z]+)?:sns:/, 'arn:aws:sns:...')
      .optional()
      .allow(''),
  )
  webhookSnsTopicArn?: string;
}

export const sesSystemSettingsSaveSchema = Joi.object<SesSystemSettingsDto>({
  accessKeyId: Joi.string().trim().pattern(AWS_ACCESS_KEY_PATTERN, 'AKIA/ASIA-prefixed').required(),
  secretAccessKey: Joi.string().trim().min(AWS_SECRET_KEY_MIN_LENGTH).required(),
  region: Joi.string()
    .valid(...SES_REGIONS)
    .required(),
  webhookSnsTopicArn: Joi.string()
    .trim()
    .pattern(/^arn:aws(-[a-z]+)?:sns:/, 'arn:aws:sns:...')
    .optional()
    .allow(''),
});

export class SesTestConnectionDto {
  @JoiSchema(Joi.string().trim().pattern(AWS_ACCESS_KEY_PATTERN, 'AKIA/ASIA-prefixed').optional())
  accessKeyId?: string;

  @JoiSchema(Joi.string().trim().min(AWS_SECRET_KEY_MIN_LENGTH).optional())
  secretAccessKey?: string;

  @JoiSchema(
    Joi.string()
      .valid(...SES_REGIONS)
      .optional(),
  )
  region?: string;
}

export const sesTestConnectionSchema = Joi.object<SesTestConnectionDto>({
  accessKeyId: Joi.string().trim().pattern(AWS_ACCESS_KEY_PATTERN, 'AKIA/ASIA-prefixed').optional(),
  secretAccessKey: Joi.string().trim().min(AWS_SECRET_KEY_MIN_LENGTH).optional(),
  region: Joi.string()
    .valid(...SES_REGIONS)
    .optional(),
});
