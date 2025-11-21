import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Import or require your translations directly
import en from "../locales/en/translation.json";
import sq from "../locales/sq/translation.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      sq: { translation: sq },
    },
    lng: "en", // Default language
    fallbackLng: "sq", // Fallback if translation missing
    interpolation: {
      escapeValue: false, // React already escapes
    },
    // debug: true, // Uncomment for debug info in console
  });

export default i18n;
