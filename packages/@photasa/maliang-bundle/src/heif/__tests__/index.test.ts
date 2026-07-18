import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

// Use vi.hoisted to ensure these are initialized before the mock factory runs
const { mockPathExists, mockReadFile } = vi.hoisted(() => {
    return {
        mockPathExists: vi.fn(),
        mockReadFile: vi.fn(),
    };
});

vi.mock("fs-extra", async () => {
    const actual = await vi.importActual<any>("fs-extra");
    return {
        ...actual,
        pathExists: mockPathExists,
        readFile: mockReadFile,
        // Critical: Mock default export for "import fs from 'fs-extra'" usage
        default: {
            ...actual.default,
            pathExists: mockPathExists,
            readFile: mockReadFile,
        },
    };
});

vi.mock("@photasa/common", () => ({
    getLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    })),
}));

// Wrap the real module to allow spying on calls
vi.mock("@saschazar/wasm-heif", async () => {
    const actual = await vi.importActual<any>("@saschazar/wasm-heif");
    return {
        default: vi.fn().mockImplementation(actual.default),
    };
});

import { initializeHeifModule, resetHeifModule } from "../index";

import { createRequire } from "module";

// ... mock definitions ...

describe("heif-module", () => {
    let realWasmBuffer: Buffer;
    let createHeifModule: any;

    beforeAll(async () => {
        const realFs = await vi.importActual<typeof import("fs-extra")>("fs-extra");

        try {
            const require = createRequire(import.meta.url);
            const wasmPath = require.resolve("@saschazar/wasm-heif/wasm_heif.wasm");

            realWasmBuffer = await realFs.readFile(wasmPath);
            if (!realWasmBuffer || realWasmBuffer.length === 0) {
                throw new Error("Read empty buffer");
            }
        } catch (e) {
            console.warn("Could not load real WASM file via require.resolve, using fallback", e);
            // Verify if we can find it via relative path as last resort or fail
            realWasmBuffer = Buffer.from([]);
        }

        // Get the mocked (wrapped) function for assertions
        createHeifModule = (await import("@saschazar/wasm-heif")).default;
    });

    beforeEach(() => {
        resetHeifModule();
        vi.clearAllMocks();
        // Reset default behaviors
        mockPathExists.mockReset();
        mockReadFile.mockReset();

        // Suppress console.error/warn to hide Emscripten/WASM noise during intentional failures
        vi.spyOn(console, "error").mockImplementation(() => {
            /* no-op */
        });
        vi.spyOn(console, "warn").mockImplementation(() => {
            /* no-op */
        });
    });

    afterEach(() => {
        vi.restoreAllMocks(); // Restore console mocks
    });

    it("caches module after first init", async () => {
        // Mock pathExists to return true for resources directory
        mockPathExists.mockResolvedValue(true as any);
        mockReadFile.mockResolvedValue(realWasmBuffer as any);

        const m1 = await initializeHeifModule();
        const m2 = await initializeHeifModule();

        // 验证模块被正确缓存
        expect(m1).toBe(m2);
        expect(m1).toBeTruthy();
        // Since we use real module and real binary, these properties should exist!
        expect(m1).toHaveProperty("decode");
        expect(m1).toHaveProperty("dimensions");
    });

    it("uses resources directory as primary method", async () => {
        mockPathExists.mockResolvedValue(true as any);
        mockReadFile.mockResolvedValue(realWasmBuffer as any);

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();

        // Verify we passed the binary to the factory
        expect(createHeifModule).toHaveBeenCalledWith(
            expect.objectContaining({
                wasmBinary: expect.any(Object), // Buffer or Uint8Array
            }),
        );
    });

    it("attempts fallback to default init when resource loading fails (invalid binary)", async () => {
        // 1. Find file
        mockPathExists.mockResolvedValue(true as any);
        // 2. Read invalid data (forces factory to throw)
        mockReadFile.mockResolvedValue(Buffer.from("invalid wasm data") as any);

        // Expectation:
        // 1. Try resource -> fail
        // 2. Try default init -> probably fail in this env, but we check THAT IT TRIED.

        try {
            await initializeHeifModule();
        } catch (e) {
            // Expected to throw eventually because default init also fails in test env
        }

        // Check call definitions to confirm fallback logic
        // Expect many calls because we mocked pathExists=true for ALL paths, so it tries every single one
        expect(createHeifModule.mock.calls.length).toBeGreaterThan(2);

        // Verify the LAST call was the default init (no arguments)
        expect(createHeifModule).toHaveBeenLastCalledWith();

        // Verify at least one previous call had the binary
        expect(createHeifModule).toHaveBeenCalledWith(
            expect.objectContaining({ wasmBinary: expect.any(Object) }),
        );
    });

    it("throws error when no wasm file found and default init fails", async () => {
        // Make all pathExists calls return false
        mockPathExists.mockResolvedValue(false as any);

        // 验证抛出正确的错误
        await expect(initializeHeifModule()).rejects.toThrow(
            "HEIF WASM module not found in any expected location",
        );

        // Should have tried default init last
        expect(createHeifModule).toHaveBeenCalledTimes(1);
        expect(createHeifModule).toHaveBeenCalledWith();
    });

    it("supports production environment ASAR paths", async () => {
        // Only mock pathExists to be true for the specific ASAR path we care about
        mockPathExists.mockImplementation(async (path: string) => {
            const pathStr = String(path);
            if (pathStr.includes("app.asar.unpacked") && pathStr.includes("resources")) {
                return true as any;
            }
            return false as any;
        });
        mockReadFile.mockResolvedValue(realWasmBuffer as any);

        const mod = await initializeHeifModule();
        expect(mod).toBeTruthy();
    });

    it("validates Windows/Mac specific path checks", async () => {
        // Mock pathExists to capture checked paths
        const checkedPaths: string[] = [];
        mockPathExists.mockImplementation(async (p: string) => {
            checkedPaths.push(String(p));
            return false as any; // Fail all to ensure exhaustive check
        });

        await expect(initializeHeifModule()).rejects.toThrow();

        // Verify that various strategies were checked
        const joinedPath = checkedPaths.join("\n");
        // Check for resources path (Strategy 1)
        expect(joinedPath).toContain("wasm_heif.wasm");
        // Check for node_modules fallback (Strategy 8)
        expect(joinedPath).toContain("node_modules");
    });
});
