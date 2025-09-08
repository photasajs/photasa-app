import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import fs from "fs-extra";
// import path from "path"; // Unused import removed
import type { PhotasaConfig } from "@common/config-types";

// Mock fs-extra
vi.mock("fs-extra", () => ({
    default: {
        ensureFile: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn(),
    },
}));

// Mock electron API
vi.mock("@electron-toolkit/preload", () => ({
    electronAPI: {
        ipcRenderer: {
            invoke: vi.fn(),
        },
    },
}));

// Mock path utilities
vi.mock("@shared/path-util", () => ({
    shortenThumbnailName: vi.fn((name: string) => name),
    toFileName: vi.fn((path: string) => path.split("/").pop() || path),
}));

// Mock is-video
vi.mock("is-video", () => ({
    default: vi.fn((path: string) => path.endsWith(".mp4")),
}));

// Import after mocking
import {
    ensureConfig,
    readConfig,
    writeConfig,
    fromJson,
    normalizeConfig,
    parseConfig,
    addToPhotoList,
    removeFromPhotoList,
    getPhotasaConfig,
    resetPhotasaConfig,
    fixPhotasaConfig,
} from "../file-config";

const mockFs = vi.mocked(fs);
const mockIpcRenderer = vi.mocked(await import("@electron-toolkit/preload")).electronAPI
    .ipcRenderer;

describe("file-config", () => {
    beforeEach(() => {
        vol.reset();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("ensureConfig", () => {
        it("should create config file for file path", async () => {
            const photoPath = "/test/image.jpg";
            mockFs.ensureFile.mockResolvedValue(undefined);

            const result = await ensureConfig(photoPath, true);

            expect(result).toBe("/test/.photasa.json");
            expect(mockFs.ensureFile).toHaveBeenCalledWith("/test/.photasa.json");
        });

        it("should create config file for directory path", async () => {
            const dirPath = "/test/photos";
            mockFs.ensureFile.mockResolvedValue(undefined);

            const result = await ensureConfig(dirPath, false);

            expect(result).toBe("/test/photos/.photasa.json");
            expect(mockFs.ensureFile).toHaveBeenCalledWith("/test/photos/.photasa.json");
        });

        it("should not create config file when deleting", async () => {
            const photoPath = "/test/image.jpg";

            const result = await ensureConfig(photoPath, true, true);

            expect(result).toBe("/test/.photasa.json");
            expect(mockFs.ensureFile).not.toHaveBeenCalled();
        });
    });

    describe("readConfig", () => {
        it("should read existing config file", async () => {
            const photoPath = "/test/image.jpg";
            const configData = '{"version": "1.0", "photoList": []}';

            mockFs.ensureFile.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(configData);

            const result = await readConfig(photoPath, true);

            expect(result.dir).toBe("/test/.photasa.json");
            expect(result.data).toBe(configData);
        });

        it("should return empty object for non-existent config", async () => {
            const photoPath = "/test/image.jpg";

            mockFs.ensureFile.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue("");

            const result = await readConfig(photoPath, true);

            expect(result.dir).toBe("/test/.photasa.json");
            expect(result.data).toBe("{}");
        });
    });

    describe("writeConfig", () => {
        it("should write config to file", async () => {
            const configPath = "/test/.photasa.json";
            const config: PhotasaConfig = {
                version: "1.0",
                photoList: [],
                lastModified: 1234567890,
            };

            mockFs.writeFile.mockResolvedValue(undefined);

            await writeConfig(configPath, config);

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                configPath,
                JSON.stringify(config, null, 4),
                { encoding: "utf8", flag: "w" },
            );
        });

        it("should not write config when deleting and file doesn't exist", async () => {
            const configPath = "/test/.photasa.json";
            const config: PhotasaConfig = {
                version: "1.0",
                photoList: [],
            };

            mockFs.exists.mockResolvedValue(false);

            await writeConfig(configPath, config, true);

            expect(mockFs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe("fromJson", () => {
        it("should parse valid JSON", () => {
            const json = '{"version": "1.0", "photoList": []}';
            const result = fromJson(json);

            expect(result).toEqual({
                version: "1.0",
                photoList: [],
            });
        });

        it("should return empty object for invalid JSON", () => {
            const json = "invalid json";
            const result = fromJson(json);

            expect(result).toEqual({});
        });
    });

    describe("normalizeConfig", () => {
        it("should add missing photoList", () => {
            const config: PhotasaConfig = {
                version: "1.0",
            };

            const result = normalizeConfig(config);

            expect(result.photoList).toEqual([]);
        });

        it("should add missing version", () => {
            const config: PhotasaConfig = {
                photoList: [],
            };

            const result = normalizeConfig(config);

            expect(result.version).toBe("1.0");
        });

        it("should preserve existing values", () => {
            const config: PhotasaConfig = {
                version: "1.0",
                photoList: [{ path: "test.jpg", isVideo: false }],
            };

            const result = normalizeConfig(config);

            expect(result).toEqual(config);
        });
    });

    describe("parseConfig", () => {
        it("should parse and normalize config", () => {
            const json = '{"photoList": []}';
            const result = parseConfig(json);

            expect(result).toEqual({
                version: "1.0",
                photoList: [],
            });
        });
    });

    describe("addToPhotoList", () => {
        it("should invoke IPC to add photo", async () => {
            const photoPath = "/test/image.jpg";
            mockIpcRenderer.invoke.mockResolvedValue(undefined);

            await addToPhotoList(photoPath);

            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("picasa:add-config", {
                paths: [photoPath],
            });
        });
    });

    describe("removeFromPhotoList", () => {
        it("should remove photo from config", async () => {
            const photoPath = "/test/image.jpg";
            const configData =
                '{"version": "1.0", "photoList": [{"path": "image.jpg", "isVideo": false}]}';

            mockFs.ensureFile.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(configData);
            mockFs.writeFile.mockResolvedValue(undefined);
            mockFs.exists.mockResolvedValue(true); // Config file exists

            const result = await removeFromPhotoList(photoPath);

            expect(result.path).toBe("/test/.photasa.json");
            expect(result.config.photoList).toEqual([]);
            expect(mockFs.writeFile).toHaveBeenCalled();
        });

        it("should not modify config if photo not found", async () => {
            const photoPath = "/test/nonexistent.jpg";
            const configData =
                '{"version": "1.0", "photoList": [{"path": "other.jpg", "isVideo": false}]}';

            mockFs.ensureFile.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(configData);

            const result = await removeFromPhotoList(photoPath);

            expect(result.config.photoList).toHaveLength(1);
            expect(mockFs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe("getPhotasaConfig", () => {
        it("should get config for folder", async () => {
            const folder = "/test/photos";
            const configData = '{"version": "1.0", "photoList": []}';

            mockFs.ensureFile.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(configData);

            const result = await getPhotasaConfig(folder);

            expect(result).toEqual({
                version: "1.0",
                photoList: [],
            });
        });
    });

    describe("resetPhotasaConfig", () => {
        it("should reset photo list", async () => {
            const folder = "/test/photos";
            const configData =
                '{"version": "1.0", "photoList": [{"path": "test.jpg", "isVideo": false}]}';

            mockFs.ensureFile.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(configData);
            mockFs.writeFile.mockResolvedValue(undefined);

            const result = await resetPhotasaConfig(folder);

            expect(result.photoList).toEqual([]);
            expect(mockFs.writeFile).toHaveBeenCalled();
        });
    });

    describe("fixPhotasaConfig", () => {
        it("should fix photo config properties", async () => {
            const folder = "/test/photos";
            const configData =
                '{"version": "1.0", "photoList": [{"path": "/full/path/test.mp4", "thumbnail": "long-thumbnail-name.jpg"}]}';

            mockFs.ensureFile.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(configData);
            mockFs.writeFile.mockResolvedValue(undefined);

            const result = await fixPhotasaConfig(folder);

            expect(result.photoList[0].isVideo).toBe(true);
            expect(result.photoList[0].path).toBe("test.mp4");
            expect(mockFs.writeFile).toHaveBeenCalled();
        });
    });
});
