import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

/** Monorepo root (parent of `scripts/`). */
export const REPO_ROOT = join(SCRIPT_DIR, "..", "..");

const ROOT_PACKAGE_JSON = "package.json";
const TAURI_CONF_PATH = "apps/photasa/src-tauri/tauri.conf.json";

/** Vendored sys crate; version tracks upstream libheif, not Photasa app releases. */
const EXCLUDED_CRATE_DIRS = new Set(["libheif-sys"]);

/**
 * @param {string} dir
 * @param {string[]} acc
 */
function collectPackageJsonUnder(dir, acc) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
            continue;
        }
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            collectPackageJsonUnder(fullPath, acc);
            continue;
        }
        if (entry.name === "package.json") {
            acc.push(relative(REPO_ROOT, fullPath));
        }
    }
}

/** @returns {string[]} Repo-relative `package.json` paths (root + workspace packages). */
export function listPackageJsonPaths() {
    const paths = [ROOT_PACKAGE_JSON];
    collectPackageJsonUnder(join(REPO_ROOT, "apps"), paths);
    collectPackageJsonUnder(join(REPO_ROOT, "packages"), paths);
    return [...new Set(paths)].sort();
}

/** @returns {string[]} Repo-relative Photasa-owned `Cargo.toml` paths. */
export function listPhotasaCargoTomlPaths() {
    const paths = [];
    const cratesDir = join(REPO_ROOT, "crates");
    for (const entry of readdirSync(cratesDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || EXCLUDED_CRATE_DIRS.has(entry.name)) {
            continue;
        }
        if (entry.name.startsWith("photasa-")) {
            paths.push(relative(REPO_ROOT, join(cratesDir, entry.name, "Cargo.toml")));
        }
    }
    paths.push("apps/photasa/src-tauri/Cargo.toml");
    return paths.sort();
}

/** @returns {{ packageJson: string[]; cargoToml: string[]; tauriConf: string[] }} */
export function getWorkspaceVersionTargets() {
    return {
        packageJson: listPackageJsonPaths(),
        cargoToml: listPhotasaCargoTomlPaths(),
        tauriConf: [TAURI_CONF_PATH],
    };
}

/**
 * release-please `extra-files` entries for every non-root version field.
 * @param {ReturnType<typeof getWorkspaceVersionTargets>} targets
 */
export function toReleasePleaseExtraFiles(targets) {
    /** @type {Array<{ type: string; path: string; jsonpath: string }>} */
    const extraFiles = [];

    for (const packagePath of targets.packageJson) {
        if (packagePath === ROOT_PACKAGE_JSON) {
            continue;
        }
        extraFiles.push({
            type: "json",
            path: packagePath,
            jsonpath: "$.version",
        });
    }

    for (const cargoPath of targets.cargoToml) {
        extraFiles.push({
            type: "toml",
            path: cargoPath,
            jsonpath: "$.package.version",
        });
    }

    for (const tauriPath of targets.tauriConf) {
        extraFiles.push({
            type: "json",
            path: tauriPath,
            jsonpath: "$.version",
        });
    }

    return extraFiles;
}
