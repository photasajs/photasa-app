import path from "path";
import sharp from "sharp";
import type { ThumbnailRequest } from "@common/thumbnail-types";
import { toPreviewPath } from "@shared/path-util";
import { getOptimalThumbnailResolution } from "@common/utils";
import type { PhotasaLogger } from "@common/logger";

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
 * 创建回退缩略图
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
