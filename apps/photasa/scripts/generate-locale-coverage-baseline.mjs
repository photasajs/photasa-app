#!/usr/bin/env node
/** One-off generator: freeze current per-locale missing required keys into baseline. */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(SCRIPT_DIR, "..");
const SRC_ROOT = join(APP_ROOT, "src");
const LOCALES_DIR = join(SRC_ROOT, "locales");

const I18N_KEY_PATTERN = "[a-zA-Z][\\w]*(?:\\.[\\w]+)+";
const SOURCE_KEY_REGEXES = [
    new RegExp(`\\bt\\(\\s*['"](${I18N_KEY_PATTERN})['"]`, "g"),
    new RegExp(`\\$t\\(\\s*['"](${I18N_KEY_PATTERN})['"]`, "g"),
    new RegExp(`\\blabel:\\s*['"](${I18N_KEY_PATTERN})['"]`, "g"),
];
const SKIP_DIRS = new Set(["node_modules", "__tests__", "dist", ".git"]);
const SOURCE_EXTENSIONS = new Set([".vue", ".ts", ".tsx"]);

function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function hasMessagePath(messages, dottedKey) {
    const parts = dottedKey.split(".");
    let current = messages;
    for (const part of parts) {
        if (!current || typeof current !== "object" || !(part in current)) return false;
        current = current[part];
    }
    return typeof current === "string";
}

function walkSourceFiles(rootDir) {
    const files = [];
    for (const entry of readdirSync(rootDir)) {
        const fullPath = join(rootDir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            if (!SKIP_DIRS.has(entry)) files.push(...walkSourceFiles(fullPath));
        } else if (SOURCE_EXTENSIONS.has(fullPath.slice(fullPath.lastIndexOf(".")))) {
            files.push(fullPath);
        }
    }
    return files;
}


const usedKeys = new Set();
for (const filePath of walkSourceFiles(SRC_ROOT)) {
    const source = stripComments(readFileSync(filePath, "utf8"));
    for (const regex of SOURCE_KEY_REGEXES) {
        for (const match of source.matchAll(regex)) usedKeys.add(match[1]);
    }
}

const enUS = JSON.parse(readFileSync(join(LOCALES_DIR, "en-US.json"), "utf8"));
const requiredKeys = [...usedKeys].filter((key) => hasMessagePath(enUS, key)).sort();
const missingByLocale = {};

for (const filename of readdirSync(LOCALES_DIR).filter((n) => n.endsWith(".json"))) {
    const locale = filename.replace(".json", "");
    const messages = JSON.parse(readFileSync(join(LOCALES_DIR, filename), "utf8"));
    missingByLocale[locale] = requiredKeys.filter((key) => !hasMessagePath(messages, key)).sort();
}

writeFileSync(
    join(SRC_ROOT, "i18n", "locale-coverage-baseline.json"),
    `${JSON.stringify({ missingByLocale }, null, 2)}\n`,
);

for (const [locale, missing] of Object.entries(missingByLocale)) {
    if (missing.length > 0) console.log(locale, missing.length);
}
console.log("required keys:", requiredKeys.length);
