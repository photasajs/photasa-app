import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractMetadata } from "../import-handler";
import type { PhotasaLogger } from "@common/logger";
import type { MetadataRequest } from "@common/import-types";

// Mock dependencies
vi.mock("fs-extra", () => ({
    default: {
        readFile: vi.fn(),
        stat: vi.fn(),
        exists: vi.fn(),
    },
}));

vi.mock("exifreader", () => ({
    default: {
        load: vi.fn(),
    },
}));

vi.mock("@saschazar/wasm-heif", () => ({
    default: vi.fn(),
}));

describe("HEIC Error Fix Tests", () => {
    let mockLogger: PhotasaLogger;

    beforeEach(() => {
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as any;

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("should handle HEIC WASM RuntimeError gracefully", async () => {
        const fs = await import("fs-extra");
        const ExifReader = await import("exifreader");

        // Mock file stats
        (fs.default.stat as any).mockResolvedValue({
            size: 1024000,
            mtime: new Date("2023-11-08T02:32:16.966Z"),
            birthtime: new Date("2023-11-08T02:32:16.966Z"),
        });

        // Mock file buffer
        (fs.default.readFile as any).mockResolvedValue(Buffer.from("mock heic data"));
        (fs.default.exists as any).mockResolvedValue(false); // WASM file not found

        // Mock ExifReader to return valid EXIF data
        (ExifReader.default.load as any).mockReturnValue({
            ImageWidth: { value: 4032 },
            ImageLength: { value: 3024 },
            DateTimeOriginal: { value: ["2023:11:08 02:32:16"] },
            Make: { description: "Apple" },
            Model: { description: "iPhone 14 Pro" },
        });

        const request: MetadataRequest = {
            filePath:
                "/Users/albert.li/Library/CloudStorage/OneDrive-Personal/圖片/本机照片/2023/11/20231108_023216966_iOS.heic",
            fileType: "image",
        };

        // This should not throw an error anymore
        const result = await extractMetadata(request, mockLogger);

        expect(result).toBeDefined();
        expect(result.type).toBe("image");
        expect(result.format).toBe("HEIC");
        expect(result.dateSource).toBe("exif");
        expect(result.width).toBe(4032);
        expect(result.height).toBe(3024);

        // Verify that EXIF extraction was successful (no error logs expected)
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should fallback to file stats when all HEIC processing fails", async () => {
        const fs = await import("fs-extra");
        const ExifReader = await import("exifreader");

        const mockBirthtime = new Date("2023-11-08T02:32:16.966Z");

        // Mock file stats
        (fs.default.stat as any).mockResolvedValue({
            size: 1024000,
            mtime: new Date("2023-11-08T02:32:16.966Z"),
            birthtime: mockBirthtime,
        });

        // Mock file reading failure
        (fs.default.readFile as any).mockRejectedValue(new Error("File read error"));

        // Mock ExifReader failure
        (ExifReader.default.load as any).mockImplementation(() => {
            throw new Error("EXIF parsing failed");
        });

        const request: MetadataRequest = {
            filePath:
                "/Users/albert.li/Library/CloudStorage/OneDrive-Personal/圖片/本机照片/2023/11/20231108_023216966_iOS.heic",
            fileType: "image",
        };

        const result = await extractMetadata(request, mockLogger);

        expect(result).toBeDefined();
        expect(result.type).toBe("image");
        expect(result.format).toBe("HEIC");
        expect(result.dateSource).toBe("file_created");
        expect(result.width).toBe(0);
        expect(result.height).toBe(0);
        expect(result.dateTime).toEqual(mockBirthtime);

        // Verify that fallback was used
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining("[HEIC] Error processing"),
        );
    });

    it("should extract dimensions from EXIF when available", async () => {
        const fs = await import("fs-extra");
        const ExifReader = await import("exifreader");

        // Mock file stats
        (fs.default.stat as any).mockResolvedValue({
            size: 1024000,
            mtime: new Date("2023-11-08T02:32:16.966Z"),
            birthtime: new Date("2023-11-08T02:32:16.966Z"),
        });

        (fs.default.readFile as any).mockResolvedValue(Buffer.from("mock heic data"));
        (fs.default.exists as any).mockResolvedValue(false); // WASM not available

        // Mock ExifReader to return dimensions in EXIF
        (ExifReader.default.load as any).mockReturnValue({
            ImageWidth: { value: 4032 },
            ImageLength: { value: 3024 },
            PixelXDimension: { value: 4032 },
            PixelYDimension: { value: 3024 },
            DateTimeOriginal: { value: ["2023:11:08 02:32:16"] },
        });

        const request: MetadataRequest = {
            filePath: "/test/heic/with-exif-dimensions.heic",
            fileType: "image",
        };

        const result = await extractMetadata(request, mockLogger);

        expect(result.width).toBe(4032);
        expect(result.height).toBe(3024);
        expect(result.dateSource).toBe("exif");

        // Should have logged successful dimension extraction from EXIF
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining("[HEIC] Got dimensions from EXIF: 4032x3024"),
        );
    });
});
