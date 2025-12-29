import { describe, it, expect, vi, beforeEach } from "vitest";
import { ManifestStore } from "../ManifestStore";
import { promises as fsp } from "fs";

// Mock fs/promises
vi.mock("fs", () => ({
    promises: {
        access: vi.fn(),
        writeFile: vi.fn(),
    },
}));

describe("ManifestStore", () => {
    let store: ManifestStore;
    let mockReader: any;
    let mockLogger: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockReader = {
            read: vi.fn(),
        };

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        store = new ManifestStore({ reader: mockReader });
    });

    describe("Constructor", () => {
        it("should use default reader if not provided", () => {
            const defaultStore = new ManifestStore();
            expect(defaultStore).toBeDefined();
        });
    });

    describe("resolveManifestPath", () => {
        it("should resolve for file target", () => {
            const result = store.resolveManifestPath("/path/to/file.txt", true);
            expect(result).toBe("/path/to/.photasa.json"); // Since path.dirname("/path/to/file.txt") is "/path/to"
            // Verify cross-platform path carefully if needed, simpler here
        });

        it("should resolve for directory target", () => {
            const result = store.resolveManifestPath("/path/to/dir", false);
            expect(result).toBe("/path/to/dir/.photasa.json");
        });
    });

    describe("ensureManifest", () => {
        it("should return path if manifest exists", async () => {
            (fsp.access as any).mockResolvedValue(undefined);
            const path = "/dir";
            const result = await store.ensureManifest(path, false, mockLogger);
            expect(result).toBe("/dir/.photasa.json");
            expect(fsp.writeFile).not.toHaveBeenCalled();
        });

        it("should create empty manifest if missing", async () => {
            (fsp.access as any).mockRejectedValue(new Error("ENOENT"));
            const path = "/dir";

            // Mock writeManifest to avoid actual FS call details in this test unit,
            // but here we are integration-testing the flow calling writeManifest
            // Since writeManifest uses fsp.writeFile, we mock that.

            const result = await store.ensureManifest(path, false, mockLogger);

            expect(fsp.writeFile).toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("missing, auto create"),
            );
            expect(result).toBe("/dir/.photasa.json");
        });
    });

    describe("readManifest", () => {
        it("should read and normalize manifest", async () => {
            const raw = { version: "1.0", photoList: [] };
            mockReader.read.mockResolvedValue(raw);

            const result = await store.readManifest("/path", mockLogger);

            expect(mockReader.read).toHaveBeenCalledWith("/path", mockLogger);
            expect(result).toEqual(expect.objectContaining(raw));
        });
    });

    describe("writeManifest", () => {
        it("should write normalized manifest", async () => {
            const manifest = { version: "1.0", photoList: [] } as any;
            await store.writeManifest("/path", manifest, mockLogger);

            expect(fsp.writeFile).toHaveBeenCalledWith("/path", expect.any(String), "utf8");
            expect(mockLogger.info).toHaveBeenCalled();
        });
    });
});
