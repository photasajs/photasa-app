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
        // Mock pathExists to return true for resources directory
        vi.mocked(fs.pathExists).mockResolvedValue(true as any);
        const mockWasmData = new Uint8Array([1, 2, 3, 4, 5]);
        // Ensure the mock has a length property
        Object.defineProperty(mockWasmData, 'length', { value: 5, writable: false });
        vi.mocked(fs.readFile).mockResolvedValue(mockWasmData as any);

        const m1 = await initializeHeifModule();
        const m2 = await initializeHeifModule();
        expect(m1).toBe(m2);
    });

    it("uses resources directory as primary method", async () => {
        vi.mocked(fs.pathExists).mockResolvedValue(true as any);
        const mockWasmData = new Uint8Array([0, 1, 2, 3, 4]);
        Object.defineProperty(mockWasmData, 'length', { value: 5, writable: false });
        vi.mocked(fs.readFile).mockResolvedValue(mockWasmData as any);

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();
        // second call uses cache
        const mod2 = await initializeHeifModule();
        expect(mod2).toBe(mod);
    });

    it("uses resources directory fallback when default init fails", async () => {
        // Make default init fail once
        const create = (await import("@saschazar/wasm-heif")).default as unknown as ReturnType<
            typeof vi.fn
        >;
        (create as any).mockRejectedValueOnce(new Error("default init failed"));

        vi.mocked(fs.pathExists).mockResolvedValue(true as any);
        const mockWasmData = new Uint8Array([0, 1, 2, 3, 4]);
        Object.defineProperty(mockWasmData, 'length', { value: 5, writable: false });
        vi.mocked(fs.readFile).mockResolvedValue(mockWasmData as any);

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();

        // This test validates that the fallback mechanism works using resources directory
        // which is packaged by Electron in both development and production environments
    });

    it("falls back to default init when resources directory not available", async () => {
        // Make pathExists return false (no resources directory)
        vi.mocked(fs.pathExists).mockResolvedValue(false as any);

        // Default init succeeds
        const create = (await import("@saschazar/wasm-heif")).default as unknown as ReturnType<
            typeof vi.fn
        >;
        (create as any).mockResolvedValue({ decode: vi.fn(), dimensions: vi.fn() });

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();
    });

    it("throws error when no wasm file found in any location", async () => {
        // Make all pathExists calls return false
        vi.mocked(fs.pathExists).mockResolvedValue(false as any);

        // Also make the default initialization fail
        const create = (await import("@saschazar/wasm-heif")).default as unknown as ReturnType<
            typeof vi.fn
        >;
        (create as any).mockRejectedValue(new Error("default init failed"));

        await expect(initializeHeifModule()).rejects.toThrow(
            "HEIF WASM module not found in any expected location",
        );
    });

    it("supports production environment ASAR paths with resources directory", async () => {
        // Make default init fail once, then succeed for wasmBinary
        const create = (await import("@saschazar/wasm-heif")).default as unknown as ReturnType<
            typeof vi.fn
        >;
        (create as any)
            .mockRejectedValueOnce(new Error("default init failed"))
            .mockResolvedValueOnce({ decode: vi.fn(), dimensions: vi.fn() });

        // Mock pathExists to return true for ASAR unpacked resources path
        vi.mocked(fs.pathExists).mockImplementation(async (path: string) => {
            const pathStr = String(path);
            // Support both Windows and Mac ASAR unpacked paths
            if (
                pathStr.includes("app.asar.unpacked") &&
                pathStr.includes("resources") &&
                pathStr.includes("wasm_heif.wasm")
            ) {
                return true as any;
            }
            return false as any;
        });

        const mockWasmData = new Uint8Array([0, 1, 2, 3, 4]);
        Object.defineProperty(mockWasmData, 'length', { value: 5, writable: false });
        vi.mocked(fs.readFile).mockResolvedValue(mockWasmData as any);

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();

        // This test validates that the fallback mechanism works for production ASAR environment
        // using the simplified resources directory approach on both Windows and Mac
    });

    it("handles universal ASAR path correctly", async () => {
        const create = (await import("@saschazar/wasm-heif")).default as unknown as ReturnType<
            typeof vi.fn
        >;
        (create as any)
            .mockRejectedValueOnce(new Error("default init failed"))
            .mockResolvedValueOnce({ decode: vi.fn(), dimensions: vi.fn() });

        // Mock pathExists to return true for universal ASAR path
        vi.mocked(fs.pathExists).mockImplementation(async (path: string) => {
            const pathStr = String(path);
            // Universal ASAR path: appPath/resources/app.asar.unpacked/resources/wasm_heif.wasm
            if (
                pathStr.includes("resources") &&
                pathStr.includes("app.asar.unpacked") &&
                pathStr.includes("wasm_heif.wasm")
            ) {
                return true as any;
            }
            return false as any;
        });

        const mockWasmData = new Uint8Array([1, 2, 3, 4, 5]);
        Object.defineProperty(mockWasmData, 'length', { value: 5, writable: false });
        vi.mocked(fs.readFile).mockResolvedValue(mockWasmData as any);

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();
    });

    it("handles Mac-style ASAR path as fallback", async () => {
        const create = (await import("@saschazar/wasm-heif")).default as unknown as ReturnType<
            typeof vi.fn
        >;
        (create as any)
            .mockRejectedValueOnce(new Error("default init failed"))
            .mockRejectedValueOnce(new Error("Windows path failed"))
            .mockResolvedValueOnce({ decode: vi.fn(), dimensions: vi.fn() });

        // Mock pathExists to return true for Mac-style ASAR path
        vi.mocked(fs.pathExists).mockImplementation(async (path: string) => {
            const pathStr = String(path);
            // Mac-style ASAR path: appPath/../app.asar.unpacked/resources/wasm_heif.wasm
            if (
                pathStr.includes("app.asar.unpacked") &&
                pathStr.includes("resources") &&
                pathStr.includes("wasm_heif.wasm") &&
                pathStr.includes("..") // Mac path uses ..
            ) {
                return true as any;
            }
            return false as any;
        });

        const mockWasmData = new Uint8Array([5, 4, 3, 2, 1]);
        Object.defineProperty(mockWasmData, 'length', { value: 5, writable: false });
        vi.mocked(fs.readFile).mockResolvedValue(mockWasmData as any);

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();
    });

    it("handles Windows path format in resources directory", async () => {
        // Make default init fail once, then succeed for wasmBinary
        const create = (await import("@saschazar/wasm-heif")).default as unknown as ReturnType<
            typeof vi.fn
        >;
        (create as any)
            .mockRejectedValueOnce(new Error("default init failed"))
            .mockResolvedValueOnce({ decode: vi.fn(), dimensions: vi.fn() });

        // Mock pathExists to return true for Windows-style path
        vi.mocked(fs.pathExists).mockImplementation(async (path: string) => {
            const pathStr = String(path);
            // Windows paths with backslashes and C: drive
            if (pathStr.includes("resources") && pathStr.includes("wasm_heif.wasm")) {
                return true as any;
            }
            return false as any;
        });

        const mockWasmData = new Uint8Array([1, 2, 3, 4, 5]);
        Object.defineProperty(mockWasmData, 'length', { value: 5, writable: false });
        vi.mocked(fs.readFile).mockResolvedValue(mockWasmData as any);

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();

        // This test validates Windows path handling in resources directory
    });

    it("handles Mac path format in resources directory", async () => {
        // Make default init fail once, then succeed for wasmBinary
        const create = (await import("@saschazar/wasm-heif")).default as unknown as ReturnType<
            typeof vi.fn
        >;
        (create as any)
            .mockRejectedValueOnce(new Error("default init failed"))
            .mockResolvedValueOnce({ decode: vi.fn(), dimensions: vi.fn() });

        // Mock pathExists to return true for Mac-style path
        vi.mocked(fs.pathExists).mockImplementation(async (path: string) => {
            const pathStr = String(path);
            // Mac paths starting with /Volumes or /Users
            if (
                (pathStr.startsWith("/") || pathStr.includes("Volumes")) &&
                pathStr.includes("resources") &&
                pathStr.includes("wasm_heif.wasm")
            ) {
                return true as any;
            }
            return false as any;
        });

        const mockWasmData = new Uint8Array([5, 4, 3, 2, 1]);
        Object.defineProperty(mockWasmData, 'length', { value: 5, writable: false });
        vi.mocked(fs.readFile).mockResolvedValue(mockWasmData as any);

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();

        // This test validates Mac path handling in resources directory
    });
});
