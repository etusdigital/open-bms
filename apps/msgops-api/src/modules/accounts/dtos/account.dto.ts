import { PageDto } from '../../../dtos/filters/page.dto';
import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class AccountDto extends PageDto {
  @JoiSchema(Joi.number().optional())
  id?: number;

  @JoiSchema(Joi.string().allow(null).optional())
  name?: string;

  @JoiSchema(Joi.string().allow('', null).optional())
  description?: string;

  @JoiSchema(Joi.allow(null).optional())
  accountConfigs?: any;

  @JoiSchema(Joi.allow(null).optional())
  customFields?: any;

  @JoiSchema(Joi.allow(null).optional())
  userAccount?: any;

  @JoiSchema(Joi.date().allow(null).optional())
  createdAt?: Date;

  @JoiSchema(Joi.date().allow(null).optional())
  updatedAt?: Date;

  @JoiSchema(Joi.date().allow(null).optional())
  deletedAt?: Date;
}
