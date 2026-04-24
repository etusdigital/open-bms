import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class LoginDto {
  @JoiSchema(Joi.string().email().required())
  email: string;

  @JoiSchema(Joi.string().min(8).required())
  password: string;
}
