import { ref } from "vue";
import type { Image } from "@renderer/common/image";
import { webviewMediaUrlToAbsolutePath } from "@renderer/utils/media-url";

/** 缩略图 URL 缓存破坏 query 参数名 */
export const THUMBNAIL_CACHE_BUST_PARAM = "t" as const;

/** 本会话内已重建缩略图的 bust 时间戳（按磁盘缩略图路径，跨文件夹切换保留） */
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

/** 记录缩略图已重建，返回 bust 时间戳 */
export function markThumbnailRebuilt(image: Image, timestamp: number = Date.now()): number {
    const key = getThumbnailBustKey(image);
    bustTimestampByThumbnailPath.value = {
        ...bustTimestampByThumbnailPath.value,
        [key]: timestamp,
    };
    return timestamp;
}

/** 读取某张图当前 bust 时间戳（无则 undefined） */
export function getThumbnailBustTimestamp(image: Image): number | undefined {
    return bustTimestampByThumbnailPath.value[getThumbnailBustKey(image)];
}

/** 网格展示用缩略图 URL：有 bust 则带 ?t=，否则用 config 原始 URL */
export function getThumbnailDisplaySrc(image: Image): string {
    const bust = getThumbnailBustTimestamp(image);
    if (bust === undefined) {
        return image.thumbnail;
    }
    return appendCacheBust(image.thumbnail, bust);
}

/** BaseImage :key — bust 变化时强制重挂载 */
export function getThumbnailRenderKey(image: Image): string {
    const bust = getThumbnailBustTimestamp(image);
    return bust === undefined ? image.key : `${image.key}:${bust}`;
}

/** 仅测试：重置 session bust 状态 */
export function resetThumbnailBustStateForTests(): void {
    bustTimestampByThumbnailPath.value = {};
}
