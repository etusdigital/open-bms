import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { AWS_ACCESS_KEY_MIN_LENGTH, AWS_ACCESS_KEY_PATTERN, AWS_SECRET_KEY_MIN_LENGTH, SES_REGIONS } from '../../admin-integrations/amazon-ses/dtos/ses-system-settings.dto';

export class SaveAccountSesDto {
  @JoiSchema(Joi.string().trim().pattern(AWS_ACCESS_KEY_PATTERN, 'AKIA/ASIA-prefixed').min(AWS_ACCESS_KEY_MIN_LENGTH).required())
  accessKeyId: string;

  @JoiSchema(Joi.string().trim().min(AWS_SECRET_KEY_MIN_LENGTH).required())
  secretAccessKey: string;

  @JoiSchema(
    Joi.string()
      .valid(...SES_REGIONS)
      .required(),
  )
  region: string;
}

export class TestAccountSesDto {
  @JoiSchema(Joi.string().trim().pattern(AWS_ACCESS_KEY_PATTERN, 'AKIA/ASIA-prefixed').min(AWS_ACCESS_KEY_MIN_LENGTH).required())
  accessKeyId: string;

  @JoiSchema(Joi.string().trim().min(AWS_SECRET_KEY_MIN_LENGTH).required())
  secretAccessKey: string;

  @JoiSchema(
    Joi.string()
      .valid(...SES_REGIONS)
      .required(),
  )
  region: string;
}
