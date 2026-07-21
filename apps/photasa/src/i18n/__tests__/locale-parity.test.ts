import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import arSA from "../../locales/ar-SA.json";
import deDE from "../../locales/de-DE.json";
import enGB from "../../locales/en-GB.json";
import enUS from "../../locales/en-US.json";
import esES from "../../locales/es-ES.json";
import frFR from "../../locales/fr-FR.json";
import itIT from "../../locales/it-IT.json";
import jaJP from "../../locales/ja-JP.json";
import koKR from "../../locales/ko-KR.json";
import ruRU from "../../locales/ru-RU.json";
import trTR from "../../locales/tr-TR.json";
import ukUA from "../../locales/uk-UA.json";
import viVN from "../../locales/vi-VN.json";
import zhCN from "../../locales/zh-CN.json";
import zhTW from "../../locales/zh-TW.json";
import localeDebtBaseline from "../locale-debt-baseline.json";
import localeCoverageBaseline from "../locale-coverage-baseline.json";
import {
    collectUsedTranslationKeys,
    extractTranslationKeysFromSource,
    findLocaleCoverageGaps,
    findUndeclaredMissingKeys,
    formatLocaleCoverageReport,
    getCurrentMissingByLocale,
    getRequiredTranslationKeys,
    hasMessagePath,
} from "../locale-parity";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(TEST_DIR, "../..");
const LOCALES_DIR = join(SRC_ROOT, "locales");

const LOCALE_MESSAGES: Record<string, Record<string, unknown>> = {
    "ar-SA": arSA as Record<string, unknown>,
    "de-DE": deDE as Record<string, unknown>,
    "en-GB": enGB as Record<string, unknown>,
    "en-US": enUS as Record<string, unknown>,
    "es-ES": esES as Record<string, unknown>,
    "fr-FR": frFR as Record<string, unknown>,
    "it-IT": itIT as Record<string, unknown>,
    "ja-JP": jaJP as Record<string, unknown>,
    "ko-KR": koKR as Record<string, unknown>,
    "ru-RU": ruRU as Record<string, unknown>,
    "tr-TR": trTR as Record<string, unknown>,
    "uk-UA": ukUA as Record<string, unknown>,
    "vi-VN": viVN as Record<string, unknown>,
    "zh-CN": zhCN as Record<string, unknown>,
    "zh-TW": zhTW as Record<string, unknown>,
};

describe("extractTranslationKeysFromSource", () => {
    it("collects static t(), $t(), and menu label keys", () => {
        const source = `
            const a = t('common.files');
            const b = $t("window.close");
            const menu = { label: "menu.app.about" };
        `;

        expect([...extractTranslationKeysFromSource(source)].sort()).toEqual([
            "common.files",
            "menu.app.about",
            "window.close",
        ]);
    });
});

describe("locale coverage for keys used in source", () => {
    const usedKeys = collectUsedTranslationKeys(SRC_ROOT);
    const requiredKeys = getRequiredTranslationKeys(SRC_ROOT, LOCALE_MESSAGES["en-US"]);

    it("discovers translation keys from photasa source", () => {
        expect(usedKeys.size).toBeGreaterThan(0);
        expect(usedKeys.has("common.files")).toBe(true);
        expect(usedKeys.has("window.minimize")).toBe(true);
    });

    it("blocks new keys that are not in en-US and not in debt baseline", () => {
        const undeclared = findUndeclaredMissingKeys(usedKeys, LOCALE_MESSAGES["en-US"]);

        expect(
            undeclared,
            undeclared.length > 0
                ? `Add to en-US.json + all locales: ${undeclared.join(", ")}`
                : undefined,
        ).toEqual([]);
    });

    it("keeps locale debt baseline aligned with en-US gaps", () => {
        const currentlyMissingInEnUs = [...usedKeys]
            .filter((key) => !hasMessagePath(LOCALE_MESSAGES["en-US"], key))
            .sort();

        expect(currentlyMissingInEnUs).toEqual([...localeDebtBaseline.missingInEnUs].sort());
    });

    it("keeps per-locale coverage baseline aligned with current gaps", () => {
        const current = getCurrentMissingByLocale(LOCALE_MESSAGES, requiredKeys);

        expect(current).toEqual(localeCoverageBaseline.missingByLocale);
    });

    it("ensures every locale defines every en-US-backed key used in source", () => {
        const gaps = findLocaleCoverageGaps(LOCALE_MESSAGES, requiredKeys);

        expect(
            gaps,
            gaps.length > 0 ? formatLocaleCoverageReport(SRC_ROOT, gaps, requiredKeys) : undefined,
        ).toEqual([]);
    });
});

describe("locale files on disk stay in sync with bundled imports", () => {
    it("loads the same locale directory targeted by i18n config", () => {
        expect(LOCALES_DIR.endsWith("src/locales")).toBe(true);
        expect(Object.keys(LOCALE_MESSAGES)).toHaveLength(15);
    });
});
