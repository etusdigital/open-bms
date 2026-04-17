import * as zod from 'zod';
import { toFormValidator } from '@vee-validate/zod';
import { i18n } from '../../i18n';

export const accountCreateZodValidation = toFormValidator(
  zod.object({
    name: zod.string().min(1, i18n.global.t('required')),
    description: zod.string().optional(),
    isActive: zod.boolean().default(true),
    createSendgridAccount: zod.boolean().optional().default(false),
    linkBranding: zod.string().optional(),
    defaultDomain: zod.string().optional(),
    unsubscribeRedirectUrl: zod.string().optional(),
    sendgridIps: zod.string().array().optional(),
    sendgridUser: zod.string().optional(),
    accountConfigs: zod
      .object({
        name: zod.string().optional(),
        value: zod
          .object({
            isActive: zod.boolean().default(false).optional(),
            validateEmails: zod.boolean().optional(),
          })
          .or(zod.string())
          .optional(),
      })
      .array()
      .optional(),
  }),
);

export const accountEditZodValidation = accountCreateZodValidation;
