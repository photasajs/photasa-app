import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import isImage from "is-image";
import isVideo from "is-video";
import { readChunk } from "read-chunk";
import imageType from "image-type";
import { getExifInfo } from "../exif-helper";
import { extractDateTimeFromExif } from "@common/exif-util";

// Mock dependencies
vi.mock("read-chunk");
vi.mock("image-type");
vi.mock("fs-extra");
vi.mock("is-image");
vi.mock("is-video");
vi.mock("../exif-helper");
vi.mock("@common/exif-util");
vi.mock("@electron-toolkit/preload", () => ({
    electronAPI: {
        ipcRenderer: {
            invoke: vi.fn(),
        },
    },
}));

// Import the function we're testing
import { getFileMetadata } from "../image-helper";

// Mock fs-extra
const mockStats = {
    size: 1024576, // 1MB
    mtime: new Date("2023-12-01T10:00:00Z"),
    birthtime: new Date("2023-11-01T10:00:00Z"),
    ctime: new Date("2023-11-01T10:00:00Z"),
};

vi.mocked(fs.stat).mockResolvedValue(mockStats as any);

// Mock image detection
vi.mocked(isImage).mockImplementation((path: string) => path.endsWith(".jpg"));
vi.mocked(isVideo).mockImplementation((path: string) => path.endsWith(".mp4"));

// Mock read-chunk and image-type
vi.mocked(readChunk).mockResolvedValue(Buffer.from("fake-image-data") as any);
vi.mocked(imageType).mockResolvedValue({ ext: "jpg", mime: "image/jpeg" });

// Mock EXIF extraction
vi.mocked(getExifInfo).mockResolvedValue({
    "Image Width": { value: 1920, description: "Image Width" },
    "Image Height": { value: 1080, description: "Image Height" },
} as any);

vi.mocked(extractDateTimeFromExif).mockReturnValue(new Date("2023-10-15T14:30:00Z"));

describe("Path Handling in getFileMetadata", () => {
    let originalPlatform: string;

    beforeEach(() => {
        vi.clearAllMocks();
        originalPlatform = process.platform;
        // Mock process.platform for different tests
        Object.defineProperty(process, "platform", {
            writable: true,
            value: "darwin", // Default to macOS
        });
    });

    afterEach(() => {
        Object.defineProperty(process, "platform", {
            writable: true,
            value: originalPlatform,
        });
    });

    describe("File URL to Path Conversion", () => {
        it("should handle file:// URLs on macOS/Linux", async () => {
            Object.defineProperty(process, "platform", { writable: true, value: "darwin" });

            const fileUrl = "file:///Users/test/Pictures/image.jpg";
            const result = await getFileMetadata(fileUrl);

            expect(result.path).toBe("/Users/test/Pictures/image.jpg");
            expect(result.name).toBe("image.jpg");
        });

        it("should handle file:// URLs on Windows", async () => {
            Object.defineProperty(process, "platform", { writable: true, value: "win32" });

            const fileUrl = "file:///C:/Users/test/Pictures/image.jpg";
            const result = await getFileMetadata(fileUrl);

            expect(result.path).toBe("C:/Users/test/Pictures/image.jpg");
            expect(result.name).toBe("image.jpg");
        });

        it("should handle file:// URLs with encoded characters", async () => {
            const fileUrl = "file:///Users/test/My%20Pictures/test%20image.jpg";
            const result = await getFileMetadata(fileUrl);

            expect(result.path).toBe("/Users/test/My Pictures/test image.jpg");
            expect(result.name).toBe("test image.jpg");
        });

        it("should handle regular file paths without file:// protocol", async () => {
            const filePath = "/Users/test/Pictures/image.jpg";
            const result = await getFileMetadata(filePath);

            expect(result.path).toBe("/Users/test/Pictures/image.jpg");
            expect(result.name).toBe("image.jpg");
        });
    });

    describe("File Type Detection and Metadata", () => {
        it("should extract image metadata correctly", async () => {
            const result = await getFileMetadata("file:///Users/test/image.jpg");

            expect(result.type).toBe("image");
            expect(result.format).toBe("JPG");
            expect(result.width).toBe(1920);
            expect(result.height).toBe(1080);
            expect(result.dateSource).toBe("exif");
            expect(result.size).toBe(1024576);
        });

        it("should handle video files", async () => {
            const result = await getFileMetadata("file:///Users/test/video.mp4");

            expect(result.type).toBe("video");
            expect(result.format).toBe("MP4");
            expect(result.dateSource).toBe("file_created");
        });

        it("should handle unknown file types", async () => {
            const result = await getFileMetadata("file:///Users/test/document.pdf");

            expect(result.type).toBe("other");
            expect(result.dateSource).toBe("file_created");
            expect(result.dateTime).toEqual(mockStats.birthtime);
        });

        it("should fallback to file timestamps when EXIF extraction fails", async () => {
            vi.mocked(getExifInfo).mockResolvedValueOnce(null);
            vi.mocked(extractDateTimeFromExif).mockReturnValueOnce(null);

            const result = await getFileMetadata("file:///Users/test/image.jpg");

            expect(result.type).toBe("image");
            expect(result.dateSource).toBe("file_created");
            expect(result.dateTime).toEqual(mockStats.birthtime);
        });
    });

    describe("Error Handling", () => {
        it("should throw error when file stat fails", async () => {
            vi.mocked(fs.stat).mockRejectedValueOnce(new Error("File not found"));

            await expect(getFileMetadata("file:///nonexistent/file.jpg")).rejects.toThrow(
                "File not found",
            );
        });

        it("should handle image metadata extraction errors gracefully", async () => {
            vi.mocked(readChunk).mockRejectedValueOnce(new Error("Read failed"));

            // Should not throw, but continue with file info
            const result = await getFileMetadata("file:///Users/test/image.jpg");

            expect(result.type).toBe("image");
            expect(result.dateSource).toBe("file_created");
            // Should still have basic file information
            expect(result.size).toBe(1024576);
        });
    });

    describe("Windows Path Edge Cases", () => {
        beforeEach(() => {
            Object.defineProperty(process, "platform", { writable: true, value: "win32" });
        });

        it("should handle Windows drive letters correctly", async () => {
            const fileUrl = "file:///D:/Photos/vacation.jpg";
            const result = await getFileMetadata(fileUrl);

            expect(result.path).toBe("D:/Photos/vacation.jpg");
        });

        it("should handle UNC paths", async () => {
            const fileUrl = "file://server/share/Photos/image.jpg";
            const result = await getFileMetadata(fileUrl);

            expect(result.path).toBe("server/share/Photos/image.jpg");
        });
    });
});
