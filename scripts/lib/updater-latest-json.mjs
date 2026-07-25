/**
 * RFC 0158 — validate Tauri updater `latest.json` platform entries.
 * Shared by CI shell (jq) and local `verify-release-latest-json.mjs`.
 */

/** Platforms required by upload-release-assets matrix (Phase 1). */
export const RFC_0158_REQUIRED_PLATFORMS = Object.freeze([
    "darwin-aarch64",
    "linux-x86_64",
]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} platformEntry
 * @returns {string[]}
 */
function validatePlatformEntry(platformEntry) {
    if (!isRecord(platformEntry)) {
        return ["platform entry must be an object"];
    }

    const errors = [];
    if (typeof platformEntry.url !== "string" || platformEntry.url.length === 0) {
        errors.push("url must be a non-empty string");
    }
    if (
        typeof platformEntry.signature !== "string" ||
        platformEntry.signature.length === 0
    ) {
        errors.push("signature must be a non-empty string");
    }
    return errors;
}

/**
 * @param {unknown} latestJson
 * @param {{ requiredPlatforms?: readonly string[] }} [options]
 * @returns {{ ok: true, version: string } | { ok: false, errors: string[] }}
 */
export function validateUpdaterLatestJson(latestJson, options = {}) {
    const requiredPlatforms =
        options.requiredPlatforms ?? RFC_0158_REQUIRED_PLATFORMS;
    const errors = [];

    if (!isRecord(latestJson)) {
        return { ok: false, errors: ["latest.json root must be an object"] };
    }

    if (typeof latestJson.version !== "string" || latestJson.version.length === 0) {
        errors.push("version must be a non-empty string");
    }

    if (!isRecord(latestJson.platforms)) {
        errors.push("platforms must be an object");
        return { ok: false, errors };
    }

    const platformKeys = Object.keys(latestJson.platforms);

    for (const platform of requiredPlatforms) {
        if (!(platform in latestJson.platforms)) {
            errors.push(`missing platform key: ${platform}`);
            continue;
        }
        const entryErrors = validatePlatformEntry(latestJson.platforms[platform]);
        for (const entryError of entryErrors) {
            errors.push(`${platform}: ${entryError}`);
        }
    }

    if (errors.length > 0) {
        return {
            ok: false,
            errors,
            presentPlatforms: platformKeys,
        };
    }

    return { ok: true, version: latestJson.version };
}

/**
 * @param {unknown} latestJson
 * @param {{ requiredPlatforms?: readonly string[] }} [options]
 * @returns {string}
 */
export function assertUpdaterLatestJson(latestJson, options = {}) {
    const result = validateUpdaterLatestJson(latestJson, options);
    if (!result.ok) {
        const present =
            "presentPlatforms" in result
                ? ` (present: ${result.presentPlatforms.join(", ") || "none"})`
                : "";
        throw new Error(`${result.errors.join("; ")}${present}`);
    }
    return result.version;
}
