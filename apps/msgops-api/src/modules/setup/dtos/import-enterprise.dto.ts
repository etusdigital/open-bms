import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

// Discriminated por presença do campo `skip`. Joi não aceita union direto via
// nestjs-joi, então validamos cross-field no service. DTO aceita ambos shapes.
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
}
