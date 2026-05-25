import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';
import { CreateAccountDto } from '../../accounts/dtos/create-account.dto';

const createAccountSchema = Joi.object({
  name: Joi.string().trim().required(),
  description: Joi.string().allow('', null).optional(),
  isActive: Joi.boolean().default(true).optional(),
  defaultDomain: Joi.string().allow('', null).optional(),
}).unknown(true);

// Pipeline step names eligible for selective (re-)import. Keep in sync with the
// worker pipeline (apps/enterprise-import). The worker expands the chosen set to
// include required parents; this just guards against unknown names.
export const IMPORT_STEPS = [
  'tags',
  'custom-fields',
  'labels',
  'email-templates',
  'contacts',
  'contact_tags',
  'contact_custom_fields',
  'automations',
  'campaigns',
  'messages',
] as const;

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

  // Selective (re-)import: only these steps run (parents auto-included by the
  // worker). Absent/empty = full pipeline.
  @JoiSchema(
    Joi.array()
      .items(Joi.string().valid(...IMPORT_STEPS))
      .min(1)
      .optional(),
  )
  selectedSteps?: string[];
}

@JoiSchemaOptions({ stripUnknown: true })
export class ResumeImportDto {
  @JoiSchema(Joi.string().min(8).optional())
  enterpriseApiKey?: string;
}
