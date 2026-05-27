import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class CreateAccountDto {
  @JoiSchema(Joi.number().optional())
  id?: number;

  @JoiSchema(Joi.string().trim().required())
  name: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @JoiSchema(Joi.boolean().default(true).optional())
  isActive?: boolean;

  @JoiSchema(Joi.array().allow(null).optional())
  customFields?: object[];

  @JoiSchema(Joi.array().allow(null).optional())
  accountConfigs?: object[];

  @JoiSchema(Joi.date().optional())
  createdAt?: Date;

  @JoiSchema(Joi.date().allow(null).optional())
  updatedAt?: Date;

  @JoiSchema(Joi.date().allow(null).optional())
  deletedAt?: Date;

  @JoiSchema(Joi.string().allow(null, '').optional())
  defaultDomain?: string;
}
