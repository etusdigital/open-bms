import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { MANDRILL_API_KEY_MIN_LENGTH } from '../../admin-integrations/mandrill/dtos/mandrill-system-settings.dto';

export class SaveAccountMandrillDto {
  @JoiSchema(Joi.string().trim().min(MANDRILL_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}

export class TestAccountMandrillDto {
  @JoiSchema(Joi.string().trim().min(MANDRILL_API_KEY_MIN_LENGTH).required())
  apiKey: string;
}
