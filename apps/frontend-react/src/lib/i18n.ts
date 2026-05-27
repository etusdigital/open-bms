import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptBR from '@/locales/pt-BR.json';
import enUS from '@/locales/en-US.json';
import esES from '@/locales/es-ES.json';

export const defaultNS = 'translation';
export const supportedLngs = ['pt-BR', 'en-US', 'es-ES'] as const;
export const LANGUAGE_STORAGE_KEY = 'bms-language';

function getSavedLanguage(): string {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && supportedLngs.includes(saved as any)) return saved;
  } catch {
    /* SSR or private browsing */
  }
  return 'pt-BR';
}

export function saveLanguage(lng: string) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
}

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    'en-US': { translation: enUS },
    'es-ES': { translation: esES },
  },
  lng: getSavedLanguage(),
  fallbackLng: 'pt-BR',
  supportedLngs: [...supportedLngs],
  defaultNS,
  interpolation: {
    escapeValue: false,
  },
});

// Persist language changes
i18n.on('languageChanged', saveLanguage);

export default i18n;
