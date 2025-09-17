import { describe, it, expect, beforeAll } from "vitest";
import { extractMetadata } from "../import-handler";
import type { MetadataRequest } from "@common/import-types";
import type { PhotasaLogger } from "@common/logger";
import path from "path";
import fs from "fs-extra";

// Real test files paths
const TEST_MOV_FILE = path.join(__dirname, "data", "20231221_210856000_iOS.MOV");
const TEST_MP4_FILE = path.join(__dirname, "data", "20231222_195320000_iOS.mp4");

describe("Real Video Files Tests", () => {
    let mockLogger: PhotasaLogger;

    beforeAll(async () => {
        // Ensure test files exist before running tests
        const movExists = await fs.pathExists(TEST_MOV_FILE);
        const mp4Exists = await fs.pathExists(TEST_MP4_FILE);

        if (!movExists && !mp4Exists) {
            throw new Error(
                `Test files not found. Expected at least one of:\n- ${TEST_MOV_FILE}\n- ${TEST_MP4_FILE}`,
            );
        }

        mockLogger = {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
        } as PhotasaLogger;
    });

    describe("File Existence", () => {
        it("should have test MOV file available", async () => {
            const exists = await fs.pathExists(TEST_MOV_FILE);
            expect(exists).toBe(true);
        });

        it("should have test MP4 file available", async () => {
            const exists = await fs.pathExists(TEST_MP4_FILE);
            expect(exists).toBe(true);
        });
    });

    describe("VideoMetadataProcessor with Real Files", () => {
        it("should extract metadata from real MOV file", async () => {
            const exists = await fs.pathExists(TEST_MOV_FILE);
            if (!exists) {
                expect.assertions(0); // Skip test if file not found
                return;
            }

            const request: MetadataRequest = {
                filePath: TEST_MOV_FILE,
            };

            const result = await extractMetadata(request, mockLogger);

            // Basic structure validation
            expect(result).toHaveProperty("duration");
            expect(result).toHaveProperty("resolution");
            expect(result).toHaveProperty("codec");
            expect(result).toHaveProperty("format");
            expect(result).toHaveProperty("dateSource");

            // Format should be 'mov'
            expect(result.format).toBe("mov");

            // Resolution should be valid
            expect(result.resolution).toBeDefined();
            expect(result.resolution).not.toBeNull();
            expect(result.resolution?.width).toBeGreaterThan(0);
            expect(result.resolution?.height).toBeGreaterThan(0);

            // Duration should be positive
            expect(result.duration).toBeGreaterThan(0);

            // Date source should be either video_metadata or file_created
            expect(["video_metadata", "file_created"]).toContain(result.dateSource);

            // Creation time should be valid if present (for VideoMetadata)
            expect(result.creationTime).toBeDefined();
            expect(result.creationTime).toBeInstanceOf(Date);
            expect(result.creationTime?.getTime()).not.toBeNaN();
            // Should be a reasonable date (after 2000, before 2030)
            expect(result.creationTime?.getFullYear()).toBe(2023);
            expect(result.creationTime?.getMonth()).toBe(11); // December is month 11 (0-indexed)
            expect(result.creationTime?.getDate()).toBe(21);
        }, 30000);

        it("should extract metadata from real MP4 file", async () => {
            const exists = await fs.pathExists(TEST_MP4_FILE);
            if (!exists) {
                expect.assertions(0); // Skip test if file not found
                return;
            }

            const request: MetadataRequest = {
                filePath: TEST_MP4_FILE,
            };

            const result = await extractMetadata(request, mockLogger);

            // Basic structure validation
            expect(result).toHaveProperty("duration");
            expect(result).toHaveProperty("resolution");
            expect(result).toHaveProperty("codec");
            expect(result).toHaveProperty("format");
            expect(result).toHaveProperty("dateSource");

            // Format should be 'mp4'
            expect(result.format).toBe("mp4");

            // Resolution should be valid
            expect(result.resolution).toBeDefined();
            expect(result.resolution).not.toBeNull();
            expect(result.resolution?.width).toBeGreaterThan(0);
            expect(result.resolution?.height).toBeGreaterThan(0);

            // Duration should be positive
            expect(result.duration).toBeGreaterThan(0);

            // Date source should be either video_metadata or file_created
            expect(["video_metadata", "file_created"]).toContain(result.dateSource);

            // Creation time should be valid (for VideoMetadata)
            expect(result.creationTime).toBeDefined();
            expect(result.creationTime).toBeInstanceOf(Date);
            expect(result.creationTime?.getTime()).not.toBeNaN();
            // Should be a reasonable date (after 2000, before 2030)
            expect(result.creationTime?.getFullYear()).toBe(2023);
            expect(result.creationTime?.getMonth()).toBe(11);
            expect(result.creationTime?.getDate()).toBe(22);
        }, 30000);
    });

    describe("extractMetadata with Real Files", () => {
        it("should extract complete metadata from real MOV file", async () => {
            const exists = await fs.pathExists(TEST_MOV_FILE);
            if (!exists) {
                expect.assertions(0); // Skip test if file not found
                return;
            }

            const request: MetadataRequest = {
                filePath: TEST_MOV_FILE,
            };

            const result = await extractMetadata(request, mockLogger);

            // Basic file metadata
            expect(result.type).toBe("video");
            expect(result.name).toBe("20231221_210856000_iOS.MOV");
            expect(result.size).toBeGreaterThan(0);
            expect(result.path).toBe(TEST_MOV_FILE);

            // Timestamps
            expect(result.createdTime).toBeInstanceOf(Date);
            expect(result.modifiedTime).toBeInstanceOf(Date);

            // dateTime should be extracted from video metadata
            expect(result.dateTime).toBeDefined();
            expect(result.dateTime).toBeInstanceOf(Date);
            expect(result.dateTime?.getTime()).not.toBeNaN();
            // Should be a reasonable date (after 2000, before 2030)
            expect(result.dateTime?.getFullYear() ?? 0).toBeGreaterThan(2000);
            expect(result.dateTime?.getFullYear() ?? 0).toBeLessThan(2030);

            // Video-specific metadata
            expect((result as any).duration).toBeGreaterThan(0);
            expect((result as any).resolution?.width).toBeGreaterThan(0);
            expect((result as any).resolution?.height).toBeGreaterThan(0);
            expect((result as any).format).toBe("mov");
        });

        it("should extract complete metadata from real MP4 file", async () => {
            const exists = await fs.pathExists(TEST_MP4_FILE);
            if (!exists) {
                expect.assertions(0); // Skip test if file not found
                return;
            }

            const request: MetadataRequest = {
                filePath: TEST_MP4_FILE,
            };

            const result = await extractMetadata(request, mockLogger);

            // Basic file metadata
            expect(result.type).toBe("video");
            expect(result.name).toBe("20231222_195320000_iOS.mp4");
            expect(result.size).toBeGreaterThan(0);
            expect(result.path).toBe(TEST_MP4_FILE);

            // Timestamps
            expect(result.createdTime).toBeInstanceOf(Date);
            expect(result.modifiedTime).toBeInstanceOf(Date);

            // Video-specific metadata
            expect((result as any).duration).toBeGreaterThan(0);
            expect((result as any).resolution?.width).toBeGreaterThan(0);
            expect((result as any).resolution?.height).toBeGreaterThan(0);
            expect((result as any).format).toBe("mp4");
        });
    });

    describe("Date Extraction Validation", () => {
        it("should validate MOV file date extraction from filename", async () => {
            const exists = await fs.pathExists(TEST_MOV_FILE);
            if (!exists) {
                expect.assertions(0); // Skip test if file not found
                return;
            }

            const request: MetadataRequest = {
                filePath: TEST_MOV_FILE,
            };

            const result = await extractMetadata(request, mockLogger);

            // Video metadata should be extracted successfully
            expect(result.dateSource).toBe("video_metadata");
            expect(result.creationTime).toBeDefined();

            // Validate that we get a reasonable date (not too far in the past, not in the future)
            const now = new Date();
            const twoYearsAgo = new Date(now.getFullYear() - 2, 0, 1); // More lenient range
            const futureDate = new Date(now.getFullYear() + 1, 0, 1);

            expect(result.creationTime?.getTime() ?? 0).toBeGreaterThan(twoYearsAgo.getTime());
            expect(result.creationTime?.getTime() ?? 0).toBeLessThan(futureDate.getTime());
        });

        it("should validate MP4 file date extraction from filename", async () => {
            const exists = await fs.pathExists(TEST_MP4_FILE);
            if (!exists) {
                expect.assertions(0); // Skip test if file not found
                return;
            }

            const request: MetadataRequest = {
                filePath: TEST_MP4_FILE,
            };

            const result = await extractMetadata(request, mockLogger);

            // The filename suggests 2023-12-22 19:53:20
            const expectedDate = new Date("2023-12-22T19:53:20.000Z");

            // Video metadata date should be close to filename date
            expect(result.dateSource).toBe("video_metadata");
            expect(result.creationTime).toBeDefined();
            const timeDiff = Math.abs(
                (result.creationTime?.getTime() ?? 0) - expectedDate.getTime(),
            );
            // Allow for timezone differences (up to 24 hours)
            expect(timeDiff).toBeLessThan(24 * 60 * 60 * 1000);
        });
    });

    describe("Error Handling with Real Files", () => {
        it("should handle non-existent file gracefully", async () => {
            const nonExistentFile = path.join(__dirname, "data", "non-existent.mov");

            const request: MetadataRequest = {
                filePath: nonExistentFile,
            };

            // Should throw error for non-existent files since fs.stat() fails
            await expect(extractMetadata(request, mockLogger)).rejects.toThrow();
        });

        it("should handle corrupted file gracefully", async () => {
            // Create a temporary corrupted file
            const corruptedFile = path.join(__dirname, "data", "corrupted.mov");
            await fs.writeFile(corruptedFile, "not a video file");

            try {
                const request: MetadataRequest = {
                    filePath: corruptedFile,
                };

                const result = await extractMetadata(request, mockLogger);
                // Should return fallback metadata instead of throwing
                expect(result).toBeDefined();
                expect(result.dateSource).toBe("file_created");
            } finally {
                // Clean up
                await fs.remove(corruptedFile);
            }
        });
    });
});
