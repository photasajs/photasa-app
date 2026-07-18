import { describe, it, expect, vi, beforeEach } from "vitest";
import { isPsdFile, extractPsdMetadata, getPsdFormatName } from "../psd-extractor";
import type { PhotasaLogger } from "@photasa/common";

// Mock ag-psd
vi.mock("ag-psd", () => ({
    readPsd: vi.fn(),
}));

// Mock fs-extra
vi.mock("fs-extra", () => ({
    readFile: vi.fn(),
    stat: vi.fn(),
}));

// Mock logger
const mockLogger: PhotasaLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
} as any;

describe("PSD Extractor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("isPsdFile", () => {
        it("should return true for .psd files", () => {
            expect(isPsdFile("test.psd")).toBe(true);
            expect(isPsdFile("path/to/file.PSD")).toBe(true);
            expect(isPsdFile("C:\\path\\to\\file.psd")).toBe(true);
        });

        it("should return false for non-psd files", () => {
            expect(isPsdFile("test.jpg")).toBe(false);
            expect(isPsdFile("test.png")).toBe(false);
            expect(isPsdFile("test.ai")).toBe(false);
            expect(isPsdFile("test.sketch")).toBe(false);
            expect(isPsdFile("test")).toBe(false);
        });
    });

    describe("getPsdFormatName", () => {
        it("should return correct format name", () => {
            expect(getPsdFormatName()).toBe("Photoshop");
        });
    });

    describe("extractPsdMetadata", () => {
        it("should extract PSD metadata successfully", async () => {
            // Import the mocked modules
            const { readFile } = await import("fs-extra");
            const { readPsd } = await import("ag-psd");

            // Mock file system operations
            const mockBuffer = Buffer.from("mock-psd-data");
            vi.mocked(readFile).mockResolvedValue(mockBuffer as any);

            // Mock ag-psd response
            const mockPsd = {
                width: 800,
                height: 600,
                children: [
                    { name: "Layer 1", width: 800, height: 600 },
                    { name: "Layer 2", width: 400, height: 300 },
                ],
                colorMode: 3, // RGB
                version: 1,
            };

            vi.mocked(readPsd).mockReturnValue(mockPsd);

            const result = await extractPsdMetadata("/path/to/test.psd", mockLogger);

            expect(result).toEqual({
                path: "/path/to/test.psd",
                name: "test.psd",
                type: "ai",
                format: "PSD",
                size: 0, // PSD提取器没有从文件系统获取size
                width: 800,
                height: 600,
                createdTime: expect.any(Date), // 使用当前时间作为fallback
                modifiedTime: expect.any(Date), // 使用当前时间作为fallback
                dateSource: "file_created",
                layers: 2,
                colorMode: "3",
                version: "1",
                hasTransparency: false,
                artboardCount: 0,
            });

            expect(mockLogger.info).toHaveBeenCalledWith(
                "[psd-extractor] Successfully extracted PSD metadata for /path/to/test.psd",
            );
        });

        it("should handle PSD parsing errors", async () => {
            const { readFile } = await import("fs-extra");
            const { readPsd } = await import("ag-psd");

            const mockBuffer = Buffer.from("invalid-psd-data");
            vi.mocked(readFile).mockResolvedValue(mockBuffer as any);
            vi.mocked(readPsd).mockReturnValue(null as any);

            await expect(extractPsdMetadata("/path/to/invalid.psd", mockLogger)).rejects.toThrow(
                "Failed to parse PSD file",
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                "[psd-extractor] Failed to extract PSD metadata from /path/to/invalid.psd: Error: Failed to parse PSD file",
            );
        });

        it("should handle file read errors", async () => {
            const { readFile } = await import("fs-extra");

            vi.mocked(readFile).mockRejectedValue(new Error("File not found"));

            await expect(
                extractPsdMetadata("/path/to/nonexistent.psd", mockLogger),
            ).rejects.toThrow("File not found");

            expect(mockLogger.error).toHaveBeenCalledWith(
                "[psd-extractor] Failed to extract PSD metadata from /path/to/nonexistent.psd: Error: File not found",
            );
        });

        it("should handle PSD with minimal data", async () => {
            const { readFile } = await import("fs-extra");
            const { readPsd } = await import("ag-psd");

            const mockBuffer = Buffer.from("mock-psd-data");
            vi.mocked(readFile).mockResolvedValue(mockBuffer as any);

            // Mock minimal PSD data
            const mockPsd = {
                width: 100,
                height: 100,
                children: [],
                colorMode: undefined,
                version: undefined,
            };

            vi.mocked(readPsd).mockReturnValue(mockPsd);

            const result = await extractPsdMetadata("/path/to/minimal.psd", mockLogger);

            expect(result).toEqual({
                path: "/path/to/minimal.psd",
                name: "minimal.psd",
                type: "ai",
                format: "PSD",
                size: 0, // PSD提取器没有从文件系统获取size
                width: 100,
                height: 100,
                createdTime: expect.any(Date), // 使用当前时间作为fallback
                modifiedTime: expect.any(Date), // 使用当前时间作为fallback
                dateSource: "file_created",
                layers: 0,
                colorMode: "unknown",
                version: "unknown",
                hasTransparency: false,
                artboardCount: 0,
            });
        });
    });
});
