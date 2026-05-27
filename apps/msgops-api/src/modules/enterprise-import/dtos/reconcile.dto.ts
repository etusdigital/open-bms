import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

const CSV_MAX_BYTES = 12 * 1024 * 1024; // 12MB — comfortably above 30k+ contact rows.

const resolutionSchema = Joi.object({
  contactId: Joi.number().integer().positive().required(),
  // null = explicit "skip / leave masked". Number = pick this CSV row.
  csvRowNumber: Joi.number().integer().positive().allow(null).required(),
});

@JoiSchemaOptions({ stripUnknown: true })
export class ReconcilePreviewDto {
  // Raw CSV text (header row + data rows). The BMS Enterprise export comes
  // already-parseable; the operator drops it here unchanged.
  @JoiSchema(Joi.string().min(10).max(CSV_MAX_BYTES).required())
  csv: string;
}

@JoiSchemaOptions({ stripUnknown: true })
export class ReconcileApplyDto {
  @JoiSchema(Joi.string().min(10).max(CSV_MAX_BYTES).required())
  csv: string;

  // Operator's manual picks for ambiguous matches (one CSV mask → multiple
  // raw emails) and explicit skips. Anything absent from this list falls
  // back to the auto-pick rules used in preview.
  @JoiSchema(Joi.array().items(resolutionSchema).default([]))
  resolutions: Array<{ contactId: number; csvRowNumber: number | null }>;
}
