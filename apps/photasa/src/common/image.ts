import type { Photo } from "@photasa/common";
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
    // 规范化路径分隔符
    const normalizedFolder = currentFolder.replace(/\\/g, "/");
    const normalizedFile = file.replace(/\\/g, "/");

    // 确保文件夹路径以 / 开头
    const cleanFolder = normalizedFolder.startsWith("/")
        ? normalizedFolder
        : `/${normalizedFolder}`;

    // 移除文件夹路径末尾的 /，避免双斜杠
    const trimmedFolder = cleanFolder.endsWith("/") ? cleanFolder.slice(0, -1) : cleanFolder;

    // 确保文件路径不以 / 开头，避免双斜杠
    const cleanFile = normalizedFile.startsWith("/") ? normalizedFile.slice(1) : normalizedFile;

    // 分别编码文件夹和文件路径的每个组件，但保留 / 分隔符
    // 这样可以避免特殊字符（如中文）导致的 URL 截断问题
    const encodedFolder = trimmedFolder
        .split("/")
        .map((segment) => (segment === "" ? "" : encodeURIComponent(segment)))
        .join("/");

    const encodedFile = cleanFile
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

    // 构建 file:// URL
    return `file://${encodedFolder}/${encodedFile}`;
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
        isVideo: file.isVideo ?? false, // 确保 isVideo 始终是 boolean 类型
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
