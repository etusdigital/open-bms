import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

// Centralized SendGrid API key constraints. Shared between step4Schema and TestSendgridDto
// so a future format change (length, prefix) edits one place instead of three.
export const SENDGRID_API_KEY_PREFIX = 'SG.';
export const SENDGRID_API_KEY_PATTERN = /^SG\./;
export const SENDGRID_API_KEY_MIN_LENGTH = 10;

export class Step1Data {
  name: string;
  email: string;
  password: string;
}

export class Step2Data {
  skip?: boolean;
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
}

export class Step3Data {
  baseUrl: string;
}

export class Step4Data {
  skip?: boolean;
}

export class Step5Data {
  skip?: boolean;
  accountName?: string;
  poolName?: string;
  senderEmail?: string;
  senderName?: string;
  replyToEmail?: string;
  sendingLimit?: number;
  ips?: string[];
}

// Explicit Joi schemas per step, used by SetupService.advanceStep since
// JoiPipe + class-based @JoiSchema cannot discriminate `data` by `step`.
export const step1Schema = Joi.object<Step1Data>({
  name: Joi.string().trim().min(1).required(),
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .required(),
  password: Joi.string().min(8).required(),
});

// SMTP step is optional in the React wizard — accept either { skip: true } or
// the full payload. Mirrors the discriminated pattern used by step4/step5.
export const step2Schema = Joi.alternatives<Step2Data>().try(
  Joi.object({ skip: Joi.valid(true).required() }),
  Joi.object({
    skip: Joi.valid(false).optional(),
    host: Joi.string().trim().min(1).required(),
    port: Joi.number().integer().min(1).max(65535).required(),
    user: Joi.string().trim().min(1).required(),
    pass: Joi.string().min(1).required(),
    from: Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
  }),
);

export const step3Schema = Joi.object<Step3Data>({
  baseUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
});

// SendGrid moved out of the wizard — it's now configured in /settings (super_admin)
// post-setup. This step is auto-skipped by the React frontend; only `{skip:true}`
// is accepted. Legacy clients sending the old payload now get a 400.
export const step4Schema = Joi.object<Step4Data>({
  skip: Joi.valid(true).required(),
});

// Same discriminated pattern as step4: either skip=true alone, or a full config payload
// with skip omitted/false. `match: 'one'` makes ambiguous payloads (skip=true + accountName)
// fail validation instead of silently ignoring extra fields.
export const step5Schema = Joi.alternatives<Step5Data>().try(
  Joi.object({ skip: Joi.valid(true).required() }),
  Joi.object({
    skip: Joi.valid(false).optional(),
    accountName: Joi.string().trim().min(1).required(),
    poolName: Joi.string().trim().min(1).optional(),
    senderEmail: Joi.string()
      .email({ tlds: { allow: false } })
      .optional(),
    senderName: Joi.string().trim().min(1).optional(),
    replyToEmail: Joi.string()
      .email({ tlds: { allow: false } })
      .optional(),
    sendingLimit: Joi.number().integer().min(1).optional(),
    ips: Joi.array()
      .items(Joi.string().ip({ version: ['ipv4', 'ipv6'] }))
      .optional(),
  }),
);

export class Step6Data {
  skip?: boolean;
  skipReason?: string;
}

export const step6Schema = Joi.alternatives<Step6Data>().try(
  Joi.object({ skip: Joi.valid(true).required() }),
  Joi.object({ skip: Joi.valid(false).optional(), skipReason: Joi.string().trim().max(500).optional() }),
);

export const STEP_SCHEMAS = { 1: step1Schema, 2: step2Schema, 3: step3Schema, 4: step4Schema, 5: step5Schema, 6: step6Schema } as const;

export class AdvanceStepDto {
  @JoiSchema(Joi.number().valid(1, 2, 3, 4, 5, 6).required())
  step: 1 | 2 | 3 | 4 | 5 | 6;

  @JoiSchema(Joi.object().required())
  data: Step1Data | Step2Data | Step3Data | Step4Data | Step5Data | Step6Data;
}
