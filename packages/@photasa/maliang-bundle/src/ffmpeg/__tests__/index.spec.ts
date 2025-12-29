import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Photasa FFmpeg Path Resolution", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("should resolve dev path for ffmpeg", async () => {
        vi.doMock("ffmpeg-static", () => ({ default: "/node_modules/ffmpeg" }));
        vi.doMock("ffprobe-static", () => ({ default: { path: "/node_modules/ffprobe" } }));
        // Mock fs-extra for imports in index.ts
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => true) } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));
        vi.doMock("fluent-ffmpeg", () => ({
            default: { setFfmpegPath: vi.fn(), setFfprobePath: vi.fn() },
        }));

        const { getFfmpegPath } = await import("../index");
        expect(getFfmpegPath()).toBe("/node_modules/ffmpeg");
    });

    it("should resolve production path for ffmpeg", async () => {
        vi.doMock("ffmpeg-static", () => ({ default: "/resources/app.asar/node_modules/ffmpeg" }));
        vi.doMock("ffprobe-static", () => ({ default: { path: "/node_modules/ffprobe" } })); // stub
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => true) } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));
        vi.doMock("fluent-ffmpeg", () => ({
            default: { setFfmpegPath: vi.fn(), setFfprobePath: vi.fn() },
        }));

        const { getFfmpegPath } = await import("../index");
        expect(getFfmpegPath()).toBe("/resources/app.asar.unpacked/node_modules/ffmpeg");
    });

    it("should resolve dev path for ffprobe", async () => {
        vi.doMock("ffprobe-static", () => ({
            default: { path: "/node_modules/ffprobe-static/bin/arch/ffprobe" },
        }));
        // Ensure path check logic passes
        const { getFfprobePath } = await import("../index");
        expect(getFfprobePath()).toBe("/node_modules/ffprobe-static/bin/arch/ffprobe");
    });

    it("should resolve production path for ffprobe", async () => {
        vi.doMock("ffmpeg-static", () => ({ default: "/node_modules/ffmpeg" })); // stub
        vi.doMock("ffprobe-static", () => ({
            default: { path: "/resources/app.asar/node_modules/ffprobe" },
        }));
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => true) } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));
        vi.doMock("fluent-ffmpeg", () => ({
            default: { setFfmpegPath: vi.fn(), setFfprobePath: vi.fn() },
        }));

        const { getFfprobePath } = await import("../index");
        expect(getFfprobePath()).toBe("/resources/app.asar.unpacked/node_modules/ffprobe");
    });

    it("should export getFFmpegConfig", async () => {
        vi.doMock("ffmpeg-static", () => ({ default: "/bin/ffmpeg" }));
        vi.doMock("ffprobe-static", () => ({ default: { path: "/bin/ffprobe" } }));
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => true) } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));
        vi.doMock("fluent-ffmpeg", () => ({
            default: { setFfmpegPath: vi.fn(), setFfprobePath: vi.fn() },
        }));

        const { getFFmpegConfig } = await import("../index");
        const config = getFFmpegConfig();
        expect(config.ffmpegPath).toBe("/bin/ffmpeg");
    });

    it("should configure ffmpeg correctly", async () => {
        const setFfmpegPath = vi.fn();
        const setFfprobePath = vi.fn();

        vi.doMock("ffmpeg-static", () => ({ default: "/bin/ffmpeg" }));
        vi.doMock("ffprobe-static", () => ({ default: { path: "/bin/ffprobe" } }));
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => true) } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));
        vi.doMock("fluent-ffmpeg", () => ({ default: { setFfmpegPath, setFfprobePath } }));

        const { configureFFmpeg } = await import("../index");
        const config = configureFFmpeg();

        expect(config.ffmpegPath).toBe("/bin/ffmpeg");
        expect(setFfmpegPath).toHaveBeenCalledWith("/bin/ffmpeg");
    });

    it("should handle missing binaries gracefully", async () => {
        vi.doMock("ffmpeg-static", () => ({ default: "/missing/ffmpeg" }));
        vi.doMock("ffprobe-static", () => ({ default: { path: "/missing/ffprobe" } }));
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => false) } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));
        vi.doMock("fluent-ffmpeg", () => ({
            default: { setFfmpegPath: vi.fn(), setFfprobePath: vi.fn() },
        }));

        const { configureFFmpeg, isFFmpegAvailable } = await import("../index");
        configureFFmpeg(); // Should warn but not throw

        expect(isFFmpegAvailable()).toBe(false);
    });

    it("should get ffmpeg version", async () => {
        vi.doMock("ffmpeg-static", () => ({ default: "/bin/ffmpeg" }));
        vi.doMock("ffprobe-static", () => ({ default: { path: "/bin/ffprobe" } }));
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => true) } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));
        vi.doMock("fluent-ffmpeg", () => ({
            default: {
                setFfmpegPath: vi.fn(),
                setFfprobePath: vi.fn(),
                getAvailableFormats: vi.fn((cb) => cb(null, { ffmpeg: { version: "5.1.2" } })),
            },
        }));

        const { getFFmpegVersion } = await import("../index");
        const version = await getFFmpegVersion();
        expect(version).toBe("5.1.2");

        // Coverage for verify branch inside getFFmpegVersion if needed?
        // Actually isFFmpegAvailable call is inside. Mocks are set up.
    });

    it("should return null version if unavailable", async () => {
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => false) } }));
        vi.doMock("ffmpeg-static", () => ({ default: "/bin/ffmpeg" }));
        vi.doMock("ffprobe-static", () => ({ default: { path: "/bin/ffprobe" } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));
        vi.doMock("fluent-ffmpeg", () => ({
            default: { setFfmpegPath: vi.fn(), setFfprobePath: vi.fn() },
        }));

        const { getFFmpegVersion } = await import("../index");
        const version = await getFFmpegVersion();
        expect(version).toBeNull();
    });

    it("should handle version check error", async () => {
        vi.doMock("ffmpeg-static", () => ({ default: "/bin/ffmpeg" }));
        vi.doMock("ffprobe-static", () => ({ default: { path: "/bin/ffprobe" } }));
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => true) } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));
        vi.doMock("fluent-ffmpeg", () => ({
            default: {
                setFfmpegPath: vi.fn(),
                setFfprobePath: vi.fn(),
                getAvailableFormats: vi.fn((cb) => cb(new Error("Fail"), {})),
            },
        }));

        const { getFFmpegVersion } = await import("../index");
        const version = await getFFmpegVersion();
        expect(version).toBeNull();
    });

    it("should handle ffprobe-static as string", async () => {
        vi.doMock("ffprobe-static", () => ({ default: "/path/to/ffprobe_string" }));
        // Ensure path check logic passes
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => true) } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));

        const { getFfprobePath } = await import("../index");
        // Logic: if string, it falls through to fallback if not matching dev/prod patterns
        expect(getFfprobePath()).toBe("/path/to/ffprobe_string");
    });

    it("should return unknown version if format data missing", async () => {
        vi.doMock("ffmpeg-static", () => ({ default: "/bin/ffmpeg" }));
        vi.doMock("ffprobe-static", () => ({ default: { path: "/bin/ffprobe" } }));
        vi.doMock("fs-extra", () => ({ default: { existsSync: vi.fn(() => true) } }));
        vi.doMock("@photasa/common", () => ({
            getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
        }));
        vi.doMock("fluent-ffmpeg", () => ({
            default: {
                setFfmpegPath: vi.fn(),
                setFfprobePath: vi.fn(),
                getAvailableFormats: vi.fn((cb) => cb(null, {})), // Empty formats
            },
        }));

        const { getFFmpegVersion } = await import("../index");
        const version = await getFFmpegVersion();
        expect(version).toBe("unknown");
    });
});
