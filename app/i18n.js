import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import enTranslations from './locales/en.json';
import bgTranslations from './locales/bg.json';

const resources = {
  en: {
    translation: enTranslations
  },
  bg: {
    translation: bgTranslations
  }
};

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',

    // Language detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
      // Convert detected language to our supported languages
      convertDetectedLanguage: (lng) => {
        const normalized = lng?.split('-')[0]?.toLowerCase();
        return ['en', 'bg'].includes(normalized) ? normalized : 'en';
      }
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Supported languages
    supportedLngs: ['en', 'bg'],

    // React options
    react: {
      useSuspense: false,
    }
  });

export default i18n;
