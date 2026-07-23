import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** RFC 0158 — per-platform bundle targets for release/updater artifacts. */
const BUNDLE_TARGETS = {
    BASE_CONFIG_REL: "src-tauri/tauri.conf.json",
    LINUX_CONFIG_REL: "src-tauri/tauri.linux.conf.json",
    MACOS_BUNDLE_TARGET: "app",
    LINUX_BUNDLE_TARGET: "appimage",
} as const;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readJson<T>(relativePath: string): T {
    const absolutePath = join(packageRoot, relativePath);
    return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
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
});
