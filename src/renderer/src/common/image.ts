import type { Photo } from "@common/config-types";
import type { ImageTypeResult } from "image-type";
import type { Tags, XmpTags, IccTags } from "exifreader";
import { splitEvery } from "ramda";
import { safePositiveNumber } from "./number";

/**
 * 卡片
 */
export type Card = {
    title: string;
    parts: string[];
    images: Image[];
};

/**
 * 图片
 */
export type Image = {
    key: string;
    src: string;
    thumbnail: string;
    preview: string;
    raw: string; // For Heic file, it's the original file
    isVideo: boolean;
};

/**
 * 图片元数据
 */
export type ImageMeta = {
    imageType: ImageTypeResult | string | undefined;
    tags: Tags | XmpTags | IccTags;
    path: string;
    maxDepth: number;
    json: string;
};

export type ImageMetaViewModel = {
    src: string;
    w: number;
    h: number;
    title: string;
    isVideo: boolean;
    raw: string;
    thumbnail: string;
    preview?: string;
};

/**
 * 将 Photo 转换为预览图片
 * @param file 照片
 * @returns 预览图片
 */
export function toPreviewableImage(file: Photo): string {
    // 浏览器不支持 heic 格式，所以在进库时 已将其转换为 jpeg 格式
    // 如果文件路径包含 .heic，则从缩略图路径推导预览图路径
    if (file.path.indexOf(".heic") >= 0) {
        // 缩略图格式: .photasaoriginals/thumbnail-{filename}.heic.png
        // 预览图格式: .photasaoriginals/{filename}.jpeg
        // 先移除 "thumbnail-" 前缀，再替换 ".heic.png" 为 ".jpeg"
        return file.thumbnail.replace("thumbnail-", "").replace(".heic.png", ".jpeg");
    }
    return file.path;
}

/**
 * 将文件路径转换为文件协议
 * @param currentFolder 当前文件夹
 * @param file 文件路径
 * @returns 文件协议
 */
export function toFileProtocol(currentFolder: string, file: string): string {
    return `file://${currentFolder}/${file}`;
}

/**
 * 移除文件协议
 * @param file 文件路径
 * @returns 移除文件协议后的文件路径
 */
export function removeFileProtocol(file: string): string {
    return file.replace("file://", "");
}

/**
 * 将 Photo 转换为 Image
 * @param currentFolder 当前文件夹
 * @param file 照片
 * @returns Image
 */
export function toImage(currentFolder: string, file: Photo): Image {
    const preview = toPreviewableImage(file);
    return {
        key: file.path,
        src: toFileProtocol(currentFolder, file.thumbnail),
        thumbnail: toFileProtocol(currentFolder, file.thumbnail),
        preview: toFileProtocol(currentFolder, preview),
        raw: toFileProtocol(currentFolder, file.path),
        isVideo: file.isVideo,
    };
}

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 900;

/**
 * 将 Image 转换为 ImageMetaViewModel
 * @param image 图片
 * @param width 宽度
 * @param height 高度
 * @returns ImageMetaViewModel
 */
export function toImageMeta(
    image: Image,
    { width, height }: { width: number; height: number } = {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
    },
): ImageMetaViewModel {
    return {
        src: image.preview,
        w: width,
        h: height,
        title: image.key,
        isVideo: image.isVideo,
        raw: image.raw,
        thumbnail: image.thumbnail,
        preview: image.preview,
    };
}

/**
 * 将图片数组按列数分组为二维数组（每组最多 cols 个）
 * @param images 图片数组
 * @param cols 每组列数
 * @returns 二维图片数组
 */
export function groupImagesByColumns(images: Image[], cols: number): Image[][] {
    // 如果图片数组为空，直接返回空数组
    if (images.length === 0) {
        return [];
    }
    // 使用 Ramda 的 splitEvery 实现分组
    return splitEvery(safePositiveNumber(cols), images);
}
