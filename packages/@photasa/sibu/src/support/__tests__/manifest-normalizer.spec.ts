import { describe, it, expect } from "vitest";
import {
    generateRevision,
    normalizeConfigManifest,
    normalizeFolderManifest,
    createEmptyConfigManifest,
    createEmptyFolderManifest,
    createEmptyManifest,
    normalizeManifest,
} from "../manifest-normalizer";

describe("manifest-normalizer", () => {
    describe("generateRevision", () => {
        it("should generate a string with UUID and timestamp", () => {
            const revision = generateRevision();
            expect(typeof revision).toBe("string");
            expect(revision.split("-").length).toBeGreaterThan(1);
        });
    });

    describe("normalizeConfigManifest", () => {
        it("should normalize empty input to default config", () => {
            const manifest = normalizeConfigManifest({});
            expect(manifest).toHaveProperty("revision");
            expect(manifest).toHaveProperty("updatedAt");
            expect(manifest.profiles).toEqual([]);
            expect(manifest.scanPolicy).toBeDefined();
            expect(manifest.scanPolicy?.id).toBe("default");
            expect(manifest.syncState?.status).toBe("idle");
        });

        it("should preserve valid input values", () => {
            const input = {
                revision: "rev-1",
                updatedAt: 1234567890,
                scanningFoldersSnapshot: ["/tmp"],
                overrides: { foo: "bar" },
            };
            const manifest = normalizeConfigManifest(input);
            expect(manifest.revision).toBe("rev-1");
            expect(manifest.updatedAt).toBe(1234567890);
            expect(manifest.scanningFoldersSnapshot).toEqual(["/tmp"]);
            expect(manifest.overrides).toEqual({ foo: "bar" });
        });

        it("should normalize watch profiles", () => {
            const profiles = [
                { id: "p1", rootPath: "/path/1" }, // valid
                { rootPath: "" }, // invalid, should be filtered out
                { rootPath: "/path/2", recursive: false, ignore: ["node_modules"] },
            ] as any;

            const manifest = normalizeConfigManifest({ profiles });
            expect(manifest.profiles).toHaveLength(2);
            expect(manifest.profiles[0].id).toBe("p1");
            expect(manifest.profiles[1].id).toBeDefined(); // generated uuid
            expect(manifest.profiles[1].recursive).toBe(false);
            expect(manifest.profiles[1].ignore).toEqual(["node_modules"]);
        });

        it("should normalize scan policy", () => {
            const scanPolicy = {
                id: "custom",
                smartRefresh: { mtimeToleranceMs: 500 },
            } as any;

            const manifest = normalizeConfigManifest({ scanPolicy });
            expect(manifest.scanPolicy?.id).toBe("custom");
            expect(manifest.scanPolicy?.smartRefresh.mtimeToleranceMs).toBe(500);
            expect(manifest.scanPolicy?.smartRefresh.thumbnailTtlMs).toBeDefined(); // keeps default
        });
    });

    describe("normalizeFolderManifest", () => {
        it("should normalize empty input", () => {
            const manifest = normalizeFolderManifest({});
            expect(manifest.folderId).toBeDefined();
            expect(manifest.revision).toBeDefined();
            expect(manifest.rootPath).toBe("");
            expect(manifest.mediaIndex).toEqual([]);
            expect(manifest.subfolders).toEqual([]);
            expect(manifest.stats).toEqual({ fileCount: 0, folderCount: 0 });
            expect(manifest.version).toBe(1);
        });

        it("should normalize media index", () => {
            const mediaIndex = [
                { relativePath: "a.jpg", mediaType: "image" },
                { relativePath: "" }, // invalid
                null, // invalid
            ] as any;

            const manifest = normalizeFolderManifest({ mediaIndex });
            expect(manifest.mediaIndex).toHaveLength(1);
            expect(manifest.mediaIndex[0].relativePath).toBe("a.jpg");
            expect(manifest.mediaIndex[0].mediaType).toBe("image");
            expect(manifest.mediaIndex[0].lastModified).toBe(0); // default
        });

        it("should normalize stats", () => {
            const stats = { fileCount: 10 } as any;
            const manifest = normalizeFolderManifest({ stats });
            expect(manifest.stats.fileCount).toBe(10);
            expect(manifest.stats.folderCount).toBe(0); // default
        });

        it("should normalize media index with default type", () => {
            const mediaIndex = [{ relativePath: "x.bin" }] as any;
            const manifest = normalizeFolderManifest({ mediaIndex });
            expect(manifest.mediaIndex[0].mediaType).toBe("other");
        });
    });

    // ... createEmptyConfigManifest ...

    describe("normalizeScanPolicy", () => {
        // Can't export normalizeScanPolicy directly as it is not exported.
        // But we can test via normalizeConfigManifest.
        it("should normalize partial scan policy", () => {
            const scanPolicy = { version: "custom" } as any; // No ID
            const manifest = normalizeConfigManifest({ scanPolicy });
            expect(manifest.scanPolicy?.id).toBe("default");
            expect(manifest.scanPolicy?.version).toBe("custom");
        });
    });

    describe("createEmptyConfigManifest", () => {
        it("should create a valid default config", () => {
            const manifest = createEmptyConfigManifest();
            expect(manifest.profiles).toEqual([]);
            expect(manifest.revision).toBeDefined();
        });
    });

    describe("createEmptyFolderManifest", () => {
        it("should create a valid folder manifest with root path", () => {
            const manifest = createEmptyFolderManifest("/root/path");
            expect(manifest.rootPath).toBe("/root/path");
            expect(manifest.folderId).toBeDefined();
        });
    });

    describe("Legacy Support", () => {
        it("createEmptyManifest should return legacy format", () => {
            const legacy = createEmptyManifest();
            expect(legacy.version).toBe("1.0");
            expect(legacy.photoList).toEqual([]);
        });

        it("normalizeManifest should normalize legacy config", () => {
            const input = { version: "0.9", photoList: [{ path: "/p1" }] } as any;
            const normalized = normalizeManifest(input);
            expect(normalized.version).toBe("0.9");
            expect(normalized.photoList).toHaveLength(1);
        });

        it("normalizeManifest should handle missing fields", () => {
            const normalized = normalizeManifest({});
            expect(normalized.version).toBe("1.0");
            expect(normalized.photoList).toEqual([]);
            expect(normalized.lastModified).toBeDefined();
        });
    });
});
