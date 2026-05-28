import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

@JoiSchemaOptions({ stripUnknown: true })
export class BmsLeadContactDto {
  @JoiSchema(Joi.string().email().max(256).required())
  email: string;

  @JoiSchema(Joi.string().allow('').max(256).optional())
  firstName?: string;

  @JoiSchema(Joi.string().allow('').max(256).optional())
  lastName?: string;
}

@JoiSchemaOptions({ stripUnknown: true })
export class BmsLeadDto {
  @JoiSchema(
    Joi.object({
      email: Joi.string().email().max(256).required(),
      firstName: Joi.string().allow('').max(256).optional(),
      lastName: Joi.string().allow('').max(256).optional(),
    }).required(),
  )
  contact: BmsLeadContactDto;

  // Authenticated by BmsLeadsAuthMiddleware (copied to x-api-key header
  // before PrincipalContextGuard). Required in the body for compatibility
  // with the evo-academy BMS pixel payload shape.
  @JoiSchema(Joi.string().required())
  apiKey: string;

  @JoiSchema(Joi.string().trim().min(1).max(40).required())
  tagName: string;
}
