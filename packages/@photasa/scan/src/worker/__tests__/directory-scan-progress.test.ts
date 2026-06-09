import { describe, it, expect, vi } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import {
    mergeDirectoryScanProgressWithCache,
    buildDirectoryScanProgressMessage,
    PHOTASA_FOLDER_CACHE_FILE,
} from "../directory-scan-progress";

describe("mergeDirectoryScanProgressWithCache", () => {
    it("无缓存文件时返回 fallback 计数", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scan-progress-"));
        const logDebug = vi.fn();
        expect(mergeDirectoryScanProgressWithCache(dir, 3, logDebug)).toEqual({
            processed: 3,
            total: 0,
        });
    });

    it("有缓存时返回 processedFiles/pendingFiles 长度和", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scan-progress-"));
        await fs.writeJson(path.join(dir, PHOTASA_FOLDER_CACHE_FILE), {
            processedFiles: ["a", "b"],
            pendingFiles: ["c"],
        });
        const logDebug = vi.fn();
        const r = mergeDirectoryScanProgressWithCache(dir, 9, logDebug);
        expect(r).toEqual({ processed: 2, total: 3 });
        expect(logDebug).toHaveBeenCalledWith(
            expect.stringContaining("Cache stats from file: processed=2, total=3"),
        );
    });

    it("损坏的 JSON 时使用 fallback 并记 debug", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "scan-progress-"));
        await fs.writeFile(path.join(dir, PHOTASA_FOLDER_CACHE_FILE), "{not json", "utf8");
        const logDebug = vi.fn();
        const r = mergeDirectoryScanProgressWithCache(dir, 5, logDebug);
        expect(r).toEqual({ processed: 5, total: 0 });
        expect(logDebug).toHaveBeenCalledWith(expect.stringContaining("Could not read cache file"));
    });
});

describe("buildDirectoryScanProgressMessage", () => {
    it("文件 action 时带 basename 作为 currentFile", () => {
        const m = buildDirectoryScanProgressMessage({
            requestId: "r1",
            scanFallbackPath: "/album",
            action: { path: "/album/x.jpg", isDirectory: false },
            progress: { processed: 1, total: 10 },
        });
        expect(m.currentFile).toBe("x.jpg");
        expect(m.action.path).toBe("/album/x.jpg");
    });

    it("缺 action 时用 scanFallbackPath", () => {
        const m = buildDirectoryScanProgressMessage({
            requestId: "r1",
            scanFallbackPath: "/album",
            action: undefined,
            progress: { processed: 0, total: 0 },
        });
        expect(m.action.path).toBe("/album");
        expect(m.currentFile).toBeUndefined();
    });
});
