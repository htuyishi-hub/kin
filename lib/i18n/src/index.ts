import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import rw from './locales/rw.json';

export type SupportedLanguage = 'en' | 'rw';
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'rw'];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const resources = {
  en: { translation: en },
  rw: { translation: rw },
} as const;

export function initI18n(initialLang: SupportedLanguage = DEFAULT_LANGUAGE) {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: initialLang,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
  } else if (i18n.language !== initialLang) {
    i18n.changeLanguage(initialLang);
  }
  return i18n;
}

// Auto-initialize with default language
initI18n(DEFAULT_LANGUAGE);

export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  if (SUPPORTED_LANGUAGES.includes(lang)) {
    await i18n.changeLanguage(lang);
  }
}

export function getCurrentLanguage(): SupportedLanguage {
  const current = (i18n.language || DEFAULT_LANGUAGE).slice(0, 2) as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(current) ? current : DEFAULT_LANGUAGE;
}

export const t = (key: string, options?: Record<string, any>): string => {
  return String(options ? i18n.t(key, options) : i18n.t(key));
};

export { i18n };
export { useTranslation } from 'react-i18next';
export { en, rw };
