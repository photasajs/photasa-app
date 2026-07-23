import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** RFC 0157 — dev/prod build channel invariants (static config only). */
const BUILD_CHANNEL = {
    DEV_CONFIG_REL: "src-tauri/tauri.dev.conf.json",
    BASE_CONFIG_REL: "src-tauri/tauri.conf.json",
    PACKAGE_JSON_REL: "package.json",
    DEV_IDENTIFIER: "me.photasa.app.dev",
    DEV_CONFIG_BASENAME: "tauri.dev.conf.json",
    DEV_TAURI_SCRIPTS: ["dev", "build:debug"] as const,
    PROD_CI_SCRIPT: "build:ci",
    DEV_WINDOW_TITLE: "Photasa (Dev)",
    DEV_MAIN_BINARY_NAME: "Photasa Dev",
    DEV_INFO_PLIST: "Info.dev.plist",
    DEV_ICON_PATHS: [
        "src-tauri/icons-dev/icon.icns",
        "src-tauri/icons-dev/icon.ico",
        "src-tauri/icons-dev/32x32.png",
        "src-tauri/icons-dev/128x128.png",
        "src-tauri/icons-dev/128x128@2x.png",
    ] as const,
    GENERATE_DEV_ICONS_SCRIPT: "generate:dev-icons",
} as const;

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readJson<T>(relativePath: string): T {
    const absolutePath = join(packageRoot, relativePath);
    return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
}

type TauriWindowConfig = {
    label: string;
    title?: string;
    width?: number;
    height?: number;
};

type TauriConfig = {
    identifier: string;
    productName: string;
    mainBinaryName?: string;
    app?: { windows?: TauriWindowConfig[] };
    plugins?: { updater?: { endpoints?: string[] } };
    bundle?: { icon?: string[]; macOS?: { bundleName?: string; infoPlist?: string } };
};

type PackageJson = { scripts: Record<string, string> };

describe("RFC 0157 build channels", () => {
    const baseConfig = readJson<TauriConfig>(BUILD_CHANNEL.BASE_CONFIG_REL);
    const devConfig = readJson<TauriConfig>(BUILD_CHANNEL.DEV_CONFIG_REL);
    const packageJson = readJson<PackageJson>(BUILD_CHANNEL.PACKAGE_JSON_REL);

    it("dev overlay uses a distinct identifier derived from prod", () => {
        expect(devConfig.identifier).not.toBe(baseConfig.identifier);
        expect(devConfig.identifier).toBe(`${baseConfig.identifier}.dev`);
        expect(devConfig.identifier).toBe(BUILD_CHANNEL.DEV_IDENTIFIER);
    });

    it("dev overlay clears updater endpoints", () => {
        expect(devConfig.plugins?.updater?.endpoints).toEqual([]);
    });

    it("dev overlay sets macOS dock-visible binary and plist names", () => {
        expect(devConfig.mainBinaryName).toBe(BUILD_CHANNEL.DEV_MAIN_BINARY_NAME);
        expect(devConfig.bundle?.macOS?.bundleName).toBe(BUILD_CHANNEL.DEV_MAIN_BINARY_NAME);
        expect(devConfig.bundle?.macOS?.infoPlist).toBe(BUILD_CHANNEL.DEV_INFO_PLIST);
    });

    it("dev overlay uses icons-dev, not prod icons/", () => {
        const devIcons = devConfig.bundle?.icon ?? [];
        expect(devIcons.length).toBeGreaterThan(0);
        for (const iconPath of devIcons) {
            expect(iconPath).toMatch(/^icons-dev\//);
            expect(iconPath).not.toMatch(/^icons\//);
        }
        const prodIcons = baseConfig.bundle?.icon ?? [];
        expect(devIcons).not.toEqual(prodIcons);
    });

    it("committed dev icon assets exist on disk", () => {
        for (const relativePath of BUILD_CHANNEL.DEV_ICON_PATHS) {
            const absolutePath = join(packageRoot, relativePath);
            expect(existsSync(absolutePath), `missing ${relativePath}`).toBe(true);
        }
    });

    it("generate:dev-icons script is available", () => {
        expect(packageJson.scripts[BUILD_CHANNEL.GENERATE_DEV_ICONS_SCRIPT]).toBeDefined();
    });

    it("dev windows mirror prod geometry with dev titles (array replace merge)", () => {
        const baseWindows = baseConfig.app?.windows ?? [];
        const devWindows = devConfig.app?.windows ?? [];
        expect(devWindows).toHaveLength(baseWindows.length);

        for (const baseWindow of baseWindows) {
            const devWindow = devWindows.find((w) => w.label === baseWindow.label);
            expect(devWindow, `missing dev window ${baseWindow.label}`).toBeDefined();
            expect(devWindow?.width).toBe(baseWindow.width);
            expect(devWindow?.height).toBe(baseWindow.height);
            expect(devWindow?.title).toBe(BUILD_CHANNEL.DEV_WINDOW_TITLE);
        }
    });

    it("local dev scripts point at tauri.dev.conf.json", () => {
        for (const scriptName of BUILD_CHANNEL.DEV_TAURI_SCRIPTS) {
            const script = packageJson.scripts[scriptName];
            expect(script, `missing script ${scriptName}`).toBeDefined();
            expect(script).toContain(BUILD_CHANNEL.DEV_CONFIG_BASENAME);
        }
    });

    it("build:ci stays on prod channel", () => {
        const ciScript = packageJson.scripts[BUILD_CHANNEL.PROD_CI_SCRIPT];
        expect(ciScript).toBeDefined();
        expect(ciScript).not.toContain(BUILD_CHANNEL.DEV_CONFIG_BASENAME);
        expect(ciScript).not.toContain(BUILD_CHANNEL.DEV_IDENTIFIER);
    });
});
