import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

// Account-scope only: creates a new OSS account and imports the Enterprise
// account's data into it (does not require a virgin DB). Instance-scope
// migration is not done by the wizard. Cross-field validation (skip vs
// baseUrl/apiKey) is in the service.
@JoiSchemaOptions({ stripUnknown: true })
export class ImportEnterpriseSetupDto {
  @JoiSchema(Joi.boolean().optional())
  skip?: boolean;

  @JoiSchema(
    Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .optional(),
  )
  baseUrl?: string;

  @JoiSchema(Joi.string().min(8).optional())
  apiKey?: string;

  // Name of the OSS account to create for the imported data. Ignored when
  // useStep1Account=true (imports into the account created in step 1).
  @JoiSchema(Joi.string().trim().min(1).max(255).optional())
  accountName?: string;

  // Import into the account created in wizard step 1 instead of a new
  // throwaway account. The account id is resolved server-side from the
  // wizard admin; the client never supplies accountId.
  @JoiSchema(Joi.boolean().optional())
  useStep1Account?: boolean;

  // Source account id in Enterprise. Optional: without it the statistics
  // rollup is skipped (the source account cannot be resolved).
  @JoiSchema(Joi.number().integer().positive().optional())
  enterpriseSourceAccountId?: number;
}
