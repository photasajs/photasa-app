import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import localeDebtBaseline from "./locale-debt-baseline.json";
import localeCoverageBaseline from "./locale-coverage-baseline.json";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** vue-i18n 静态字面量键，必须含 namespace（如 common.files） */
const I18N_KEY_PATTERN = "[a-zA-Z][\\w]*(?:\\.[\\w]+)+";

/** vue-i18n 静态字面量键 */
export const STATIC_T_KEY_REGEX = new RegExp(`\\bt\\(\\s*['"](${I18N_KEY_PATTERN})['"]`, "g");

/** vue-i18n 模板静态字面量键 */
export const STATIC_DOLLAR_T_KEY_REGEX = new RegExp(
    `\\$t\\(\\s*['"](${I18N_KEY_PATTERN})['"]`,
    "g",
);

/** 菜单等配置里的 i18n 键：label: "menu.app.about" */
export const CONFIG_LABEL_KEY_REGEX = new RegExp(`\\blabel:\\s*['"](${I18N_KEY_PATTERN})['"]`, "g");

const SOURCE_KEY_REGEXES = [STATIC_T_KEY_REGEX, STATIC_DOLLAR_T_KEY_REGEX, CONFIG_LABEL_KEY_REGEX];

/** 已知历史债务：源码已引用但 en-US 尚未补齐的键，禁止继续增长 */
const LEGACY_MISSING_IN_EN_US = new Set(localeDebtBaseline.missingInEnUs);

function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

export function getRequiredTranslationKeys(
    srcRoot: string,
    referenceMessages: Record<string, unknown>,
): Set<string> {
    const usedKeys = collectUsedTranslationKeys(srcRoot);
    const required = new Set<string>();

    for (const key of usedKeys) {
        if (hasMessagePath(referenceMessages, key)) {
            required.add(key);
        }
    }

    return required;
}

/** 源码引用但既不在 en-US、也未记入历史债务 baseline 的新键 */
export function findUndeclaredMissingKeys(
    usedKeys: Iterable<string>,
    referenceMessages: Record<string, unknown>,
): string[] {
    return [...usedKeys]
        .filter((key) => !hasMessagePath(referenceMessages, key))
        .filter((key) => !LEGACY_MISSING_IN_EN_US.has(key))
        .sort();
}

export function loadLocaleDebtBaseline(): { missingInEnUs: string[] } {
    return JSON.parse(readFileSync(join(MODULE_DIR, "locale-debt-baseline.json"), "utf8")) as {
        missingInEnUs: string[];
    };
}

const SKIP_DIRS = new Set(["node_modules", "__tests__", "dist", ".git"]);
const SOURCE_EXTENSIONS = new Set([".vue", ".ts", ".tsx"]);

export function collectMessagePaths(messages: Record<string, unknown>, prefix = ""): Set<string> {
    const paths = new Set<string>();

    for (const [key, value] of Object.entries(messages)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        paths.add(fullPath);

        if (value && typeof value === "object" && !Array.isArray(value)) {
            for (const subPath of collectMessagePaths(value as Record<string, unknown>, fullPath)) {
                paths.add(subPath);
            }
        }
    }

    return paths;
}

export function hasMessagePath(messages: Record<string, unknown>, dottedKey: string): boolean {
    const parts = dottedKey.split(".");
    let current: unknown = messages;

    for (const part of parts) {
        if (!current || typeof current !== "object" || !(part in current)) {
            return false;
        }
        current = (current as Record<string, unknown>)[part];
    }

    return typeof current === "string";
}

export function extractTranslationKeysFromSource(source: string): Set<string> {
    const keys = new Set<string>();

    for (const regex of SOURCE_KEY_REGEXES) {
        for (const match of source.matchAll(regex)) {
            keys.add(match[1]);
        }
    }

    return keys;
}

function walkSourceFiles(rootDir: string): string[] {
    const files: string[] = [];

    for (const entry of readdirSync(rootDir)) {
        const fullPath = join(rootDir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            if (SKIP_DIRS.has(entry)) {
                continue;
            }
            files.push(...walkSourceFiles(fullPath));
            continue;
        }

        const extension = fullPath.slice(fullPath.lastIndexOf("."));
        if (SOURCE_EXTENSIONS.has(extension)) {
            files.push(fullPath);
        }
    }

    return files;
}

export function collectUsedTranslationKeys(srcRoot: string): Set<string> {
    const keys = new Set<string>();

    for (const filePath of walkSourceFiles(srcRoot)) {
        const source = stripComments(readFileSync(filePath, "utf8"));
        for (const key of extractTranslationKeysFromSource(source)) {
            keys.add(key);
        }
    }

    return keys;
}

export interface LocaleCoverageGap {
    locale: string;
    missingKeys: string[];
}

/** 已知历史债务：各 locale 允许缺失的 en-US 已定义键 */
const LEGACY_MISSING_BY_LOCALE = localeCoverageBaseline.missingByLocale;

export function findLocaleCoverageGaps(
    localeMessages: Record<string, Record<string, unknown>>,
    requiredKeys: Iterable<string>,
): LocaleCoverageGap[] {
    const gaps: LocaleCoverageGap[] = [];

    for (const [locale, messages] of Object.entries(localeMessages)) {
        const legacyMissing = new Set(
            LEGACY_MISSING_BY_LOCALE[locale as keyof typeof LEGACY_MISSING_BY_LOCALE] ?? [],
        );
        const missingKeys = [...requiredKeys]
            .filter((key) => !hasMessagePath(messages, key))
            .filter((key) => !legacyMissing.has(key));

        if (missingKeys.length > 0) {
            gaps.push({ locale, missingKeys: missingKeys.sort() });
        }
    }

    return gaps;
}

export function getCurrentMissingByLocale(
    localeMessages: Record<string, Record<string, unknown>>,
    requiredKeys: Iterable<string>,
): Record<string, string[]> {
    const missingByLocale: Record<string, string[]> = {};

    for (const [locale, messages] of Object.entries(localeMessages)) {
        missingByLocale[locale] = [...requiredKeys]
            .filter((key) => !hasMessagePath(messages, key))
            .sort();
    }

    return missingByLocale;
}

export function formatLocaleCoverageReport(
    srcRoot: string,
    gaps: LocaleCoverageGap[],
    usedKeys: Set<string>,
): string {
    const lines = [
        `Translation key coverage failed (${usedKeys.size} keys scanned from ${relative(process.cwd(), srcRoot)}):`,
    ];

    for (const gap of gaps) {
        lines.push(`  ${gap.locale}: missing ${gap.missingKeys.length}`);
        for (const key of gap.missingKeys) {
            lines.push(`    - ${key}`);
        }
    }

    lines.push("");
    lines.push("Add missing keys to every apps/photasa/src/locales/*.json file.");
    return lines.join("\n");
}
