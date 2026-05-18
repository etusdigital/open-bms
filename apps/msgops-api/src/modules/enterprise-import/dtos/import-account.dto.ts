import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import { CreateAccountDto } from '../../accounts/dtos/create-account.dto';

const createAccountSchema = Joi.object({
  name: Joi.string().trim().required(),
  description: Joi.string().allow('', null).optional(),
  isActive: Joi.boolean().default(true).optional(),
  isInternal: Joi.boolean().default(false).optional(),
  defaultDomain: Joi.string().allow('', null).optional(),
}).unknown(true);

@JoiSchemaOptions({ stripUnknown: true })
export class ImportAccountDto {
  @JoiSchema(createAccountSchema.required())
  accountData: CreateAccountDto;

  @JoiSchema(
    Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .required(),
  )
  enterpriseBaseUrl: string;

  @JoiSchema(Joi.string().min(8).required())
  enterpriseApiKey: string;

  // Source account ID on Enterprise. Optional: if absent, the import runs but
  // the statistics rollup is skipped (no way to resolve the source account).
  @JoiSchema(Joi.number().integer().positive().optional())
  enterpriseSourceAccountId?: number;
}

@JoiSchemaOptions({ stripUnknown: true })
export class ResumeImportDto {
  @JoiSchema(Joi.string().min(8).optional())
  enterpriseApiKey?: string;
}
