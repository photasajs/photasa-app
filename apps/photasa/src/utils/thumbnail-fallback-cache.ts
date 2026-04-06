/**
 * RAW 等占位缩略图（Rust `ThumbnailResponse.fallback`）在网格中的展示标记。
 * 按源文件路径归一化缓存，避免把 `fallback` 写进持久化 Photo 模型。
 */
import { ref } from "vue";

const PLACEHOLDER_BY_KEY = new Map<string, boolean>();

/** 递增以使依赖此缓存的组件重新渲染 */
export const thumbnailFallbackEpoch = ref(0);

function bumpEpoch(): void {
    thumbnailFallbackEpoch.value += 1;
}

/**
 * 将 file:// URL 或本地路径统一为缓存键（POSIX 斜杠）
 */
export function thumbnailFallbackCacheKey(fileUrlOrPath: string): string {
    let s = fileUrlOrPath.trim();
    if (s.startsWith("file://")) {
        s = s.slice("file://".length);
        if (s.startsWith("//")) {
            s = s.slice(1);
        }
        try {
            s = decodeURIComponent(s.replace(/\+/g, "%20"));
        } catch {
            /* 保持原串 */
        }
    }
    return s.replace(/\\/g, "/");
}

/**
 * 在缩略图生成完成后根据后端响应更新占位标记
 */
export function applyThumbnailFallbackResult(sourcePath: string, result: unknown): void {
    if (result === null || typeof result !== "object") {
        return;
    }
    const r = result as { success?: boolean; fallback?: boolean };
    if (!r.success) {
        return;
    }
    const key = thumbnailFallbackCacheKey(sourcePath);
    if (r.fallback === true) {
        PLACEHOLDER_BY_KEY.set(key, true);
        bumpEpoch();
        return;
    }
    if (r.fallback === false) {
        PLACEHOLDER_BY_KEY.delete(key);
        bumpEpoch();
    }
    /* `fallback` 省略时（如目标已存在短路返回）不改缓存，避免误清 RAW 占位标记 */
}

/**
 * 删除缩略图成功后清除标记
 */
export function clearThumbnailFallbackFlag(sourcePath: string): void {
    const key = thumbnailFallbackCacheKey(sourcePath);
    if (PLACEHOLDER_BY_KEY.delete(key)) {
        bumpEpoch();
    }
}

/**
 * 当前缩略图是否为占位生成（仅内存态）
 */
export function getThumbnailFallbackFlag(fileUrlOrPath: string): boolean {
    return PLACEHOLDER_BY_KEY.get(thumbnailFallbackCacheKey(fileUrlOrPath)) === true;
}
