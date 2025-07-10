import { createI18n } from "vue-i18n";
import enUS from "../locales/en-US.json";
import zhCN from "../locales/zh-CN.json";
import jaJP from "../locales/ja-JP.json";
import koKR from "../locales/ko-KR.json";
import frFR from "../locales/fr-FR.json";
import deDE from "../locales/de-DE.json";
import esES from "../locales/es-ES.json";
import enGB from "../locales/en-GB.json";
import itIT from "../locales/it-IT.json";
import trTR from "../locales/tr-TR.json";
import viVN from "../locales/vi-VN.json";
import arSA from "../locales/ar-SA.json";
import ukUA from "../locales/uk-UA.json";
import ruRU from "../locales/ru-RU.json";
import type { Ref } from "vue";

// Constants
const DEFAULT_LOCALE = "zh-CN" as const;
const FALLBACK_LOCALE = "en-US" as const;

// Define supported locales with their display names and native names
export const LOCALES = {
    "en-US": {
        name: "English (US)",
        nativeName: "English (US)",
    },
    "zh-CN": {
        name: "Chinese (Simplified)",
        nativeName: "中文(简体)",
    },
    "ja-JP": {
        name: "Japanese",
        nativeName: "日本語",
    },
    "ko-KR": {
        name: "Korean",
        nativeName: "한국어",
    },
    "fr-FR": {
        name: "French",
        nativeName: "Français",
    },
    "de-DE": {
        name: "German",
        nativeName: "Deutsch",
    },
    "es-ES": {
        name: "Spanish",
        nativeName: "Español",
    },
    "it-IT": {
        name: "Italian",
        nativeName: "Italiano",
    },
    "tr-TR": {
        name: "Turkish",
        nativeName: "Türkçe",
    },
    "vi-VN": {
        name: "Vietnamese",
        nativeName: "Tiếng Việt",
    },
    "ar-SA": {
        name: "Arabic",
        nativeName: "العربية",
    },
    "uk-UA": {
        name: "Ukrainian",
        nativeName: "Українська",
    },
    "en-GB": {
        name: "English (UK)",
        nativeName: "English (UK)",
    },
    "ru-RU": {
        name: "Russian",
        nativeName: "Русский",
    },
} as const;

// Type definitions
export type Locale = keyof typeof LOCALES;
export type MessageSchema =
    | typeof zhCN
    | typeof enUS
    | typeof jaJP
    | typeof koKR
    | typeof frFR
    | typeof deDE
    | typeof esES
    | typeof itIT
    | typeof trTR
    | typeof viVN
    | typeof arSA
    | typeof ukUA
    | typeof enGB
    | typeof ruRU;

// Browser language detection
const detectBrowserLocale = (): Locale | null => {
    const browserLocale = navigator.language;
    const normalizedLocale = browserLocale.replace("-", "").toLowerCase();

    for (const locale of Object.keys(LOCALES) as Locale[]) {
        if (locale.toLowerCase().replace("-", "") === normalizedLocale) {
            return locale;
        }
    }

    // Try to match just the language code
    const languageCode = browserLocale.split("-")[0];
    for (const locale of Object.keys(LOCALES) as Locale[]) {
        if (locale.toLowerCase().startsWith(languageCode)) {
            return locale;
        }
    }

    return null;
};

// Check if a locale is supported
const isLocaleSupported = (locale: string): locale is Locale =>
    Object.keys(LOCALES).includes(locale);

// Create i18n instance with proper typing
export const i18n = createI18n<[MessageSchema], Locale>({
    legacy: false,
    locale: DEFAULT_LOCALE,
    fallbackLocale: FALLBACK_LOCALE,
    globalInjection: true,
    messages: {
        "en-US": enUS,
        "zh-CN": zhCN,
        "ja-JP": jaJP,
        "ko-KR": koKR,
        "fr-FR": frFR,
        "de-DE": deDE,
        "es-ES": esES,
        "it-IT": itIT,
        "tr-TR": trTR,
        "vi-VN": viVN,
        "ar-SA": arSA,
        "uk-UA": ukUA,
        "en-GB": enGB,
        "ru-RU": ruRU,
    },
});

// Utility functions
export const i18nUtils = {
    // Get display name for a locale
    getLocaleName: (locale: Locale): string => LOCALES[locale].name,

    // Get native name for a locale
    getLocaleNativeName: (locale: Locale): string => LOCALES[locale].nativeName,

    // Get flag for a locale
    getLocaleFlag: (locale: Locale): string => LOCALES[locale].flag,

    // Get all available locales
    getAvailableLocales: (): Locale[] => Object.keys(LOCALES) as Locale[],

    // Change the current locale
    setLocale: (locale: Locale): void => {
        if (i18n.global.locale) {
            (i18n.global.locale as unknown as Ref<Locale>).value = locale;
            document.querySelector("html")?.setAttribute("lang", locale);
        }
    },

    // Get current locale
    getCurrentLocale: (): Locale => (i18n.global.locale as unknown as Ref<Locale>).value as Locale,

    // Check if a locale is supported
    isLocaleSupported,

    // Get browser locale
    getBrowserLocale: (): Locale | null => detectBrowserLocale(),
};
