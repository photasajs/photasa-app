import { createThumbnailTask } from "@renderer/utils/api";
import type { PhotasaConfig } from "@photasa/common";
import { toImage } from "@renderer/common/image";
import { toWebviewMediaUrl, webviewMediaUrlToAbsolutePath } from "@renderer/utils/media-url";

import type { Image } from "@renderer/common/image";

/**
 * 将配置转换为图片列表
 * @param currentFolder 当前文件夹
 * @param currentFolderConfig 当前文件夹配置
 * @returns 图片列表
 */
export function toImageList(currentFolder: string, currentFolderConfig: PhotasaConfig) {
    const images = (currentFolderConfig.photoList ?? []).map((photo) =>
        toImage(currentFolder, photo),
    );

    return {
        title: currentFolder,
        images,
        parts: currentFolder?.split("/"),
    };
}

/**
 * 重建缩略图
 * @param image 图片
 * @param thumbnailSize 缩略图大小
 * @returns
 */
export async function requestThumbnail(image: Image, thumbnailSize: number): Promise<string> {
    const sourcePath = webviewMediaUrlToAbsolutePath(image.raw || image.preview);
    const thumbnailPath = webviewMediaUrlToAbsolutePath(image.thumbnail || image.src);

    const result = await createThumbnailTask.perform({
        path: sourcePath,
        thumbnail: thumbnailPath,
        width: thumbnailSize,
        height: thumbnailSize,
        always: true,
        preview: "",
    });

    if (!result?.success) {
        throw new Error(result?.error ?? "缩略图重建失败");
    }

    // 返回带缓存破坏的 WebView URL；勿写回 image — card 为 computed，原地赋值不触发渲染
    return `${toWebviewMediaUrl(thumbnailPath)}?t=${Date.now()}`;
}

const DEFAULT_GAP = 16;
const DEFAULT_PADDING = 24; // px-4 左右各 16

/**
 * 计算列数
 * @param containerWidth 容器宽度
 * @param thumbnailSize 缩略图大小
 * @returns 列数
 */
export function computeColumns(
    containerWidth: number,
    thumbnailSize: number,
    { gap = DEFAULT_GAP, padding = DEFAULT_PADDING }: { gap?: number; padding?: number } = {},
) {
    if (!containerWidth) {
        return 1;
    }
    // 实际卡片宽度就是缩略图大小，不需要额外的 padding
    const cardWidth = thumbnailSize;
    const available = containerWidth - 2 * padding; // 减去左右 padding
    const cols = Math.floor(available / (cardWidth + gap));

    return Math.max(1, cols);
}
