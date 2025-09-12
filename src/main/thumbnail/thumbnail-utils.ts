import path from "path";
import sharp from "sharp";
import type { ThumbnailRequest } from "@common/thumbnail-types";
import { toPreviewPath } from "@shared/path-util";
import { getOptimalThumbnailResolution } from "@common/utils";
import type { PhotasaLogger } from "@common/logger";

/**
 * 文件类型映射 - 根据文件扩展名确定显示样式
 */
const FILE_TYPE_CONFIG = {
    // 文档类型
    pdf: { icon: "PDF", color: "#dc3545", label: "document" },
    doc: { icon: "DOC", color: "#2b579a", label: "document" },
    docx: { icon: "DOC", color: "#2b579a", label: "document" },
    xls: { icon: "XLS", color: "#107c41", label: "document" },
    xlsx: { icon: "XLS", color: "#107c41", label: "document" },
    ppt: { icon: "PPT", color: "#d24726", label: "document" },
    pptx: { icon: "PPT", color: "#d24726", label: "document" },
    txt: { icon: "TXT", color: "#6c757d", label: "document" },
    rtf: { icon: "RTF", color: "#6c757d", label: "document" },

    // 音频类型
    mp3: { icon: "MP3", color: "#ff6b35", label: "audio" },
    wav: { icon: "WAV", color: "#ff6b35", label: "audio" },
    flac: { icon: "FLAC", color: "#ff6b35", label: "audio" },
    aac: { icon: "AAC", color: "#ff6b35", label: "audio" },
    ogg: { icon: "OGG", color: "#ff6b35", label: "audio" },
    wma: { icon: "WMA", color: "#ff6b35", label: "audio" },

    // 压缩文件
    zip: { icon: "ZIP", color: "#ffc107", label: "archive" },
    rar: { icon: "RAR", color: "#ffc107", label: "archive" },
    "7z": { icon: "7Z", color: "#ffc107", label: "archive" },
    tar: { icon: "TAR", color: "#ffc107", label: "archive" },
    gz: { icon: "GZ", color: "#ffc107", label: "archive" },

    // 代码文件
    js: { icon: "JS", color: "#f7df1e", label: "code" },
    ts: { icon: "TS", color: "#3178c6", label: "code" },
    html: { icon: "HTML", color: "#e34c26", label: "code" },
    css: { icon: "CSS", color: "#1572b6", label: "code" },
    json: { icon: "JSON", color: "#000000", label: "code" },
    xml: { icon: "XML", color: "#ff6600", label: "code" },
    py: { icon: "PY", color: "#3776ab", label: "code" },
    java: { icon: "JAVA", color: "#ed8b00", label: "code" },
    cpp: { icon: "C++", color: "#00599c", label: "code" },
    c: { icon: "C", color: "#a8b9cc", label: "code" },

    // 其他常见格式
    exe: { icon: "EXE", color: "#6c757d", label: "executable" },
    dmg: { icon: "DMG", color: "#007acc", label: "package" },
    iso: { icon: "ISO", color: "#6c757d", label: "image" },
    db: { icon: "DB", color: "#336791", label: "database" },
    sql: { icon: "SQL", color: "#336791", label: "database" },
} as const;

/**
 * 默认文件类型配置
 */
const DEFAULT_FILE_CONFIG = { icon: "FILE", color: "#6c757d", label: "unknown" } as const;

/**
 * 计算缓冲区大小容差
 */
export function calculateBufferTolerance(expectedSize: number): number {
    return Math.max(1024, expectedSize * 0.01);
}

/**
 * 检查缓冲区大小是否在容差范围内
 */
export function isBufferSizeWithinTolerance(
    actualSize: number,
    expectedSize: number,
): { isWithin: boolean; difference: number; tolerance: number } {
    const difference = Math.abs(actualSize - expectedSize);
    const tolerance = calculateBufferTolerance(expectedSize);
    return { isWithin: difference <= tolerance, difference, tolerance };
}

/**
 * 尝试调整图像尺寸以适应缓冲区
 */
export function calculateAdjustedDimensions(
    decoded: Uint8Array,
    width: number,
    channels: number,
): { width: number; height: number; channels: number } | null {
    if (decoded.length <= width * channels) return null;

    const actualPixels = Math.floor(decoded.length / channels);
    const adjustedHeight = Math.floor(actualPixels / width);

    if (adjustedHeight > 0 && adjustedHeight * width * channels <= decoded.length) {
        return { width, height: adjustedHeight, channels };
    }

    return null;
}

/**
 * 将 RGB 缓冲区转换为 RGBA
 */
export function convertRgbToRgba(rgbBuffer: Uint8Array, width: number, height: number): Buffer {
    const rgbaBuffer = Buffer.alloc(width * height * 4);
    for (let i = 0, j = 0; i < rgbBuffer.length; i += 3, j += 4) {
        rgbaBuffer[j] = rgbBuffer[i];
        rgbaBuffer[j + 1] = rgbBuffer[i + 1];
        rgbaBuffer[j + 2] = rgbBuffer[i + 2];
        rgbaBuffer[j + 3] = 255; // alpha
    }
    return rgbaBuffer;
}

/**
 * 获取文件类型配置
 */
function getFileTypeConfig(filePath: string): { icon: string; color: string; label: string } {
    const ext = path.extname(filePath).toLowerCase().slice(1); // 移除点并转小写
    return FILE_TYPE_CONFIG[ext as keyof typeof FILE_TYPE_CONFIG] || DEFAULT_FILE_CONFIG;
}

/**
 * 创建通用文件占位符缩略图
 */
export async function createGenericFallbackThumbnail(
    arg: ThumbnailRequest,
    logger: PhotasaLogger,
): Promise<string | null> {
    try {
        // 使用缩略图路径而不是预览路径
        const thumbnailPath = arg.thumbnail;
        const { width, height } = getOptimalThumbnailResolution(
            { width: 1, height: 1 },
            { width: 200, height: 200 },
        );

        const fileConfig = getFileTypeConfig(arg.path);
        const fileName = path.basename(arg.path);
        const maxFileNameLength = 12; // 文件名最大显示长度
        const displayFileName =
            fileName.length > maxFileNameLength
                ? fileName.substring(0, maxFileNameLength - 3) + "..."
                : fileName;

        const svgContent = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#f8f9fa;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#e9ecef;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <!-- 背景 -->
                <rect width="100%" height="100%" fill="url(#bgGradient)" rx="8"/>
                <!-- 边框 -->
                <rect x="2" y="2" width="${width - 4}" height="${height - 4}"
                      fill="none" stroke="#dee2e6" stroke-width="1" rx="6"/>
                <!-- 文件类型图标背景 -->
                <rect x="20%" y="25%" width="60%" height="35%"
                      fill="${fileConfig.color}" rx="4" opacity="0.9"/>
                <!-- 文件类型文本 -->
                <text x="50%" y="42%" text-anchor="middle" dy=".3em"
                      font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="white">
                    ${fileConfig.icon}
                </text>
                <!-- 文件名 -->
                <text x="50%" y="75%" text-anchor="middle"
                      font-family="Arial, sans-serif" font-size="9" fill="#495057">
                    ${displayFileName}
                </text>
                <!-- 文件类型标签 -->
                <text x="50%" y="88%" text-anchor="middle"
                      font-family="Arial, sans-serif" font-size="8" fill="#6c757d">
                    ${fileConfig.label.toUpperCase()}
                </text>
            </svg>
        `;

        await sharp(Buffer.from(svgContent)).toFormat("jpeg").toFile(thumbnailPath);
        logger.info(`[thumbnail-handler] Generic fallback thumbnail created: ${thumbnailPath}`);
        return thumbnailPath;
    } catch (error) {
        logger.error("[thumbnail-handler] Failed to create generic fallback thumbnail:", error);
        return null;
    }
}

/**
 * 创建回退缩略图（HEIC专用）
 */
export async function createFallbackThumbnail(
    arg: ThumbnailRequest,
    logger: PhotasaLogger,
): Promise<string | null> {
    try {
        const previewName = toPreviewPath(arg.path);
        const { width, height } = getOptimalThumbnailResolution(
            { width: 1, height: 1 },
            { width: 200, height: 200 },
        );

        const svgContent = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f0f0f0"/>
                <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="14" fill="#666">
                    HEIC
                </text>
                <text x="50%" y="70%" text-anchor="middle" font-family="Arial" font-size="10" fill="#999">
                    ${path.basename(arg.path)}
                </text>
            </svg>
        `;

        await sharp(Buffer.from(svgContent)).toFormat("jpeg").toFile(previewName);
        logger.info(`[thumbnail-handler] Fallback thumbnail created: ${previewName}`);
        return previewName;
    } catch (error) {
        logger.error("[thumbnail-handler] Failed to create fallback thumbnail:", error);
        return null;
    }
}

/**
 * 处理调整后的缓冲区
 */
export async function processAdjustedBuffer(
    decoded: Uint8Array,
    dimensions: { width: number; height: number; channels: number },
    previewName: string,
    logger: PhotasaLogger,
): Promise<string> {
    const { width, height, channels } = dimensions;
    const expectedSize = width * height * channels;

    if (decoded.length < expectedSize) {
        throw new Error(
            `Buffer too small for adjusted dimensions: need ${expectedSize}, got ${decoded.length}`,
        );
    }

    const validBuffer = decoded.slice(0, expectedSize);
    const rgbaBuffer =
        channels === 4 ? Buffer.from(validBuffer) : convertRgbToRgba(validBuffer, width, height);

    if (channels === 3) {
        logger.info(`[wasm-heif] Adjusted RGB buffer补齐为RGBA, new length=${rgbaBuffer.length}`);
    }

    await sharp(rgbaBuffer, { raw: { width, height, channels: 4 } })
        .toFormat("jpeg")
        .toFile(previewName);

    return previewName;
}
