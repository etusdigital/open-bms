import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

export class Step1Data {
  name: string;
  email: string;
  password: string;
}

export class Step2Data {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export class Step3Data {
  baseUrl: string;
}

export class Step4Data {
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
    .email({ tlds: { allow: false } })
    .required(),
  password: Joi.string().min(8).required(),
});

export const step2Schema = Joi.object<Step2Data>({
  host: Joi.string().trim().min(1).required(),
  port: Joi.number().integer().min(1).max(65535).required(),
  user: Joi.string().trim().min(1).required(),
  pass: Joi.string().min(1).required(),
  from: Joi.string()
    .email({ tlds: { allow: false } })
    .required(),
});

export const step3Schema = Joi.object<Step3Data>({
  baseUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
});

export const step4Schema = Joi.object<Step4Data>({
  skip: Joi.boolean().optional(),
  accountName: Joi.string().trim().min(1).optional(),
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
}).or('skip', 'accountName'); // at least one: skip=true or full config

export const STEP_SCHEMAS = { 1: step1Schema, 2: step2Schema, 3: step3Schema, 4: step4Schema } as const;

export class AdvanceStepDto {
  @JoiSchema(Joi.number().valid(1, 2, 3, 4).required())
  step: 1 | 2 | 3 | 4;

  @JoiSchema(Joi.object().required())
  data: Step1Data | Step2Data | Step3Data | Step4Data;
}
