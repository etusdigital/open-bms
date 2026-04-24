import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class TestSmtpDto {
  @JoiSchema(Joi.string().trim().min(1).required())
  host: string;

  @JoiSchema(Joi.number().integer().min(1).max(65535).required())
  port: number;

  @JoiSchema(Joi.string().trim().min(1).required())
  user: string;

  @JoiSchema(Joi.string().min(1).required())
  pass: string;

  @JoiSchema(
    Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
  )
  from: string;

  @JoiSchema(
    Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
  )
  toEmail: string;
}
