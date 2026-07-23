#!/usr/bin/env node
/**
 * Regenerate `.release-please-config.json` extra-files from workspace targets.
 * Run after adding a new workspace package or Photasa crate.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
    REPO_ROOT,
    getWorkspaceVersionTargets,
    toReleasePleaseExtraFiles,
} from "./lib/workspace-version-targets.mjs";

const CONFIG_PATH = join(REPO_ROOT, ".release-please-config.json");

/** Merge commit for photasa-v2.0.0 / v2.0.0 (PR #192). */
const RELEASE_2_0_0_SHA = "45ea2950cbf31f157480f056ff863582aa613be2";

const RELEASE_PLEASE_CONFIG = {
    $schema:
        "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
    packages: {
        ".": {
            "release-type": "node",
            "package-name": "photasa",
            // v1.7.0-era tags are `v*`. Root package must not prefix tags with `photasa-`.
            "include-component-in-tag": false,
            "bootstrap-sha": RELEASE_2_0_0_SHA,
            "changelog-path": "CHANGELOG.md",
            "extra-files": [],
        },
    },
};

function main() {
    const targets = getWorkspaceVersionTargets();
    RELEASE_PLEASE_CONFIG.packages["."]["extra-files"] =
        toReleasePleaseExtraFiles(targets);

    writeFileSync(
        CONFIG_PATH,
        `${JSON.stringify(RELEASE_PLEASE_CONFIG, null, 4)}\n`,
    );

    console.log(
        `Wrote ${CONFIG_PATH} with ${RELEASE_PLEASE_CONFIG.packages["."]["extra-files"].length} extra-files`,
    );
}

main();
