import type ptBR from '@/locales/pt-BR.json';
import type { defaultNS } from './i18n';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: {
      translation: typeof ptBR;
    };
  }
}
