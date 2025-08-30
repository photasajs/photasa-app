import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractMetadata } from "../import-handler";
import { extractDateTimeFromExif } from "@common/exif-util";
import * as fs from "fs-extra";
import ExifReader from "exifreader";
import ffmpeg from "fluent-ffmpeg";
import type { PhotasaLogger } from "@common/logger";
import type { MetadataRequest } from "@common/import-types";

// Mock logger
const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
} as unknown as PhotasaLogger;

// Mock fs-extra
vi.mock("fs-extra", () => {
    const mockStat = vi.fn();
    const mockReadFile = vi.fn();
    return {
        default: {
            stat: mockStat,
            readFile: mockReadFile,
        },
        stat: mockStat,
        readFile: mockReadFile,
    };
});

// Mock ExifReader
vi.mock("exifreader", () => ({
    default: {
        load: vi.fn(),
    },
}));

// Mock fluent-ffmpeg
vi.mock("fluent-ffmpeg", () => ({
    default: {
        ffprobe: vi.fn(),
        setFfmpegPath: vi.fn(),
        setFfprobePath: vi.fn(),
    },
}));

// Mock ffmpeg-static and ffprobe-static
vi.mock("ffmpeg-static", () => ({ default: "/mock/ffmpeg" }));
vi.mock("ffprobe-static", () => ({ default: { path: "/mock/ffprobe" } }));

// Mock HEIF module
vi.mock("@saschazar/wasm-heif", () => ({
    default: vi.fn(() =>
        Promise.resolve({
            decode: vi.fn(),
            dimensions: vi.fn(() => ({ width: 4032, height: 3024 })),
        }),
    ),
}));

describe("Debug Time Extraction Issues", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("HEIC Time Extraction Debug", () => {
        it("should debug HEIC EXIF data structure", async () => {
            const mockRequest: MetadataRequest = {
                filePath: "/test/sample.heic",
            };

            // Mock file stats
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024000,
                mtime: new Date("2024-01-01T09:00:00Z"),
                birthtime: new Date("2024-01-01T10:00:00Z"),
            } as any);

            // Mock HEIC file with EXIF data
            const mockExifData = {
                DateTime: { description: "2024:01:15 10:30:45" },
                DateTimeOriginal: { description: "2024:01:15 10:30:45" },
                CreateDate: { description: "2024:01:15 10:30:45" },
                "Image Width": { description: "4032" },
                "Image Height": { description: "3024" },
            };

            vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("mock-heic-data") as any);
            vi.mocked(ExifReader.load).mockResolvedValue(mockExifData as any);

            const result = await extractMetadata(mockRequest, mockLogger);

            console.log("HEIC Debug - EXIF Data:", mockExifData);
            console.log("HEIC Debug - Result:", result);

            expect(result.type).toBe("image");
            expect(result.format).toBe("HEIC");
        });

        it("should debug missing HEIC EXIF dates", async () => {
            const mockRequest: MetadataRequest = {
                filePath: "/test/no-date.heic",
            };

            // Mock file stats
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024000,
                mtime: new Date("2024-01-01T09:00:00Z"),
                birthtime: new Date("2024-01-01T10:00:00Z"),
            } as any);

            // Mock HEIC file without date EXIF data
            const mockExifData = {
                "Image Width": { description: "4032" },
                "Image Height": { description: "3024" },
                Make: { description: "Apple" },
                Model: { description: "iPhone 12" },
            };

            vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("mock-heic-data") as any);
            vi.mocked(ExifReader.load).mockResolvedValue(mockExifData as any);

            const result = await extractMetadata(mockRequest, mockLogger);

            console.log("HEIC Debug - No Date EXIF:", mockExifData);
            console.log("HEIC Debug - Result:", result);

            expect(result.type).toBe("image");
            expect(result.format).toBe("HEIC");
            expect(result.dateSource).toBe("file_created");
        });
    });

    describe("MOV Time Extraction Debug", () => {
        it("should debug MOV metadata structure", async () => {
            const mockRequest: MetadataRequest = {
                filePath: "/test/sample.mov",
            };

            // Mock file stats
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024000,
                mtime: new Date("2024-01-01T09:00:00Z"),
                birthtime: new Date("2024-01-01T10:00:00Z"),
            } as any);

            // Mock ffprobe output with MOV metadata
            const mockFfprobeOutput = {
                format: {
                    tags: {
                        "com.apple.quicktime.creationdate": "2024-01-15T10:30:45.000000Z",
                        creation_time: "2024-01-15T10:30:45.000000Z",
                    },
                },
                streams: [
                    {
                        width: 1920,
                        height: 1080,
                        duration: "30.5",
                        codec_name: "h264",
                        tags: {
                            creation_time: "2024-01-15T10:30:45.000000Z",
                        },
                    },
                ],
            };

            vi.mocked(ffmpeg.ffprobe).mockImplementation((filePath, callback) => {
                callback(null, mockFfprobeOutput as any);
                return {} as any;
            });

            const result = await extractMetadata(mockRequest, mockLogger);

            console.log("MOV Debug - ffprobe output:", mockFfprobeOutput);
            console.log("MOV Debug - Result:", result);

            expect(result.type).toBe("video");
            expect(result.format).toBe("mov");
        });

        it("should debug missing MOV metadata", async () => {
            const mockRequest: MetadataRequest = {
                filePath: "/test/no-metadata.mov",
            };

            // Mock file stats
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024000,
                mtime: new Date("2024-01-01T09:00:00Z"),
                birthtime: new Date("2024-01-01T10:00:00Z"),
            } as any);

            // Mock ffprobe output without creation time
            const mockFfprobeOutput = {
                format: {
                    tags: {},
                },
                streams: [
                    {
                        width: 1920,
                        height: 1080,
                        duration: "30.5",
                        codec_name: "h264",
                        tags: {},
                    },
                ],
            };

            vi.mocked(ffmpeg.ffprobe).mockImplementation((filePath, callback) => {
                callback(null, mockFfprobeOutput as any);
                return {} as any;
            });

            const result = await extractMetadata(mockRequest, mockLogger);

            console.log("MOV Debug - No metadata output:", mockFfprobeOutput);
            console.log("MOV Debug - Result:", result);

            expect(result.type).toBe("video");
            expect(result.format).toBe("mov");
            expect(result.dateSource).toBe("file_created");
        });

        it("should debug MOV with invalid dates", async () => {
            const mockRequest: MetadataRequest = {
                filePath: "/test/invalid-date.mov",
            };

            // Mock file stats
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024000,
                mtime: new Date("2024-01-01T09:00:00Z"),
                birthtime: new Date("2024-01-01T10:00:00Z"),
            } as any);

            // Mock ffprobe output with invalid dates
            const mockFfprobeOutput = {
                format: {
                    tags: {
                        "com.apple.quicktime.creationdate": "1970-01-01T00:00:00.000000Z",
                        creation_time: "invalid-date",
                    },
                },
                streams: [
                    {
                        width: 1920,
                        height: 1080,
                        duration: "30.5",
                        codec_name: "h264",
                        tags: {
                            creation_time: "1970-01-01T00:00:00.000000Z",
                        },
                    },
                ],
            };

            vi.mocked(ffmpeg.ffprobe).mockImplementation((filePath, callback) => {
                callback(null, mockFfprobeOutput as any);
                return {} as any;
            });

            const result = await extractMetadata(mockRequest, mockLogger);

            console.log("MOV Debug - Invalid dates output:", mockFfprobeOutput);
            console.log("MOV Debug - Result:", result);

            expect(result.type).toBe("video");
            expect(result.format).toBe("mov");
            expect(result.dateSource).toBe("file_created");
        });
    });
});
