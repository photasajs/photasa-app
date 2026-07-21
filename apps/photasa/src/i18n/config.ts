/**
 * 玄奘一国际化配置
 * 唐朝翻译家，负责翻译各种语言
 * 在Photasa天庭中，玄奘化身翻译家，负责翻译各种语言
 * 通过民间Vue技术，为天庭界面提供翻译功能
 * 与阎立本画师协作，确保界面语言与用户偏好保持一致
 *
 * 核心功能：
 * - 翻译各种语言
 * - 确保界面语言与用户偏好保持一致
 * - 提供翻译功能
 * - 与阎立本画师协作，确保界面语言与用户偏好保持一致
 * - 提供翻译功能
 */
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
import zhTW from "../locales/zh-TW.json";
import type { Ref } from "vue";

/**
 * 常量
 */
const DEFAULT_LOCALE = "zh-CN" as const;
const FALLBACK_LOCALE = "en-US" as const;

/**
 * 定义支持的 locales 及其显示名称和本地名称
 */
export const LOCALES = {
    "zh-CN": {
        name: "Chinese (Simplified)",
        nativeName: "中文(简体)",
    },
    "zh-TW": {
        name: "Chinese (Traditional)",
        nativeName: "中文(繁體)",
    },
    "en-US": {
        name: "English (US)",
        nativeName: "English (US)",
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

/**
 * 类型定义
 */
export type Locale = keyof typeof LOCALES;
export type MessageSchema =
    | typeof zhCN
    | typeof zhTW
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
export const isLocaleSupported = (locale: string): locale is Locale =>
    Object.keys(LOCALES).includes(locale);

/** 遗留偏好 / OS 可能只存语言前缀（如 zh、en） */
const LANGUAGE_PREFIX_TO_LOCALE: Record<string, Locale> = {
    zh: "zh-CN",
    en: "en-US",
    ja: "ja-JP",
    ko: "ko-KR",
    fr: "fr-FR",
    de: "de-DE",
    es: "es-ES",
    it: "it-IT",
    tr: "tr-TR",
    vi: "vi-VN",
    ar: "ar-SA",
    uk: "uk-UA",
    ru: "ru-RU",
};

/**
 * 将任意语言标识规范为已注册的 Locale。
 * 避免 preference 存 "zh" 时 intlify 在 zh 消息包中找不到 common.files。
 */
export function resolveLocale(input: string | null | undefined): Locale {
    const raw = input?.trim();
    if (!raw) {
        return DEFAULT_LOCALE;
    }
    if (isLocaleSupported(raw)) {
        return raw;
    }

    const normalized = raw.replace("_", "-");
    if (isLocaleSupported(normalized)) {
        return normalized;
    }

    const lower = normalized.toLowerCase();
    for (const locale of Object.keys(LOCALES) as Locale[]) {
        if (locale.toLowerCase() === lower) {
            return locale;
        }
    }

    const baseLang = lower.split("-")[0];
    const byPrefix = LANGUAGE_PREFIX_TO_LOCALE[baseLang];
    if (byPrefix) {
        return byPrefix;
    }

    return DEFAULT_LOCALE;
}

const PRIMARY_MESSAGES = {
    "en-US": enUS,
    "zh-CN": zhCN,
    "zh-TW": zhTW,
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
} as const satisfies Record<Locale, MessageSchema>;

/** 短码别名，与 resolveLocale 前缀映射一致 */
const ALIAS_MESSAGES: Record<string, MessageSchema> = {
    en: enUS,
    zh: zhCN,
    ja: jaJP,
    ko: koKR,
    fr: frFR,
    de: deDE,
    es: esES,
    it: itIT,
    tr: trTR,
    vi: viVN,
    ar: arSA,
    uk: ukUA,
    ru: ruRU,
};

// Create i18n instance with proper typing
export const i18n = createI18n<[MessageSchema], Locale>({
    legacy: false,
    locale: DEFAULT_LOCALE,
    fallbackLocale: FALLBACK_LOCALE,
    globalInjection: true,
    messages: {
        ...PRIMARY_MESSAGES,
        ...ALIAS_MESSAGES,
    },
});

/**
 * 国际化工具函数
 */
export const i18nUtils = {
    // Get display name for a locale
    getLocaleName: (locale: Locale): string => LOCALES[locale].name,

    // Get native name for a locale
    getLocaleNativeName: (locale: Locale): string => LOCALES[locale].nativeName,

    // Get all available locales
    getAvailableLocales: (): Locale[] => Object.keys(LOCALES) as Locale[],

    // Change the current locale（接受短码并规范化为 Locale）
    setLocale: (locale: string): void => {
        const resolved = resolveLocale(locale);
        if (i18n.global.locale) {
            (i18n.global.locale as unknown as Ref<Locale>).value = resolved;
            document.querySelector("html")?.setAttribute("lang", resolved);
        }
    },

    // Get current locale
    getCurrentLocale: (): Locale => (i18n.global.locale as unknown as Ref<Locale>).value as Locale,

    // Check if a locale is supported
    isLocaleSupported,

    // Get browser locale
    getBrowserLocale: (): Locale | null => detectBrowserLocale(),
};
