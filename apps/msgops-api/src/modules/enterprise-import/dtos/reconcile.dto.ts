import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

// 50MB of CSV text — real Enterprise exports reach hundreds of thousands of
// contacts (350k ≈ 20MB). Must stay under the 64mb body-parser limit on the
// /imports routes (main.ts) and match MAX_CSV_FILE_MB in the frontend's
// reconcile-emails-card.tsx, which pre-checks the file before uploading.
const CSV_MAX_BYTES = 50 * 1024 * 1024;

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
