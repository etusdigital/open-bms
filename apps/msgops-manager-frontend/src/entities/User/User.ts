import * as zod from 'zod';
import { toFormValidator } from '@vee-validate/zod';
import { i18n } from '../../i18n';

export const userEditZodValidation = toFormValidator(
  zod.object({
    email: zod
      .string()
      .min(1, i18n.global.t('required'))
      .email({ message: i18n.global.t('userPage.validEmail') }),
    name: zod.string().min(1, i18n.global.t('required')),
  }),
);

export const userCreateZodValidation = toFormValidator(
  zod.object({
    email: zod
      .string()
      .min(1, i18n.global.t('required'))
      .email({ message: i18n.global.t('userPage.validEmail') }),
    name: zod.string().min(1, i18n.global.t('required')),
    password: zod
      .string()
      .min(1, i18n.global.t('required'))
      .min(8, { message: i18n.global.t('userPage.tooShort') }),
  }),
);
