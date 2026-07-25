#!/usr/bin/env node
/**
 * RFC 0158 — verify GitHub Release `latest.json` has required updater platforms.
 *
 * Examples:
 *   node scripts/verify-release-latest-json.mjs --tag photasa-v2.0.0
 *   node scripts/verify-release-latest-json.mjs --url https://github.com/.../latest.json
 *   node scripts/verify-release-latest-json.mjs --file ./latest.json
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { assertUpdaterLatestJson } from "./lib/updater-latest-json.mjs";

const DEFAULT_REPO = "photasajs/photasa-app";
const DEFAULT_LATEST_URL = `https://github.com/${DEFAULT_REPO}/releases/latest/download/latest.json`;

function printUsage() {
    console.error(`Usage:
  node scripts/verify-release-latest-json.mjs --tag <git-tag> [--repo owner/name]
  node scripts/verify-release-latest-json.mjs --url <latest.json-url>
  node scripts/verify-release-latest-json.mjs --file <path-to-latest.json>`);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    /** @type {{ tag?: string; repo: string; url?: string; file?: string }} */
    const parsed = { repo: DEFAULT_REPO };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--tag") {
            parsed.tag = argv[index + 1];
            index += 1;
            continue;
        }
        if (arg === "--repo") {
            parsed.repo = argv[index + 1];
            index += 1;
            continue;
        }
        if (arg === "--url") {
            parsed.url = argv[index + 1];
            index += 1;
            continue;
        }
        if (arg === "--file") {
            parsed.file = argv[index + 1];
            index += 1;
            continue;
        }
        if (arg === "--help" || arg === "-h") {
            printUsage();
            process.exit(0);
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    return parsed;
}

/**
 * @param {string} command
 * @param {string[]} args
 */
function runOrThrow(command, args) {
    const result = spawnSync(command, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
        );
    }
    return result.stdout;
}

/**
 * @param {string} url
 */
async function fetchJson(url) {
    const response = await fetch(url, {
        headers: { Accept: "application/json" },
    });
    if (!response.ok) {
        throw new Error(`GET ${url} → HTTP ${response.status}`);
    }
    return response.json();
}

/**
 * @param {{ tag?: string; repo: string; url?: string; file?: string }} options
 */
async function loadLatestJson(options) {
    if (options.file) {
        return JSON.parse(readFileSync(options.file, "utf8"));
    }

    if (options.tag) {
        const tmpDir = runOrThrow("mktemp", ["-d"]).trim();
        runOrThrow("gh", [
            "release",
            "download",
            options.tag,
            "--repo",
            options.repo,
            "--pattern",
            "latest.json",
            "--dir",
            tmpDir,
        ]);
        return JSON.parse(readFileSync(`${tmpDir}/latest.json`, "utf8"));
    }

    const url = options.url ?? DEFAULT_LATEST_URL;
    return fetchJson(url);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (!options.tag && !options.url && !options.file) {
        printUsage();
        process.exit(1);
    }

    const latestJson = await loadLatestJson(options);
    const version = assertUpdaterLatestJson(latestJson);
    const platforms = Object.keys(latestJson.platforms ?? {}).sort().join(", ");
    console.log(
        `OK: latest.json version=${version} platforms=[${platforms}]`,
    );
}

main().catch((error) => {
    console.error(`verify-release-latest-json: ${error.message}`);
    process.exit(1);
});
