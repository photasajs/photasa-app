#!/usr/bin/env node

/**
 * CI / pre-commit locale guard.
 * - Blocks NEW t() keys that are missing from en-US (and not in debt baseline)
 * - Requires every en-US-backed key to exist in ALL locale files
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(SCRIPT_DIR, "..");
const SRC_ROOT = join(APP_ROOT, "src");
const LOCALES_DIR = join(SRC_ROOT, "locales");
const REFERENCE_LOCALE = "en-US.json";
const BASELINE_PATH = join(SRC_ROOT, "i18n", "locale-debt-baseline.json");
const COVERAGE_BASELINE_PATH = join(SRC_ROOT, "i18n", "locale-coverage-baseline.json");

const I18N_KEY_PATTERN = "[a-zA-Z][\\w]*(?:\\.[\\w]+)+";
const STATIC_T_KEY_REGEX = new RegExp(`\\bt\\(\\s*['"](${I18N_KEY_PATTERN})['"]`, "g");
const STATIC_DOLLAR_T_KEY_REGEX = new RegExp(`\\$t\\(\\s*['"](${I18N_KEY_PATTERN})['"]`, "g");
const CONFIG_LABEL_KEY_REGEX = new RegExp(`\\blabel:\\s*['"](${I18N_KEY_PATTERN})['"]`, "g");
const SOURCE_KEY_REGEXES = [STATIC_T_KEY_REGEX, STATIC_DOLLAR_T_KEY_REGEX, CONFIG_LABEL_KEY_REGEX];
const SKIP_DIRS = new Set(["node_modules", "__tests__", "dist", ".git"]);
const SOURCE_EXTENSIONS = new Set([".vue", ".ts", ".tsx"]);

function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function hasMessagePath(messages, dottedKey) {
    const parts = dottedKey.split(".");
    let current = messages;

    for (const part of parts) {
        if (!current || typeof current !== "object" || !(part in current)) {
            return false;
        }
        current = current[part];
    }

    return typeof current === "string";
}

function extractTranslationKeysFromSource(source) {
    const keys = new Set();

    for (const regex of SOURCE_KEY_REGEXES) {
        for (const match of source.matchAll(regex)) {
            keys.add(match[1]);
        }
    }

    return keys;
}

function walkSourceFiles(rootDir) {
    const files = [];

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

function collectUsedTranslationKeys(srcRoot) {
    const keys = new Set();

    for (const filePath of walkSourceFiles(srcRoot)) {
        const source = stripComments(readFileSync(filePath, "utf8"));
        for (const key of extractTranslationKeysFromSource(source)) {
            keys.add(key);
        }
    }

    return keys;
}

function loadLocaleFiles() {
    const locales = {};

    for (const filename of readdirSync(LOCALES_DIR).filter((name) => name.endsWith(".json"))) {
        locales[filename] = JSON.parse(readFileSync(join(LOCALES_DIR, filename), "utf8"));
    }

    return locales;
}

function main() {
    const usedKeys = collectUsedTranslationKeys(SRC_ROOT);
    const locales = loadLocaleFiles();
    const legacyMissing = new Set(
        JSON.parse(readFileSync(BASELINE_PATH, "utf8")).missingInEnUs,
    );
    const legacyMissingByLocale = JSON.parse(readFileSync(COVERAGE_BASELINE_PATH, "utf8"))
        .missingByLocale;

    if (!locales[REFERENCE_LOCALE]) {
        console.error(`Reference locale missing: ${REFERENCE_LOCALE}`);
        process.exit(1);
    }

    const referenceMessages = locales[REFERENCE_LOCALE];
    const undeclaredMissing = [...usedKeys]
        .filter((key) => !hasMessagePath(referenceMessages, key))
        .filter((key) => !legacyMissing.has(key))
        .sort();

    if (undeclaredMissing.length > 0) {
        console.error("New translation keys used in source but missing from en-US.json:");
        for (const key of undeclaredMissing) {
            console.error(`  - ${key}`);
        }
        console.error(
            "\nAdd the key to en-US.json and every other locale file before committing.",
        );
        process.exit(1);
    }

    const requiredKeys = [...usedKeys].filter((key) => hasMessagePath(referenceMessages, key));
    let failed = false;

    for (const [filename, messages] of Object.entries(locales)) {
        const locale = filename.replace(".json", "");
        const allowedMissing = new Set(legacyMissingByLocale[locale] ?? []);
        const missingKeys = requiredKeys
            .filter((key) => !hasMessagePath(messages, key))
            .filter((key) => !allowedMissing.has(key))
            .sort();

        if (missingKeys.length > 0) {
            failed = true;
            console.error(`\n${filename}: missing ${missingKeys.length} required key(s)`);
            for (const key of missingKeys) {
                console.error(`  - ${key}`);
            }
        }
    }

    if (failed) {
        console.error(
            `\nFix: add every missing key to all locale files under ${relative(process.cwd(), LOCALES_DIR)}.`,
        );
        process.exit(1);
    }

    console.log(
        `Locale check passed (${requiredKeys.length} required keys, ${usedKeys.size} used keys, ${legacyMissing.size} legacy debt keys).`,
    );
}

main();
