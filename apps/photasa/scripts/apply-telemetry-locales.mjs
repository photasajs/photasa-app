#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TELEMETRY_LOCALE_TRANSLATIONS } from "./telemetry-locale-translations.mjs";

const LOCALES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/locales");

function applyTelemetry(localeId, messages, translation) {
    if (!messages.preference?.tabs || !translation) {
        return false;
    }

    messages.preference.tabs.telemetry = translation.tab;
    messages.telemetry = {
        consent: { ...translation.consent },
        settings: { ...translation.settings },
    };
    return true;
}

let updated = 0;

for (const filename of fs.readdirSync(LOCALES_DIR).filter((name) => name.endsWith(".json"))) {
    const localeId = filename.replace(".json", "");
    if (localeId === "en-US" || localeId === "zh-CN") {
        continue;
    }

    const translation = TELEMETRY_LOCALE_TRANSLATIONS[localeId];
    if (!translation) {
        console.error(`Missing telemetry translation pack for ${localeId}`);
        process.exitCode = 1;
        continue;
    }

    const filePath = path.join(LOCALES_DIR, filename);
    const messages = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!applyTelemetry(localeId, messages, translation)) {
        console.error(`Failed to apply telemetry translations for ${localeId}`);
        process.exitCode = 1;
        continue;
    }

    fs.writeFileSync(filePath, `${JSON.stringify(messages, null, 4)}\n`);
    updated += 1;
}

console.log(`Applied localized telemetry strings to ${updated} locale file(s).`);
