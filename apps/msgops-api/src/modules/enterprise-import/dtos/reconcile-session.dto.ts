import * as Joi from 'joi';
import { JoiSchema, JoiSchemaOptions } from 'nestjs-joi';

// Same ceiling as the stateless preview/apply DTOs (reconcile.dto.ts) — the
// CSV arrives once at session create and never travels again afterwards.
const CSV_MAX_BYTES = 50 * 1024 * 1024;

const resolutionSchema = Joi.object({
  contactId: Joi.number().integer().positive().required(),
  // null = explicit "skip / leave masked". Number = pick this CSV row.
  csvRowNumber: Joi.number().integer().positive().allow(null).required(),
});

@JoiSchemaOptions({ stripUnknown: true })
export class ReconcileSessionCreateDto {
  @JoiSchema(Joi.string().min(10).max(CSV_MAX_BYTES).required())
  csv: string;

  // Optional columns the operator deselected in the upload form (e.g.
  // `status`). Required columns are never ignorable — the service drops them
  // from this list defensively.
  @JoiSchema(Joi.array().items(Joi.string().max(100)).max(50).default([]))
  ignoreColumns: string[];
}

@JoiSchemaOptions({ stripUnknown: true })
export class ReconcileResolveBatchDto {
  // Bounded to a UI page — decisions apply immediately, so each call must
  // stay interactive.
  @JoiSchema(Joi.array().items(resolutionSchema).min(1).max(500).required())
  resolutions: Array<{ contactId: number; csvRowNumber: number | null }>;
}

@JoiSchemaOptions({ stripUnknown: true })
export class ReconcileApplyAutoDto {
  // Operator-tunable chunk: bigger = fewer round trips, smaller = more
  // granular progress. Each row is an individual repo.update (BeforeUpdate
  // listener), so the ceiling keeps a chunk comfortably under proxy timeouts.
  @JoiSchema(Joi.number().integer().min(100).max(20000).default(5000))
  limit: number;
}

@JoiSchemaOptions({ stripUnknown: true })
export class ReconcileBulkResolveDto {
  @JoiSchema(Joi.string().valid('best-name', 'skip-remaining').required())
  strategy: 'best-name' | 'skip-remaining';

  // best-name only: minimum score of the top candidate. 0.8 mirrors the
  // automatic tie-break; lower values trade precision for coverage under
  // explicit operator consent.
  @JoiSchema(Joi.number().min(0.1).max(1).default(0.5))
  threshold: number;

  @JoiSchema(Joi.number().integer().min(100).max(20000).default(5000))
  limit: number;

  // Pagination cursor from the previous call (items left pending are not
  // re-examined within one sweep).
  @JoiSchema(Joi.string().pattern(/^\d+$/).optional())
  afterId?: string;
}
