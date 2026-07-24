import { ESLint } from "eslint";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const restrictedModules = [
    "@renderer/utils/api",
    "@renderer/api/legacy-api",
    "@renderer/ipc/api-access",
] as const;

async function lintProbe(source: string, relativePath = "src/components/rfc0154-probe.ts") {
    const eslint = new ESLint({ cwd: packageRoot, cache: false });
    const [result] = await eslint.lintText(source, {
        filePath: join(packageRoot, relativePath),
    });
    return result.messages;
}

describe("RFC 0154 legacy import gate", () => {
    it.each(restrictedModules)("rejects static import from %s", async (moduleName) => {
        const messages = await lintProbe(`import { probe } from "${moduleName}";\nvoid probe;\n`);
        expect(messages.some(({ ruleId }) => ruleId === "no-restricted-imports")).toBe(true);
    });

    it.each(restrictedModules)("rejects dynamic import from %s", async (moduleName) => {
        const messages = await lintProbe(`void import("${moduleName}");\n`);
        expect(messages.some(({ ruleId }) => ruleId === "no-restricted-syntax")).toBe(true);
    });

    it("does not block similarly named local utilities", async () => {
        const messages = await lintProbe(
            'import { toDirName } from "@renderer/utils/api-path";\nvoid toDirName;\n',
        );
        expect(
            messages.filter(({ ruleId }) =>
                ["no-restricted-imports", "no-restricted-syntax"].includes(ruleId ?? ""),
            ),
        ).toEqual([]);
    });
});

describe("RFC 0154 Tauri transport gate", () => {
    it.each([
        ['import { invoke } from "@tauri-apps/api/core";\nvoid invoke;\n', "core"],
        ['import { listen } from "@tauri-apps/api/event";\nvoid listen;\n', "event"],
        ['import { open } from "@tauri-apps/plugin-dialog";\nvoid open;\n', "plugin"],
    ])("rejects static %s transport import outside YuanTianGang", async (source) => {
        const messages = await lintProbe(source);
        expect(messages.some(({ ruleId }) => ruleId === "no-restricted-imports")).toBe(true);
    });

    it.each(["@tauri-apps/api/core", "@tauri-apps/api/event", "@tauri-apps/plugin-dialog"])(
        "rejects dynamic import from %s outside YuanTianGang",
        async (moduleName) => {
            const messages = await lintProbe(`void import("${moduleName}");\n`);
            expect(messages.some(({ ruleId }) => ruleId === "no-restricted-syntax")).toBe(true);
        },
    );

    it("allows transport imports inside YuanTianGang", async () => {
        const messages = await lintProbe(
            'import { invoke } from "@tauri-apps/api/core";\nvoid invoke;\n',
            "src/services/yuantiangang/transport/rfc0154-probe.ts",
        );
        expect(
            messages.filter(({ ruleId }) =>
                ["no-restricted-imports", "no-restricted-syntax"].includes(ruleId ?? ""),
            ),
        ).toEqual([]);
    });

    it.each([
        ["src/api/env.ts", 'import { isTauri } from "@tauri-apps/api/core";\nvoid isTauri;\n'],
        [
            "src/utils/media-url.ts",
            'import { convertFileSrc } from "@tauri-apps/api/core";\nvoid convertFileSrc;\n',
        ],
    ])("allows reviewed non-business helper in %s", async (relativePath, source) => {
        const messages = await lintProbe(source, relativePath);
        expect(
            messages.filter(({ ruleId }) =>
                ["no-restricted-imports", "no-restricted-syntax"].includes(ruleId ?? ""),
            ),
        ).toEqual([]);
    });

    it.each([
        [
            "src/api/env.ts",
            'import { listen } from "@tauri-apps/api/event";\nvoid listen;\n',
            "no-restricted-imports",
        ],
        [
            "src/utils/media-url.ts",
            'import { open } from "@tauri-apps/plugin-dialog";\nvoid open;\n',
            "no-restricted-imports",
        ],
        [
            "src/utils/media-url.ts",
            'void import("@tauri-apps/api/core");\n',
            "no-restricted-syntax",
        ],
        [
            "src/api/env.ts",
            'import { invoke } from "@tauri-apps/api/core";\nvoid invoke;\n',
            "no-restricted-imports",
        ],
        [
            "src/utils/media-url.ts",
            'import { invoke } from "@tauri-apps/api/core";\nvoid invoke;\n',
            "no-restricted-imports",
        ],
    ])("keeps reviewed helper whitelist narrow in %s", async (relativePath, source, ruleId) => {
        const messages = await lintProbe(source, relativePath);
        expect(messages.some((message) => message.ruleId === ruleId)).toBe(true);
    });
});
