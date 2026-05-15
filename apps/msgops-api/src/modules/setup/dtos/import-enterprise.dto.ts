import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

// Passo do wizard. Aceita `skip:true` OU `{baseUrl, apiKey, accountName?}`.
// É ACCOUNT-SCOPE: cria uma conta nova no OSS e importa os dados da conta
// Enterprise nela (async-safe, não exige DB virgem). instance-scope (migração
// de instância inteira, preserva IDs) NÃO é feito pelo wizard — vide
// docs/operations/enterprise-import-testing.md (procedimento separado em DB
// virgem). Validação cross-field (skip vs baseUrl/apiKey) fica no service.
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

  // Nome da conta a ser criada no OSS para receber os dados importados.
  @JoiSchema(Joi.string().trim().min(1).max(255).optional())
  accountName?: string;

  // ID da conta no Enterprise (origem). Opcional: sem ele o rollup de
  // statistics é pulado (não há como resolver a conta de origem).
  @JoiSchema(Joi.number().integer().positive().optional())
  enterpriseSourceAccountId?: number;
}
