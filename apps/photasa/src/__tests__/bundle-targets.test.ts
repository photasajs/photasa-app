import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** RFC 0158 — per-platform bundle targets for release/updater artifacts. */
const BUNDLE_TARGETS = {
    BASE_CONFIG_REL: "src-tauri/tauri.conf.json",
    LINUX_CONFIG_REL: "src-tauri/tauri.linux.conf.json",
    RELEASE_WORKFLOW_REL: "../../.github/workflows/upload-release-assets.yml",
    MACOS_BUNDLE_TARGET: "app",
    LINUX_BUNDLE_TARGET: "appimage",
    LINUX_BUNDLE_ARGS: "--bundles appimage,deb,rpm",
    MACOS_BUNDLE_ARGS: "--bundles app,dmg",
} as const;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readJson<T>(relativePath: string): T {
    const absolutePath = join(packageRoot, relativePath);
    return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
}

function readText(relativePath: string): string {
    return readFileSync(join(packageRoot, relativePath), "utf8");
}

type BundleConfig = {
    bundle?: {
        targets?: string[];
        createUpdaterArtifacts?: boolean;
    };
};

describe("RFC 0158 bundle targets", () => {
    const baseConfig = readJson<BundleConfig>(BUNDLE_TARGETS.BASE_CONFIG_REL);
    const linuxConfig = readJson<BundleConfig>(BUNDLE_TARGETS.LINUX_CONFIG_REL);
    const releaseWorkflow = readText(BUNDLE_TARGETS.RELEASE_WORKFLOW_REL);

    it("prod config keeps macOS app bundle for updater tarballs", () => {
        expect(baseConfig.bundle?.targets).toEqual([BUNDLE_TARGETS.MACOS_BUNDLE_TARGET]);
        expect(baseConfig.bundle?.createUpdaterArtifacts).toBe(true);
    });

    it("linux overlay bundles appimage, deb, and rpm for release and updater", () => {
        expect(linuxConfig.bundle?.targets).toEqual([
            BUNDLE_TARGETS.LINUX_BUNDLE_TARGET,
            "deb",
            "rpm",
        ]);
    });

    it("release workflow forces Linux bundles for tagged snapshots", () => {
        expect(releaseWorkflow).toContain(
            `runner.os == 'Linux' && '${BUNDLE_TARGETS.LINUX_BUNDLE_ARGS}'`,
        );
    });

    it("release workflow builds a downloadable macOS DMG", () => {
        expect(releaseWorkflow).toContain(
            `runner.os == 'macOS' && '${BUNDLE_TARGETS.MACOS_BUNDLE_ARGS}'`,
        );
    });

    it("manual release retry defaults to tagged source instead of workflow HEAD", () => {
        expect(releaseWorkflow).toContain("ref: ${{ github.event.inputs.tag_name }}");
        expect(releaseWorkflow).toContain('release_sha="$(git rev-parse HEAD)"');
        expect(releaseWorkflow).not.toContain('release_sha="${{ github.sha }}"');
    });
});
