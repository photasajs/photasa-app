import { createI18n } from "vue-i18n";
import enUS from "../locales/en-US.json";
import zhCN from "../locales/zh-CN.json";
import jaJP from "../locales/ja-JP.json";

// Define supported locales
export const SUPPORTED_LOCALES = ["en-US", "zh-CN", "ja-JP"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Type-define the message schema
export type MessageSchema = typeof zhCN | typeof enUS | typeof jaJP;

// Create i18n instance
export const i18n = createI18n<[MessageSchema], SupportedLocale>({
    legacy: false, // Use Composition API
    locale: "zh-CN", // Default locale
    fallbackLocale: "en-US", // Fallback locale
    globalInjection: true, // Enable global injection
    messages: {
        "en-US": enUS,
        "zh-CN": zhCN,
        "ja-JP": jaJP,
    },
});

// Helper function to get locale name
export function getLocaleName(locale: SupportedLocale): string {
    const names: Record<SupportedLocale, string> = {
        "en-US": "English",
        "zh-CN": "中文",
        "ja-JP": "日本語",
    };
    return names[locale];
}

// Helper function to change locale
export function setLocale(locale: SupportedLocale): void {
    if (i18n.global.locale) {
        i18n.global.locale = locale;
        document.querySelector("html")?.setAttribute("lang", locale);
    }
}
