import { describe, it, expect } from "vitest";
import {
    ConfigAdapter,
    adaptLegacyConfig,
    adaptToLegacyConfig,
    isLegacyConfig,
} from "../config-adapter";
import type { PhotasaConfig } from "@photasa/common";

describe("ConfigAdapter", () => {
    describe("adaptLegacyConfig", () => {
        it("should adapt legacy config to new format", () => {
            const legacyConfig: PhotasaConfig = {
                version: "1.0",
                lastModified: 1000,
                photoList: [
                    { path: "/photos/a.jpg", thumbnail: "", isVideo: false },
                    { path: "/photos/b.jpg", thumbnail: "", isVideo: false },
                    { path: "/other/c.jpg", thumbnail: "", isVideo: false },
                ],
            };

            const manifest = adaptLegacyConfig(legacyConfig);

            // Verify basic fields
            expect(manifest.overrides?.legacyVersion).toBe("1.0");
            expect(manifest.overrides?.legacyPhotoCount).toBe(3);
            expect(manifest.history?.[0]?.summary).toContain("包含3个照片记录");

            // Verify inferred profiles (folders)
            expect(manifest.profiles).toHaveLength(2);
            expect(manifest.profiles.map((p) => p.rootPath)).toEqual(["/other", "/photos"]); // Sorted

            // Verify snapshot
            expect(manifest.scanningFoldersSnapshot).toEqual(["/other", "/photos"]);

            // Ensure we cover the map callback for profiles implicitly by checking the result,
            // but also maybe we need to ensure some fields are default initialized?
            // "createdAt: Date.now()" etc.
            // Verify snapshot
            expect(manifest.scanningFoldersSnapshot).toEqual(["/other", "/photos"]);

            const profile = manifest.profiles[0];
            expect(profile.createdAt).toBeLessThanOrEqual(Date.now());
        });

        it("should handle undefined photoList", () => {
            const legacy: any = { version: "1.0", lastModified: 100 };
            const manifest = adaptLegacyConfig(legacy);
            expect(manifest.scanningFoldersSnapshot).toEqual([]);
            expect(manifest.history?.[0]?.summary).toContain("包含0个照片");
        });

        it("should handle files at root (no slash)", () => {
            const legacy: any = {
                version: "1.0",
                lastModified: 100,
                photoList: [{ path: "rootfile.jpg", thumbnail: "", isVideo: false }],
            };
            const manifest = adaptLegacyConfig(legacy);
            expect(manifest.scanningFoldersSnapshot).toEqual(["/"]);
            expect(manifest.profiles[0].rootPath).toBe("/");
        });

        it("should handle empty photo list", () => {
            const legacyConfig: PhotasaConfig = {
                version: "1.0",
                lastModified: 1000,
                photoList: [],
            };
            const manifest = adaptLegacyConfig(legacyConfig);
            expect(manifest.profiles).toHaveLength(0);
        });
    });

    describe("adaptToLegacyConfig", () => {
        it("should convert new manifest back to legacy format interface", () => {
            const manifest: any = {
                revision: "uuid-1234",
                updatedAt: 2000,
            };

            const legacy = adaptToLegacyConfig(manifest);
            expect(legacy.version).toBe("migrated-uuid-123");
            expect(legacy.lastModified).toBe(2000);
            expect(legacy.photoList).toEqual([]);
        });
    });

    describe("isLegacyConfig", () => {
        it("should identify legacy config", () => {
            const legacy = {
                version: "1.0",
                photoList: [],
                lastModified: 123,
            };
            expect(isLegacyConfig(legacy)).toBe(true);
        });

        it("should reject new config", () => {
            const modern = {
                revision: "v2",
                updatedAt: 123,
                profiles: [],
            };
            expect(isLegacyConfig(modern)).toBe(false); // missing photoList, has revision (if logic checks revision)
        });

        it("should reject invalid objects", () => {
            expect(isLegacyConfig(null)).toBe(false);
            expect(isLegacyConfig({})).toBe(false);
        });
    });

    describe("ConfigAdapter.adapt", () => {
        it("should adapt legacy config", () => {
            const legacy = {
                version: "1.0",
                photoList: [],
                lastModified: 123,
            };
            const result = ConfigAdapter.adapt("/path", legacy);
            expect(result.isLegacy).toBe(true);
            expect(result.config).toBe(legacy);
            expect(result.migrated).toBeDefined();
        });

        it("should adapt modern config", () => {
            const modern = {
                revision: "v2",
                // partial for normalization
            };
            const result = ConfigAdapter.adapt("/path", modern);
            expect(result.isLegacy).toBe(false);
            expect(result.config).toHaveProperty("revision"); // normalized
        });
    });

    describe("ConfigAdapter.getUnified", () => {
        it("should return migrated config for legacy result", () => {
            const result = {
                configPath: "/path",
                config: {},
                isLegacy: true,
                migrated: { revision: "migrated" } as any,
            };
            const unified = ConfigAdapter.getUnified(result as any);
            expect(unified.revision).toBe("migrated");
        });

        it("should throw if migration missing for legacy result", () => {
            const result = {
                configPath: "/path",
                config: {},
                isLegacy: true,
            };
            expect(() => ConfigAdapter.getUnified(result as any)).toThrow("migration failed");
        });

        it("should return config directly for modern result", () => {
            const result = {
                configPath: "/path",
                config: { revision: "v2" },
                isLegacy: false,
            };
            const unified = ConfigAdapter.getUnified(result as any);
            expect(unified.revision).toBe("v2");
        });
    });
});
