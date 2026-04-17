import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class UpdateProfileDto {
  @JoiSchema(Joi.string().optional())
  name?: string;

  @JoiSchema(Joi.string().email().optional())
  email?: string;

  @JoiSchema(Joi.string().uri().allow('', null).optional())
  profile?: string;

  @JoiSchema(Joi.object().optional())
  settings?: Record<string, string>;
}
