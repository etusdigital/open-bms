import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({
  stripUnknown: true,
})
export class AuditDto {
  @JoiSchema(Joi.number().optional())
  id?: number;

  @JoiSchema(Joi.string().optional())
  entity?: string;

  @JoiSchema(Joi.number().optional())
  entityId?: number;

  @JoiSchema(Joi.string().optional())
  oldValues?: string;

  @JoiSchema(Joi.string().optional())
  newValues?: string;

  @JoiSchema(Joi.string().optional())
  user?: string;

  @JoiSchema(Joi.string().optional())
  ipAddress?: string;

  @JoiSchema(Joi.date().optional())
  createdAt?: Date;

  @JoiSchema(Joi.date().optional())
  updatedAt?: Date;
}
