#!/usr/bin/env node
/**
 * Align every workspace package.json, Photasa Cargo crate, and Tauri config
 * to the root package.json version (single source of truth).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
    REPO_ROOT,
    getWorkspaceVersionTargets,
} from "./lib/workspace-version-targets.mjs";

const ROOT_PACKAGE_JSON = join(REPO_ROOT, "package.json");
const PACKAGE_VERSION_PATTERN = /^version\s*=\s*"[^"]*"/m;

/** @returns {string} */
export function readCanonicalVersion() {
    const root = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, "utf8"));
    if (typeof root.version !== "string" || root.version.length === 0) {
        throw new Error("Root package.json is missing a non-empty version field");
    }
    return root.version;
}

/** @param {string} repoRelativePath @returns {string} */
export function readPackageJsonVersion(repoRelativePath) {
    const pkg = JSON.parse(
        readFileSync(join(REPO_ROOT, repoRelativePath), "utf8"),
    );
    return pkg.version;
}

/** @param {string} repoRelativePath @returns {string} */
export function readCargoPackageVersion(repoRelativePath) {
    const content = readFileSync(join(REPO_ROOT, repoRelativePath), "utf8");
    const match = content.match(/^version\s*=\s*"([^"]*)"/m);
    if (!match) {
        throw new Error(`Missing [package].version in ${repoRelativePath}`);
    }
    return match[1];
}

/** @param {string} repoRelativePath @returns {string} */
export function readTauriConfVersion(repoRelativePath) {
    const conf = JSON.parse(
        readFileSync(join(REPO_ROOT, repoRelativePath), "utf8"),
    );
    return conf.version;
}

/**
 * @param {string} version
 * @returns {Array<{ path: string; kind: string }>}
 */
export function collectVersionMismatches(version) {
    const targets = getWorkspaceVersionTargets();
    /** @type {Array<{ path: string; kind: string; actual: string }>} */
    const mismatches = [];

    for (const packagePath of targets.packageJson) {
        const actual = readPackageJsonVersion(packagePath);
        if (actual !== version) {
            mismatches.push({ path: packagePath, kind: "package.json", actual });
        }
    }

    for (const cargoPath of targets.cargoToml) {
        const actual = readCargoPackageVersion(cargoPath);
        if (actual !== version) {
            mismatches.push({ path: cargoPath, kind: "cargo", actual });
        }
    }

    for (const tauriPath of targets.tauriConf) {
        const actual = readTauriConfVersion(tauriPath);
        if (actual !== version) {
            mismatches.push({ path: tauriPath, kind: "tauri", actual });
        }
    }

    return mismatches;
}

/** @param {string} repoRelativePath @param {string} version */
function writePackageJsonVersion(repoRelativePath, version) {
    const fullPath = join(REPO_ROOT, repoRelativePath);
    const pkg = JSON.parse(readFileSync(fullPath, "utf8"));
    pkg.version = version;
    writeFileSync(fullPath, `${JSON.stringify(pkg, null, 4)}\n`);
}

/** @param {string} repoRelativePath @param {string} version */
function writeCargoPackageVersion(repoRelativePath, version) {
    const fullPath = join(REPO_ROOT, repoRelativePath);
    const content = readFileSync(fullPath, "utf8");
    if (!PACKAGE_VERSION_PATTERN.test(content)) {
        throw new Error(`Missing [package].version in ${repoRelativePath}`);
    }
    writeFileSync(
        fullPath,
        content.replace(PACKAGE_VERSION_PATTERN, `version = "${version}"`),
    );
}

/** @param {string} repoRelativePath @param {string} version */
function writeTauriConfVersion(repoRelativePath, version) {
    const fullPath = join(REPO_ROOT, repoRelativePath);
    const conf = JSON.parse(readFileSync(fullPath, "utf8"));
    conf.version = version;
    writeFileSync(fullPath, `${JSON.stringify(conf, null, 4)}\n`);
}

/**
 * @param {string} version
 * @returns {string[]} Updated repo-relative paths
 */
export function syncWorkspaceVersion(version) {
    const targets = getWorkspaceVersionTargets();
    /** @type {string[]} */
    const updated = [];

    writePackageJsonVersion("package.json", version);
    updated.push("package.json");

    for (const packagePath of targets.packageJson) {
        if (packagePath === "package.json") {
            continue;
        }
        writePackageJsonVersion(packagePath, version);
        updated.push(packagePath);
    }

    for (const cargoPath of targets.cargoToml) {
        writeCargoPackageVersion(cargoPath, version);
        updated.push(cargoPath);
    }

    for (const tauriPath of targets.tauriConf) {
        writeTauriConfVersion(tauriPath, version);
        updated.push(tauriPath);
    }

    return updated;
}

function printUsage() {
    console.error(`Usage:
  node scripts/sync-workspace-version.mjs [--check]
  node scripts/sync-workspace-version.mjs --version <semver>

  Canonical version lives in root package.json. All workspace package.json files,
  Photasa Cargo crates (excluding libheif-sys), and tauri.conf.json are synced.`);
}

function main() {
    const args = process.argv.slice(2);
    const checkOnly = args.includes("--check");
    const versionFlagIndex = args.indexOf("--version");

    if (args.includes("--help") || args.includes("-h")) {
        printUsage();
        process.exit(0);
    }

    let targetVersion = readCanonicalVersion();
    if (versionFlagIndex !== -1) {
        const explicit = args[versionFlagIndex + 1];
        if (!explicit) {
            printUsage();
            process.exit(1);
        }
        targetVersion = explicit;
        writePackageJsonVersion("package.json", targetVersion);
    }

    if (checkOnly) {
        const mismatches = collectVersionMismatches(targetVersion);
        if (mismatches.length === 0) {
            console.log(`Workspace versions aligned at ${targetVersion}`);
            return;
        }
        console.error(
            `Version drift detected (expected ${targetVersion} everywhere):`,
        );
        for (const mismatch of mismatches) {
            console.error(
                `  - ${mismatch.path} (${mismatch.kind}): ${mismatch.actual}`,
            );
        }
        process.exit(1);
    }

    const updated = syncWorkspaceVersion(targetVersion);
    console.log(`Synced ${updated.length} files to ${targetVersion}`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
    main();
}
