import { ensureWebviewMediaUrl, webviewMediaUrlToAbsolutePath } from "@renderer/utils/media-url";

export type ImageLoadFallbackInput = {
    currentSrc: string;
    preview?: string;
    raw?: string;
    fallback?: string;
    /** 默认 true：网格缩略图失败时可回退到 fallback；预览/lightbox 应设为 false */
    fallbackToThumbnail?: boolean;
};

/** 将任意 WebView 媒体 URL 规范化为磁盘路径键，避免 asset/file 字符串形式不同导致重复尝试 */
export function mediaPathKey(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) {
        return "";
    }
    return webviewMediaUrlToAbsolutePath(trimmed).replace(/\\/g, "/");
}

/**
 * 图片 @error 时选择下一候选 src。
 * 按 preview → raw →（可选）fallback 顺序，跳过与当前已失败资源同路径的候选。
 */
export function resolveNextImageSrcOnError(input: ImageLoadFallbackInput): string | null {
    const currentKey = mediaPathKey(input.currentSrc);
    const candidates: string[] = [];

    if (input.preview?.trim()) {
        candidates.push(ensureWebviewMediaUrl(input.preview));
    }
    if (input.raw?.trim()) {
        candidates.push(ensureWebviewMediaUrl(input.raw));
    }
    if (input.fallbackToThumbnail !== false && input.fallback?.trim()) {
        candidates.push(ensureWebviewMediaUrl(input.fallback));
    }

    for (const candidate of candidates) {
        if (mediaPathKey(candidate) !== currentKey) {
            return candidate;
        }
    }

    return null;
}
