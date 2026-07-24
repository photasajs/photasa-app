import { ref } from "vue";
import type { Image } from "@renderer/common/image";
import { webviewMediaUrlToAbsolutePath } from "@renderer/utils/media-url";

/** 缩略图 URL 缓存破坏 query 参数名 */
export const THUMBNAIL_CACHE_BUST_PARAM = "t" as const;

/** 磁盘缩略图 mtime（Unix ms）；重载页面后仍有效 */
const mtimeMsByThumbnailPath = ref<Record<string, number>>({});

/** 本会话内手动重建的 bust（与 mtime 取 max） */
const bustTimestampByThumbnailPath = ref<Record<string, number>>({});

/** 去掉 URL query，避免重复拼接 ?t= */
export function stripUrlQuery(url: string): string {
    return url.replace(/\?.*$/, "");
}

/** 为 WebView 媒体 URL 附加缓存破坏参数 */
export function appendCacheBust(url: string, timestamp: number): string {
    return `${stripUrlQuery(url)}?${THUMBNAIL_CACHE_BUST_PARAM}=${timestamp}`;
}

/** 缩略图 bust map 的稳定键：绝对磁盘路径，避免不同文件夹同名文件冲突 */
export function getThumbnailBustKey(image: Image): string {
    return webviewMediaUrlToAbsolutePath(image.thumbnail || image.src);
}

function resolveThumbnailCacheToken(image: Image): number | undefined {
    const key = getThumbnailBustKey(image);
    const token = Math.max(
        mtimeMsByThumbnailPath.value[key] ?? 0,
        bustTimestampByThumbnailPath.value[key] ?? 0,
    );
    return token > 0 ? token : undefined;
}

/** 记录缩略图已重建，返回 bust 时间戳 */
export function markThumbnailRebuilt(image: Image, timestamp: number = Date.now()): number {
    const key = getThumbnailBustKey(image);
    bustTimestampByThumbnailPath.value = {
        ...bustTimestampByThumbnailPath.value,
        [key]: timestamp,
    };
    mtimeMsByThumbnailPath.value = {
        ...mtimeMsByThumbnailPath.value,
        [key]: timestamp,
    };
    return timestamp;
}

/** 网格展示用缩略图 URL：mtime / 会话 bust → ?t= */
export function getThumbnailDisplaySrc(image: Image): string {
    const token = resolveThumbnailCacheToken(image);
    if (token === undefined) {
        return image.thumbnail;
    }
    return appendCacheBust(image.thumbnail, token);
}

/** BaseImage :key — cache token 变化时强制重挂载 */
export function getThumbnailRenderKey(image: Image): string {
    const token = resolveThumbnailCacheToken(image);
    return token === undefined ? image.key : `${image.key}:${token}`;
}

/** 写入磁盘 mtime 映射（由 ImageListHelper.hydrateFolderThumbnailMtimes 调用） */
export function applyThumbnailMtimes(entries: Record<string, number>): void {
    mtimeMsByThumbnailPath.value = {
        ...mtimeMsByThumbnailPath.value,
        ...entries,
    };
}

/** 仅测试：重置状态 */
export function resetThumbnailBustStateForTests(): void {
    bustTimestampByThumbnailPath.value = {};
    mtimeMsByThumbnailPath.value = {};
}
