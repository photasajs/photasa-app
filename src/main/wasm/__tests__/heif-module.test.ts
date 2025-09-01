import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs-extra";

vi.mock("fs-extra", async () => {
    const actual = await vi.importActual<typeof import("fs-extra")>("fs-extra");
    return {
        ...actual,
        pathExists: vi.fn(),
        readFile: vi.fn(),
    };
});

vi.mock("@saschazar/wasm-heif", () => ({
    default: vi.fn().mockResolvedValue({ decode: vi.fn(), dimensions: vi.fn() }),
}));

import { initializeHeifModule, resetHeifModule } from "@main/wasm/heif-module";

describe("heif-module", () => {
    beforeEach(() => {
        resetHeifModule();
        vi.clearAllMocks();
    });

    it("caches module after first init", async () => {
        const m1 = await initializeHeifModule();
        const m2 = await initializeHeifModule();
        expect(m1).toBe(m2);
    });

    it("falls back to resources wasm if default init fails and file exists", async () => {
        // Make default init fail once
        const create = (await import("@saschazar/wasm-heif")).default as unknown as ReturnType<
            typeof vi.fn
        >;
        (create as any).mockRejectedValueOnce(new Error("fail init"));

        vi.mocked(fs.pathExists).mockResolvedValue(true as any);
        vi.mocked(fs.readFile).mockResolvedValue(new Uint8Array([0, 1, 2]) as any);

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();
        // second call uses cache
        const mod2 = await initializeHeifModule();
        expect(mod2).toBe(mod);
    });
});
