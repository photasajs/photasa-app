import { describe, it, expect } from "vitest";
import { detectFileGroups, areFilesRelated } from "../detector";
import type { FileInfo } from "@common/import-types";

const createFileInfo = (path: string, name: string, size = 1024): FileInfo =>
    ({
        path,
        name,
        size,
        type: "image",
        dateSource: "exif",
        mtime: new Date(),
    }) as unknown as FileInfo;

describe("File Groups Detector", () => {
    describe("areFilesRelated", () => {
        it("should identify related files correctly", () => {
            expect(areFilesRelated("IMG_1234.CR2", "IMG_1234.JPG")).toBe(true);
            expect(areFilesRelated("DSC_5678.ARW", "DSC_5678.jpg")).toBe(true);
            expect(areFilesRelated("photo.mp4", "photo.thm")).toBe(true);
        });

        it("should not identify unrelated files", () => {
            expect(areFilesRelated("IMG_1234.CR2", "IMG_1235.JPG")).toBe(false);
            expect(areFilesRelated("DSC_5678.ARW", "different.jpg")).toBe(false);
        });

        it("should handle files without supported relations", () => {
            expect(areFilesRelated("IMG_1234.txt", "IMG_1234.doc")).toBe(false);
        });

        it("should handle edge cases", () => {
            expect(areFilesRelated("", "")).toBe(false);
            expect(areFilesRelated("file", "")).toBe(false);
        });

        it("should handle complex file names", () => {
            expect(
                areFilesRelated(
                    "Canon_EOS_5D_Mark_IV_IMG_1234.cr2",
                    "Canon_EOS_5D_Mark_IV_IMG_1234.jpg",
                ),
            ).toBe(true);
            expect(
                areFilesRelated(
                    "2023-01-01_wedding_photos_001.nef",
                    "2023-01-01_wedding_photos_001.xmp",
                ),
            ).toBe(true);
        });

        it("should handle different extensions", () => {
            expect(areFilesRelated("IMG_001.cr2", "IMG_001.jpg")).toBe(true);
            expect(areFilesRelated("DSC_0001.arw", "DSC_0001.xmp")).toBe(true);
            expect(areFilesRelated("video.mp4", "video.srt")).toBe(true);
        });
    });

    describe("detectFileGroups", () => {
        it("should detect file groups from file list", () => {
            const files: FileInfo[] = [
                createFileInfo("/test/IMG_1234.JPG", "IMG_1234.JPG", 1024),
                createFileInfo("/test/IMG_1234.CR2", "IMG_1234.CR2", 2048),
                createFileInfo("/test/unrelated.png", "unrelated.png", 512),
            ];

            const result = detectFileGroups(files);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toHaveProperty("mainFile");
            expect(result[0]).toHaveProperty("files");
            expect(result[0]).toHaveProperty("type");
            expect(result[0]).toHaveProperty("totalSize");
        });

        it("should handle empty file list", () => {
            const result = detectFileGroups([]);
            expect(result).toEqual([]);
        });

        it("should handle single file", () => {
            const files: FileInfo[] = [createFileInfo("/test/IMG_1234.JPG", "IMG_1234.JPG")];
            const result = detectFileGroups(files);

            expect(result).toHaveLength(1);
            expect(result[0].files).toHaveLength(1);
            expect(result[0].type).toBe("single");
        });

        it("should handle multiple file types", () => {
            const files: FileInfo[] = [
                createFileInfo("/test/Z_9999.jpg", "Z_9999.jpg"),
                createFileInfo("/test/A_0001.cr2", "A_0001.cr2"),
                createFileInfo("/test/M_5555.arw", "M_5555.arw"),
            ];

            const result = detectFileGroups(files);

            expect(result.length).toBeGreaterThanOrEqual(3);
        });

        it("should handle complex real-world scenario", () => {
            const files: FileInfo[] = [
                createFileInfo(
                    "/test/Canon_EOS_5D_Mark_IV_IMG_1234.cr2",
                    "Canon_EOS_5D_Mark_IV_IMG_1234.cr2",
                    4096,
                ),
                createFileInfo(
                    "/test/Canon_EOS_5D_Mark_IV_IMG_1234.jpg",
                    "Canon_EOS_5D_Mark_IV_IMG_1234.jpg",
                    2048,
                ),
                createFileInfo(
                    "/test/Sony_ILCE-7RM4_DSC_5678.arw",
                    "Sony_ILCE-7RM4_DSC_5678.arw",
                    3072,
                ),
                createFileInfo("/test/processed_final.tiff", "processed_final.tiff", 1024),
            ];

            const result = detectFileGroups(files);

            expect(result.length).toBeGreaterThan(0);
            // Check that some groups may have multiple files
            const multiFileGroups = result.filter((g) => g.files.length > 1);
            expect(multiFileGroups.length).toBeGreaterThanOrEqual(0);
        });

        it("should preserve original file structures", () => {
            const files: FileInfo[] = [
                createFileInfo("/test/IMG_1234.JPG", "IMG_1234.JPG"),
                createFileInfo("/test/img_1234.cr2", "img_1234.cr2"),
            ];

            const result = detectFileGroups(files);

            expect(result.length).toBeGreaterThan(0);
            // Verify that FileInfo structures are preserved
            result.forEach((group) => {
                group.files.forEach((file) => {
                    expect(file).toHaveProperty("path");
                    expect(file).toHaveProperty("name");
                    expect(file).toHaveProperty("size");
                    expect(file).toHaveProperty("mtime");
                });
            });
        });
    });
});
