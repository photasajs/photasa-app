/**
 * RFC 0137：同步路径工具（禁止走 window.api.mergePath — Tauri 下会返回 Promise）。
 * 与 legacy-api normalizePath / splitPath / joinPath 语义对齐。
 */
import { canonicalFolderPath, joinFolderSegment } from "@renderer/utils/folder-tree-path";
import {
    shortenThumbnailName as shortenThumbnailRelativePath,
    toFileNameFromPath,
    toThumbnailName as toThumbnailFileName,
} from "@renderer/utils/photasa-path";
import { shouldIgnorePhotasaPath as ignorePhotasaPathUtil } from "@photasa/common";

/** 规范化路径（同步；与 legacy-api normalizePath 一致） */
export function normalizePathSync(path: unknown): string {
    if (typeof path !== "string") {
        return "";
    }
    return canonicalFolderPath(path);
}

/** 合并两段路径（同步） */
export function mergePathSync(left: string, right = ""): string {
    if (!right) {
        return canonicalFolderPath(left);
    }
    return joinFolderSegment(left, right);
}

export function splitPathSync(path: string): string[] {
    return path.split(/[/\\]/).filter(Boolean);
}

export function joinPathSync(...parts: string[]): string {
    return parts.filter(Boolean).join("/");
}

export function getSeparatorSync(): string {
    return "/";
}

export function toFileNameSync(path: string): string {
    return toFileNameFromPath(path);
}

export function toDirNameSync(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    const i = normalized.lastIndexOf("/");
    return i <= 0 ? "" : normalized.slice(0, i);
}

export function isHiddenFileSync(fileName: string): boolean {
    const base = toFileNameFromPath(fileName);
    return base.startsWith(".");
}

export function shouldIgnorePhotasaPathSync(fileName: string): boolean {
    return ignorePhotasaPathUtil(fileName);
}

export function toThumbnailNameSync(path: string): string {
    return toThumbnailFileName(path);
}

export function shortenThumbnailNameSync(path: string): string {
    return shortenThumbnailRelativePath(path);
}

export function isAbsolutePathSync(path: string): boolean {
    if (!path) {
        return false;
    }
    if (path.startsWith("/")) {
        return true;
    }
    return /^[A-Za-z]:[\\/]/.test(path);
}
