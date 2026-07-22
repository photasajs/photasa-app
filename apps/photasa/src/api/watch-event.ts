/**
 * Tauri watch 事件 → `WatchState`（对齐 legacy-api `historical preload/fs-watch.ts`）
 * RFC 0133：通路 A 必须收到完整 `action` / `isFile` / media 字段。
 */
import type { WatchAction, WatchState } from "@photasa/common";
import { WatchServiceEvent } from "@photasa/common";
import { toRelativeThumbnailPath } from "@renderer/utils/photasa-path";

/** 与 `photasa-media`（RFC 0141 权威表：IMAGE_EXTS ∪ HEIC_EXTS ∪ RAW_EXTS）对齐（前端纯函数，无 Node/Rust invoke） */
const IMAGE_EXTS = new Set([
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "webp",
    "tiff",
    "tif",
    "svg",
    "ico",
    "psd",
    "heic",
    "heif",
    "avif",
    "raw",
    "cr2",
    "cr3",
    "nef",
    "arw",
    "dng",
    "raf",
    "orf",
]);

/** 与 `photasa-media` VIDEO_EXTS 对齐 */
const VIDEO_EXTS = new Set([
    "mp4",
    "mov",
    "avi",
    "mkv",
    "m4v",
    "3gp",
    "wmv",
    "flv",
    "webm",
    "mpg",
    "mpeg",
    "m2v",
    "mts",
    "m2ts",
    "ts",
    "vob",
    "rmvb",
    "rm",
]);

const WATCH_FILE_EVENTS = [
    WatchServiceEvent.add,
    WatchServiceEvent.addDir,
    WatchServiceEvent.change,
    WatchServiceEvent.unlink,
    WatchServiceEvent.unlinkDir,
] as const;

export type WatchFileEventName = (typeof WATCH_FILE_EVENTS)[number];

export { WATCH_FILE_EVENTS };

/** Rust / 前端 payload：camelCase `isFile` + `path` */
export type WatchFileEventPayload = {
    isFile?: boolean;
    is_file?: boolean;
    path?: string;
};

function extensionLower(path: string): string {
    const base = path.replace(/\\/g, "/");
    const slash = base.lastIndexOf("/");
    const name = slash >= 0 ? base.slice(slash + 1) : base;
    const dot = name.lastIndexOf(".");
    if (dot <= 0 || dot === name.length - 1) {
        return "";
    }
    return name.slice(dot + 1).toLowerCase();
}

/** 纯扩展名判定（与 classify_media 一致） */
export function classifyWatchMedia(path: string): { isImage: boolean; isVideo: boolean } {
    const ext = extensionLower(path);
    if (!ext) {
        return { isImage: false, isVideo: false };
    }
    const isImage = IMAGE_EXTS.has(ext);
    const isVideo = VIDEO_EXTS.has(ext);
    return { isImage, isVideo };
}

/**
 * 事件名 → WatchAction（dir 事件仍用 add/delete，靠 isFile=false 区分）
 */
export function watchEventNameToAction(eventName: string): WatchAction | null {
    switch (eventName) {
        case WatchServiceEvent.add:
        case WatchServiceEvent.addDir:
            return "add";
        case WatchServiceEvent.change:
            return "change";
        case WatchServiceEvent.unlink:
        case WatchServiceEvent.unlinkDir:
            return "delete";
        case WatchServiceEvent.error:
            return "error";
        case WatchServiceEvent.ready:
            return "ready";
        default:
            return null;
    }
}

function resolveIsFile(eventName: string, payload: WatchFileEventPayload): boolean {
    if (eventName === WatchServiceEvent.addDir || eventName === WatchServiceEvent.unlinkDir) {
        return false;
    }
    if (typeof payload.isFile === "boolean") {
        return payload.isFile;
    }
    if (typeof payload.is_file === "boolean") {
        return payload.is_file;
    }
    // 缺省：add/change/unlink 按文件
    return true;
}

/**
 * 将 Tauri listen 载荷转为 `file-handler` 可用的 WatchState
 */
export function buildWatchStateFromEvent(
    eventName: string,
    payload: WatchFileEventPayload | null | undefined,
): WatchState | null {
    const action = watchEventNameToAction(eventName);
    if (!action || action === "error" || action === "ready") {
        return null;
    }

    // 统一成对象，便于后续 resolveIsFile；null/undefined 载荷在此归一
    const safePayload = payload ?? {};
    const path = typeof safePayload.path === "string" ? safePayload.path : "";
    if (!path) {
        return null;
    }

    const isFile = resolveIsFile(eventName, safePayload);
    const media = isFile ? classifyWatchMedia(path) : { isImage: false, isVideo: false };
    const thumbnail =
        isFile && (media.isImage || media.isVideo) ? toRelativeThumbnailPath(path) : "";

    return {
        action,
        isFile,
        path,
        isImage: media.isImage,
        isVideo: media.isVideo,
        thumbnail,
    };
}
