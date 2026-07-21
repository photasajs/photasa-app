import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildScanNotifyPayload } from "../build-notify-payload";

describe("buildScanNotifyPayload", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-04-07T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const ts = Date.parse("2026-04-07T12:00:00.000Z");

    it("error 分支：Error 对象 + action.path", () => {
        const payload = buildScanNotifyPayload({
            type: "error",
            error: new Error("boom"),
            action: { path: "/photos", isDirectory: true },
        });
        expect(payload).toEqual({
            type: "scan",
            task: "/photos",
            status: "error",
            error: "boom",
            timestamp: ts,
        });
    });

    it("error 分支：字符串错误且无 action", () => {
        const payload = buildScanNotifyPayload({
            type: "error",
            error: "Directory does not exist: /x",
        });
        expect(payload).toEqual({
            type: "scan",
            task: "",
            status: "error",
            error: "Directory does not exist: /x",
            timestamp: ts,
        });
    });

    it("complete 分支：带 path", () => {
        const payload = buildScanNotifyPayload({
            type: "complete",
            action: { path: "/album", isDirectory: true },
        });
        expect(payload).toEqual({
            type: "scan",
            task: "/album",
            status: "complete",
            timestamp: ts,
        });
    });

    it("complete 分支：无 action", () => {
        const payload = buildScanNotifyPayload({ type: "complete" });
        expect(payload).toEqual({
            type: "scan",
            task: "",
            status: "complete",
            timestamp: ts,
        });
    });

    it("progress 分支：currentFile 优先于 action.path", () => {
        const payload = buildScanNotifyPayload({
            type: "progress",
            action: { path: "/root", isDirectory: true },
            currentFile: "IMG_001.jpg",
            progress: { processed: 3, total: 10 },
        });
        expect(payload).toEqual({
            type: "scan",
            task: "IMG_001.jpg",
            status: "progress",
            data: { processed: 3, total: 10, currentFile: "IMG_001.jpg" },
            timestamp: ts,
        });
    });

    it("progress 分支：仅有 action.path", () => {
        const payload = buildScanNotifyPayload({
            type: "progress",
            action: { path: "/only/path", isDirectory: false },
            progress: { processed: 1, total: 0 },
        });
        expect(payload).toEqual({
            type: "scan",
            task: "/only/path",
            status: "progress",
            data: { processed: 1, total: 0, currentFile: undefined },
            timestamp: ts,
        });
    });

    it("progress 分支：无 path 与 currentFile 时 task 为空串", () => {
        const payload = buildScanNotifyPayload({
            type: "progress",
            progress: { processed: 0, total: 0 },
        });
        expect(payload).toEqual({
            type: "scan",
            task: "",
            status: "progress",
            data: { processed: 0, total: 0, currentFile: undefined },
            timestamp: ts,
        });
    });

    it("progress 分支：无 progress 时 data 仅含 currentFile", () => {
        const payload = buildScanNotifyPayload({
            type: "progress",
            currentFile: "a.png",
        });
        expect(payload?.data).toEqual({ currentFile: "a.png" });
    });

    it("未知 type 返回 undefined", () => {
        expect(buildScanNotifyPayload({ type: "heartbeat" })).toBeUndefined();
    });
});
