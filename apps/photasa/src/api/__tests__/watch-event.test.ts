import { describe, expect, it } from "vitest";
import { WatchServiceEvent } from "@photasa/common";
import {
    WATCH_FILE_EVENTS,
    buildWatchStateFromEvent,
    classifyWatchMedia,
    watchEventNameToAction,
} from "../watch-event";

describe("watch-event (RFC 0135)", () => {
    it("exports the five file-* listen names", () => {
        expect(WATCH_FILE_EVENTS).toEqual([
            WatchServiceEvent.add,
            WatchServiceEvent.addDir,
            WatchServiceEvent.change,
            WatchServiceEvent.unlink,
            WatchServiceEvent.unlinkDir,
        ]);
    });

    it("maps event names to WatchAction including ready/error", () => {
        expect(watchEventNameToAction(WatchServiceEvent.add)).toBe("add");
        expect(watchEventNameToAction(WatchServiceEvent.addDir)).toBe("add");
        expect(watchEventNameToAction(WatchServiceEvent.change)).toBe("change");
        expect(watchEventNameToAction(WatchServiceEvent.unlink)).toBe("delete");
        expect(watchEventNameToAction(WatchServiceEvent.unlinkDir)).toBe("delete");
        expect(watchEventNameToAction(WatchServiceEvent.error)).toBe("error");
        expect(watchEventNameToAction(WatchServiceEvent.ready)).toBe("ready");
        expect(watchEventNameToAction("unknown")).toBeNull();
    });

    it("classifies image and video by extension", () => {
        expect(classifyWatchMedia("/a/b/photo.JPG")).toEqual({ isImage: true, isVideo: false });
        expect(classifyWatchMedia("/a/b/clip.mp4")).toEqual({ isImage: false, isVideo: true });
        expect(classifyWatchMedia("/a/b/readme.txt")).toEqual({ isImage: false, isVideo: false });
        expect(classifyWatchMedia("/a/b/noext")).toEqual({ isImage: false, isVideo: false });
        expect(classifyWatchMedia("/a/b/.hidden")).toEqual({ isImage: false, isVideo: false });
        expect(classifyWatchMedia("/a/b/trailing.")).toEqual({ isImage: false, isVideo: false });
        expect(classifyWatchMedia("C:\\win\\photo.heic")).toEqual({
            isImage: true,
            isVideo: false,
        });
        // 无路径分隔符：走 extensionLower 的 base 分支
        expect(classifyWatchMedia("bare.jpg")).toEqual({ isImage: true, isVideo: false });
    });

    it("classifies RAW formats aligned with photasa-media RAW_EXTS (RFC 0141)", () => {
        expect(classifyWatchMedia("/a/b/shot.dng")).toEqual({ isImage: true, isVideo: false });
        expect(classifyWatchMedia("/a/b/shot.raf")).toEqual({ isImage: true, isVideo: false });
        expect(classifyWatchMedia("/a/b/shot.orf")).toEqual({ isImage: true, isVideo: false });
    });

    it("builds WatchState for file add with camelCase isFile", () => {
        const state = buildWatchStateFromEvent(WatchServiceEvent.add, {
            isFile: true,
            path: "/Photos/vacation/img.jpg",
        });
        expect(state).toMatchObject({
            action: "add",
            isFile: true,
            path: "/Photos/vacation/img.jpg",
            isImage: true,
            isVideo: false,
        });
        expect(state?.thumbnail).toContain("thumbnail-img.jpg.png");
    });

    it("builds WatchState for change and video thumbnail", () => {
        const state = buildWatchStateFromEvent(WatchServiceEvent.change, {
            isFile: true,
            path: "/Photos/clip.MOV",
        });
        expect(state).toMatchObject({
            action: "change",
            isFile: true,
            isImage: false,
            isVideo: true,
        });
        expect(state?.thumbnail).toContain("thumbnail-clip.MOV.png");
    });

    it("accepts snake_case is_file from legacy payloads", () => {
        const state = buildWatchStateFromEvent(WatchServiceEvent.unlink, {
            is_file: true,
            path: "/Photos/vacation/img.jpg",
        });
        expect(state?.action).toBe("delete");
        expect(state?.isFile).toBe(true);
    });

    it("defaults isFile=true when payload omits both isFile flags", () => {
        const state = buildWatchStateFromEvent(WatchServiceEvent.add, {
            path: "/Photos/vacation/img.jpg",
        });
        expect(state?.isFile).toBe(true);
        expect(state?.isImage).toBe(true);
    });

    it("forces isFile=false for addDir / unlinkDir", () => {
        const addDir = buildWatchStateFromEvent(WatchServiceEvent.addDir, {
            isFile: true,
            path: "/Photos/new-album",
        });
        expect(addDir).toMatchObject({
            action: "add",
            isFile: false,
            isImage: false,
            isVideo: false,
            thumbnail: "",
        });

        const unlinkDir = buildWatchStateFromEvent(WatchServiceEvent.unlinkDir, {
            path: "/Photos/old-album",
        });
        expect(unlinkDir).toMatchObject({
            action: "delete",
            isFile: false,
        });
    });

    it("returns null for empty / missing path and non-file actions", () => {
        expect(
            buildWatchStateFromEvent(WatchServiceEvent.add, { isFile: true, path: "" }),
        ).toBeNull();
        expect(buildWatchStateFromEvent(WatchServiceEvent.add, {})).toBeNull();
        // null/undefined → safePayload={}，再因无 path 返回 null（覆盖 ?? 分支）
        expect(buildWatchStateFromEvent(WatchServiceEvent.add, null)).toBeNull();
        expect(buildWatchStateFromEvent(WatchServiceEvent.add, undefined)).toBeNull();
        expect(
            buildWatchStateFromEvent(WatchServiceEvent.error, {
                path: "/Photos/x.jpg",
            }),
        ).toBeNull();
        expect(
            buildWatchStateFromEvent(WatchServiceEvent.ready, {
                path: "/Photos/x.jpg",
            }),
        ).toBeNull();
        expect(buildWatchStateFromEvent("unknown-event", { path: "/x.jpg" })).toBeNull();
    });

    it("leaves thumbnail empty for non-media files", () => {
        const state = buildWatchStateFromEvent(WatchServiceEvent.add, {
            isFile: true,
            path: "/Photos/notes.txt",
        });
        expect(state).toMatchObject({
            isImage: false,
            isVideo: false,
            thumbnail: "",
        });
    });
});
