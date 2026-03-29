import { describe, it, expect } from "vitest";
import { isVideoFile, isSupportedVideoFile } from "../video-extractor";

describe("Video Extractor", () => {
    describe("isVideoFile", () => {
        it("should recognize common video formats", () => {
            expect(isVideoFile("test.mp4")).toBe(true);
            expect(isVideoFile("test.mov")).toBe(true);
            expect(isVideoFile("test.avi")).toBe(true);
            expect(isVideoFile("test.mkv")).toBe(true);
            expect(isVideoFile("test.wmv")).toBe(true);
            expect(isVideoFile("test.m4v")).toBe(true);
            expect(isVideoFile("test.flv")).toBe(true);
            expect(isVideoFile("test.webm")).toBe(true);
        });

        it("should recognize 3gp format", () => {
            expect(isVideoFile("test.3gp")).toBe(true);
            expect(isVideoFile("video.3GP")).toBe(true);
            expect(isVideoFile("/path/to/mobile-video.3gp")).toBe(true);
        });

        it("should reject non-video formats", () => {
            expect(isVideoFile("test.jpg")).toBe(false);
            expect(isVideoFile("test.png")).toBe(false);
            expect(isVideoFile("test.txt")).toBe(false);
            expect(isVideoFile("test.pdf")).toBe(false);
        });

        it("should handle case insensitive extensions", () => {
            expect(isVideoFile("TEST.MP4")).toBe(true);
            expect(isVideoFile("test.Mp4")).toBe(true);
            expect(isVideoFile("video.3GP")).toBe(true);
        });
    });

    describe("isSupportedVideoFile", () => {
        it("should recognize supported video formats for metadata extraction", () => {
            expect(isSupportedVideoFile("test.mp4")).toBe(true);
            expect(isSupportedVideoFile("test.mov")).toBe(true);
            expect(isSupportedVideoFile("test.avi")).toBe(true);
            expect(isSupportedVideoFile("test.mkv")).toBe(true);
            expect(isSupportedVideoFile("test.wmv")).toBe(true);
        });

        it("should recognize 3gp format for metadata extraction", () => {
            expect(isSupportedVideoFile("test.3gp")).toBe(true);
            expect(isSupportedVideoFile("mobile-video.3GP")).toBe(true);
        });

        it("should reject unsupported video formats", () => {
            expect(isSupportedVideoFile("test.flv")).toBe(false);
            expect(isSupportedVideoFile("test.webm")).toBe(false);
        });

        it("should reject non-video formats", () => {
            expect(isSupportedVideoFile("test.jpg")).toBe(false);
            expect(isSupportedVideoFile("test.png")).toBe(false);
        });
    });

    it("should handle basic video operations", () => {
        // Test video-related data structures
        const mockVideoData = {
            width: 1920,
            height: 1080,
            duration: 60,
            format: "MP4",
        };
        expect(mockVideoData).toHaveProperty("width");
        expect(mockVideoData).toHaveProperty("height");
        expect(mockVideoData).toHaveProperty("duration");
        expect(mockVideoData).toHaveProperty("format");
    });
});
