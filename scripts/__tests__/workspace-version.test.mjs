import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
    getWorkspaceVersionTargets,
    listPackageJsonPaths,
    listPhotasaCargoTomlPaths,
    toReleasePleaseExtraFiles,
} from "../lib/workspace-version-targets.mjs";
import {
    collectVersionMismatches,
    readCanonicalVersion,
} from "../sync-workspace-version.mjs";

test("discovers workspace package.json and Photasa cargo targets", () => {
    const packageJsonPaths = listPackageJsonPaths();
    assert.ok(packageJsonPaths.includes("package.json"));
    assert.ok(packageJsonPaths.includes("apps/photasa/package.json"));
    assert.ok(
        packageJsonPaths.includes("packages/@photasa/common/package.json"),
    );

    const cargoPaths = listPhotasaCargoTomlPaths();
    assert.ok(cargoPaths.includes("apps/photasa/src-tauri/Cargo.toml"));
    assert.ok(cargoPaths.includes("crates/photasa-import/Cargo.toml"));
    assert.ok(!cargoPaths.includes("crates/libheif-sys/Cargo.toml"));

    const extraFiles = toReleasePleaseExtraFiles(getWorkspaceVersionTargets());
    assert.ok(extraFiles.length > 0);
    assert.ok(
        extraFiles.some(
            (entry) =>
                entry.path === "apps/photasa/src-tauri/tauri.conf.json" &&
                entry.jsonpath === "$.version",
        ),
    );
});

test("root package.json version matches every tracked target", () => {
    const canonical = readCanonicalVersion();
    const mismatches = collectVersionMismatches(canonical);
    assert.deepEqual(mismatches, []);
});

test("release-please root package tag format", () => {
    const config = JSON.parse(
        readFileSync(new URL("../../.release-please-config.json", import.meta.url)),
    );
    const rootPackage = config.packages["."];
    assert.equal(rootPackage["package-name"], "photasa");
    assert.equal(rootPackage["include-component-in-tag"], false);
});
