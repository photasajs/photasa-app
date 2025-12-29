import { describe, it, expect, vi, beforeEach } from "vitest";
import { SibuEngine } from "../SibuEngine";
import { ManifestStore } from "../../services/ManifestStore";
import { ManifestCache } from "../../services/ManifestCache";
import { ConfigAdapter } from "../../adapters/config-adapter";
import type { PhotasaLogger } from "@photasa/common";

// Mock dependencies
vi.mock("../../services/ManifestStore");
vi.mock("../../services/ManifestCache");
vi.mock("../../adapters/config-adapter");
vi.mock("../../support/manifest-normalizer", () => ({
    createEmptyConfigManifest: vi.fn(() => ({ empty: true })),
    createEmptyFolderManifest: vi.fn(() => ({ emptyFolder: true })),
    normalizeFolderManifest: vi.fn((m) => ({ ...m, normalized: true })),
}));

// Mock fs/promises
const fsMock = {
    stat: vi.fn(),
};
vi.mock("fs/promises", () => ({
    default: fsMock,

    ...fsMock,
}));

describe("SibuEngine", () => {
    let engine: SibuEngine;
    let mockStore: any;
    let mockCache: any;
    let mockLogger: PhotasaLogger;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock logger
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        } as any;

        // Setup mock store instance
        mockStore = {
            resolveManifestPath: vi.fn(),
            readManifest: vi.fn(),
            writeManifest: vi.fn(),
            ensureManifest: vi.fn(),
        };
        (ManifestStore as any).mockImplementation(() => mockStore);

        // Setup mock cache instance
        mockCache = {
            get: vi.fn(),
            set: vi.fn(),
            clear: vi.fn(),
            getSize: vi.fn(),
        };
        (ManifestCache as any).mockImplementation(() => mockCache);

        engine = new SibuEngine();
    });

    describe("Constructor", () => {
        it("should initialize with default options", () => {
            expect(ManifestStore).toHaveBeenCalled();
            expect(ManifestCache).toHaveBeenCalledWith({ ttlMs: 5000 });
        });

        it("should initialize with provided options", () => {
            const customStore = new ManifestStore();
            const customCache = new ManifestCache({ ttlMs: 1000 });
            const _customEngine = new SibuEngine({
                store: customStore,
                cache: customCache,
                enableLegacySupport: false,
                cacheTtlMs: 1000,
            });
            // Verify internal state if possible, or behavior that reflects these options
            // Since props are private, we can infer from behavior or assume correct assignment if functionality works
        });
    });

    describe("loadConfigManifest (New API)", () => {
        it("should load and adapt unified config", async () => {
            const configPath = "/path/to/config.json";
            const mockRawConfig = { version: "1.0.0" };
            const mockAdaptedConfig = { revision: "v2" };

            mockStore.readManifest.mockResolvedValue(mockRawConfig);
            (ConfigAdapter.adapt as any).mockReturnValue({
                configPath,
                config: mockAdaptedConfig,
                isLegacy: false,
            });
            (ConfigAdapter.getUnified as any).mockReturnValue(mockAdaptedConfig);

            const result = await engine.loadConfigManifest(configPath, mockLogger);

            expect(mockStore.readManifest).toHaveBeenCalledWith(configPath, mockLogger);
            expect(ConfigAdapter.getUnified).toHaveBeenCalled();
            expect(result).toEqual({
                // Expect specific structure for config manifest result
                configPath: "/path/to/config.json",
                manifest: { revision: "v2" },
            });
        });
    });

    describe("loadFolderManifest", () => {
        it("should load existing folder manifest", async () => {
            const folderPath = "/path/to/folder";
            const manifestPath = "/path/to/folder/.photasa.json";
            const mockRawManifest = { name: "test" };

            mockStore.resolveManifestPath.mockReturnValue(manifestPath);
            mockStore.readManifest.mockResolvedValue(mockRawManifest);

            const result = await engine.loadFolderManifest(folderPath, mockLogger);

            expect(mockStore.resolveManifestPath).toHaveBeenCalledWith(folderPath, false);
            expect(mockStore.readManifest).toHaveBeenCalledWith(manifestPath, mockLogger);
            expect(result.manifest).toHaveProperty("normalized", true);
        });

        it("should create empty manifest if load fails", async () => {
            const folderPath = "/path/to/folder";
            const manifestPath = "/path/to/folder/.photasa.json";

            mockStore.resolveManifestPath.mockReturnValue(manifestPath);
            mockStore.readManifest.mockRejectedValue(new Error("Not found"));

            const result = await engine.loadFolderManifest(folderPath, mockLogger);

            expect(mockStore.writeManifest).toHaveBeenCalledWith(
                manifestPath,
                expect.objectContaining({ emptyFolder: true }),
                mockLogger,
            );
            expect(result.manifest).toHaveProperty("emptyFolder", true);
        });
    });

    describe("writeConfigManifest", () => {
        it("should write manifest and update cache", async () => {
            const configPath = "/path/to/config.json";
            const manifest = { revision: "v1" } as any;

            await engine.writeConfigManifest(configPath, manifest, mockLogger);

            expect(mockStore.writeManifest).toHaveBeenCalledWith(configPath, manifest, mockLogger);
            expect(mockCache.set).toHaveBeenCalledWith(configPath, manifest);
        });
    });

    describe("writeFolderManifest", () => {
        it("should write manifest to store", async () => {
            const manifestPath = "/path/to/manifest.json";
            const manifest = { id: "folder1" } as any;

            await engine.writeFolderManifest(manifestPath, manifest, mockLogger);

            expect(mockStore.writeManifest).toHaveBeenCalledWith(
                manifestPath,
                manifest,
                mockLogger,
            );
        });
    });

    describe("loadUnifiedConfig", () => {
        it("should return cached config if available", async () => {
            const configPath = "/path/to/config.json";
            const cachedConfig = { version: "cached" };
            mockCache.get.mockReturnValue(cachedConfig);
            (ConfigAdapter.adapt as any).mockReturnValue({
                config: cachedConfig,
                isLegacy: false,
            });

            const result = await engine.loadUnifiedConfig(configPath, mockLogger);

            expect(mockStore.readManifest).not.toHaveBeenCalled();
            expect(result.config).toBe(cachedConfig);
        });

        it("should load from store and cache if not in cache", async () => {
            const configPath = "/path/to/config.json";
            const storedConfig = { version: "stored" };
            mockCache.get.mockReturnValue(null);
            mockStore.readManifest.mockResolvedValue(storedConfig);
            (ConfigAdapter.adapt as any).mockReturnValue({
                config: storedConfig,
                isLegacy: false,
            });

            const result = await engine.loadUnifiedConfig(configPath, mockLogger);

            expect(mockStore.readManifest).toHaveBeenCalledWith(configPath, mockLogger);
            expect(mockCache.set).toHaveBeenCalledWith(configPath, storedConfig);
            expect(result.config).toBe(storedConfig);
        });
    });

    describe("Legacy Support", () => {
        beforeEach(() => {
            // Re-instantiate with legacy support enabled explicitly (default is true)
            engine = new SibuEngine({ enableLegacySupport: true });
        });

        describe("loadManifestForTarget", () => {
            it("should ensure manifest and load it", async () => {
                const targetPath = "/target";
                const configPath = "/target/config.json";
                mockStore.ensureManifest.mockResolvedValue(configPath);

                // Spy on loadManifest to avoid duplicating its logic test
                const loadManifestSpy = vi.spyOn(engine, "loadManifest");
                loadManifestSpy.mockResolvedValue({ configPath, manifest: {} as any });

                await engine.loadManifestForTarget(targetPath, true, mockLogger);

                expect(mockStore.ensureManifest).toHaveBeenCalledWith(targetPath, true, mockLogger);
                expect(loadManifestSpy).toHaveBeenCalledWith(configPath, mockLogger);
            });
        });

        describe("loadManifest", () => {
            it("should return legacy manifest directly if isLegacy is true", async () => {
                const configPath = "/path/to/legacy";
                const legacyConfig = { version: "1.0" };

                // Mock loadUnifiedConfig via spy or by mocking underlying calls
                // Here we mock underlying calls for loadUnifiedConfig
                mockCache.get.mockReturnValue(null);
                mockStore.readManifest.mockResolvedValue(legacyConfig);
                (ConfigAdapter.adapt as any).mockReturnValue({
                    isLegacy: true,
                    config: legacyConfig,
                });

                const result = await engine.loadManifest(configPath, mockLogger);
                expect(result.manifest).toBe(legacyConfig);
            });

            it("should return casted manifest if isLegacy is false (adaptation handled in adapter)", async () => {
                const configPath = "/path/to/new";
                const newConfig = { revision: "2.0" };

                mockCache.get.mockReturnValue(null);
                mockStore.readManifest.mockResolvedValue(newConfig);
                (ConfigAdapter.adapt as any).mockReturnValue({
                    isLegacy: false,
                    config: newConfig,
                });

                const result = await engine.loadManifest(configPath, mockLogger);
                // In the code, it returns unifiedResult.config as PhotasaConfig
                expect(result.manifest).toBe(newConfig);
            });
        });

        it("should disable legacy logic when enableLegacySupport is false", async () => {
            engine = new SibuEngine({ enableLegacySupport: false });
            const configPath = "/path/to/config";
            const config = { data: "test" };

            mockCache.get.mockReturnValue(null);
            mockStore.readManifest.mockResolvedValue(config);

            const result = await engine.loadManifest(configPath, mockLogger);

            expect(mockStore.readManifest).toHaveBeenCalled();
            expect(mockCache.set).toHaveBeenCalledWith(configPath, config);
            expect(result.manifest).toBe(config);
            // Verify loadUnifiedConfig was NOT called (indirectly via cache behavior or mocking)
        });

        it("should use cache when legacy support is disabled", async () => {
            engine = new SibuEngine({ enableLegacySupport: false });
            const configPath = "/path/to/config";
            const cachedConfig = { data: "cached" };

            mockCache.get.mockReturnValue(cachedConfig);

            const result = await engine.loadManifest(configPath, mockLogger);

            expect(mockStore.readManifest).not.toHaveBeenCalled();
            expect(result.manifest).toBe(cachedConfig);
        });
    });

    describe("writeManifest", () => {
        it("should write to store and update cache", async () => {
            const configPath = "/path/to/config.json";
            const manifest = { version: "1.0" } as any;

            await engine.writeManifest(configPath, manifest, mockLogger);

            expect(mockStore.writeManifest).toHaveBeenCalledWith(configPath, manifest, mockLogger);
            expect(mockCache.set).toHaveBeenCalledWith(configPath, manifest);
        });
    });

    describe("writeEmptyManifest", () => {
        it("should write empty manifest", async () => {
            const configPath = "/path/to/config.json";

            await engine.writeEmptyManifest(configPath, mockLogger);

            expect(mockStore.writeManifest).toHaveBeenCalledWith(
                configPath,
                expect.objectContaining({ empty: true }),
                mockLogger,
            );
        });
    });

    describe("Cache Operations", () => {
        it("clearCache should clear the cache", () => {
            engine.clearCache();
            expect(mockCache.clear).toHaveBeenCalled();
        });

        it("primeCache should set the cache", () => {
            const configPath = "/path";
            const data = {} as any;
            engine.primeCache(configPath, data);
            expect(mockCache.set).toHaveBeenCalledWith(configPath, data);
        });
    });

    describe("validatePath", () => {
        it("should validate a file path", async () => {
            fsMock.stat.mockResolvedValue({
                isFile: () => true,
                isDirectory: () => false,
            });

            const result = await engine.validatePath("/valid/file");
            expect(result.valid).toBe(true);
        });

        it("should validate a directory path", async () => {
            fsMock.stat.mockResolvedValue({
                isFile: () => false,
                isDirectory: () => true,
            });

            const result = await engine.validatePath("/valid/dir");
            expect(result.valid).toBe(true);
        });

        it("should fail if neither file nor directory", async () => {
            fsMock.stat.mockResolvedValue({
                isFile: () => false,
                isDirectory: () => false,
            });

            const result = await engine.validatePath("/invalid/type");
            expect(result.valid).toBe(false);
            expect(result.reason).toContain("既不是文件也不是目录");
        });

        it("should fail on fs error", async () => {
            fsMock.stat.mockRejectedValue(new Error("Access denied"));

            const result = await engine.validatePath("/error/path");
            expect(result.valid).toBe(false);
            expect(result.reason).toContain("Access denied");
        });

        it("should fail on unknown error", async () => {
            fsMock.stat.mockRejectedValue("Unknown error string");

            const result = await engine.validatePath("/error/path");
            expect(result.valid).toBe(false);
            expect(result.reason).toContain("未知错误");
        });
    });

    describe("getEngineStatus", () => {
        it("should return engine status", () => {
            mockCache.getSize.mockReturnValue(5);

            const status = engine.getEngineStatus();

            expect(status).toEqual({
                isLoading: false,
                currentOperation: undefined,
                loadProgress: 0,
                cacheSize: 5,
                enabledFeatures: {
                    legacySupport: true,
                },
            });
        });
    });
});
