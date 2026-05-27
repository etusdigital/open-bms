import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class Auth0Dto {
  @JoiSchema(Joi.string().required())
  name: string;

  @JoiSchema(Joi.string().required())
  email: string;

  @JoiSchema(Joi.string().required())
  picture: string;
}
