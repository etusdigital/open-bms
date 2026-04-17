import { createI18n } from 'vue-i18n';
import type { Messages } from './messages/messages.types';
import type { Locale } from './i18n.types';
import enUs from './messages/enUs';
import ptBr from './messages/ptBr';

export const defaultLocale: Locale = 'pt-BR';
export const i18n = createI18n<[Messages], Locale>({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'pt-BR',
  messages: {
    'en-US': enUs,
    'pt-BR': ptBr,
  },
});
