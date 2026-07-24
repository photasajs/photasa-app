import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getPhotasaApi } from "@renderer/ipc/api-access";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readSource(relativePath: string): string {
    return readFileSync(join(packageRoot, relativePath), "utf8");
}

describe("RFC 0154 Phase 1", () => {
    it("does not install adapter as a startup side effect", () => {
        const mainSource = readSource("src/main.ts");
        expect(mainSource).not.toContain('import "./api/adapter"');
    });

    it("does not inject or construct window.api from adapter", () => {
        const adapterSource = readSource("src/api/adapter.ts");
        expect(adapterSource).not.toContain("createLegacyApi");
        expect(adapterSource).not.toMatch(/\(window\s+as\s+any\)\.api\s*=/);
    });

    it("uses module singleton even when a foreign window.api exists", () => {
        const previousDescriptor = Object.getOwnPropertyDescriptor(window, "api");
        const foreignApi = { source: "foreign" };
        Object.defineProperty(window, "api", {
            configurable: true,
            value: foreignApi,
        });

        try {
            const first = getPhotasaApi();
            expect(first).not.toBe(foreignApi);
            expect(getPhotasaApi()).toBe(first);
        } finally {
            if (previousDescriptor) {
                Object.defineProperty(window, "api", previousDescriptor);
            } else {
                Reflect.deleteProperty(window, "api");
            }
        }
    });

    it("marks temporary legacy entry points deprecated", () => {
        expect(readSource("src/ipc/api-access.ts")).toContain("@deprecated");
        expect(readSource("src/utils/api.ts")).toContain("@deprecated");
    });
});
