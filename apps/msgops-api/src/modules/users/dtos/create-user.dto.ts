import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { PageDto } from '../../../dtos/filters/page.dto';
import { Accounts } from './permission-accounts.dto';

export class CreateUserDto extends PageDto {
  @JoiSchema(Joi.number().optional())
  id?: number;

  @JoiSchema(Joi.string().optional())
  name?: string;

  @JoiSchema(Joi.string().optional())
  email?: string;

  @JoiSchema(Joi.string().optional())
  password?: string;

  @JoiSchema(Joi.string().optional())
  profile?: string;

  @JoiSchema(Joi.array().allow(null).optional())
  accounts?: Accounts[];

  @JoiSchema(Joi.string().optional())
  providerId?: string;

  @JoiSchema(Joi.object().optional())
  settings?: Record<string, string>;

  @JoiSchema(Joi.string().optional())
  globalRoleCode?: string;

  @JoiSchema(Joi.date().optional())
  createdAt?: Date;

  @JoiSchema(Joi.date().allow(null).optional())
  updatedAt?: Date;

  @JoiSchema(Joi.date().allow(null).optional())
  deletedAt?: Date;
}
