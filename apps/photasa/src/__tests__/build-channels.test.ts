import { readFileSync } from "node:fs";
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
    PROD_CI_SCRIPT: "tauri:build:ci",
    DEV_WINDOW_TITLE: "Photasa (Dev)",
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
    app?: { windows?: TauriWindowConfig[] };
    plugins?: { updater?: { endpoints?: string[] } };
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

    it("tauri:build:ci stays on prod channel", () => {
        const ciScript = packageJson.scripts[BUILD_CHANNEL.PROD_CI_SCRIPT];
        expect(ciScript).toBeDefined();
        expect(ciScript).not.toContain(BUILD_CHANNEL.DEV_CONFIG_BASENAME);
        expect(ciScript).not.toContain(BUILD_CHANNEL.DEV_IDENTIFIER);
    });
});
