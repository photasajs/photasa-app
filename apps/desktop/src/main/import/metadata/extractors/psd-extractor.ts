import path from "path";
import { readFile } from "fs-extra";
import { readPsd } from "ag-psd";
import type { PhotasaLogger } from "@common/logger";
import type { FileMetadata } from "@common/import-types";

/**
 * PSD文件元数据接口
 */
export interface PsdFileMetadata extends FileMetadata {
    // PSD文件特有属性
    layers?: number;
    colorMode?: string;
    version?: string;
    hasTransparency?: boolean;
    artboardCount?: number;
}

/**
 * 检查文件是否为PSD文件
 */
export function isPsdFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".psd";
}

/**
 * 从PSD文件中提取元数据（内部函数）
 */
async function extractPsdMetadataInternal(
    filePath: string,
    logger: PhotasaLogger,
): Promise<Partial<PsdFileMetadata>> {
    try {
        const buffer = await readFile(filePath);
        const psd = readPsd(buffer);

        if (!psd) {
            throw new Error("Failed to parse PSD file");
        }

        return {
            width: psd.width,
            height: psd.height,
            layers: psd.children?.length || 0,
            colorMode: psd.colorMode?.toString() || "unknown",
            version: psd.version?.toString(),
            hasTransparency: false, // ag-psd does not provide alpha channel info directly
            artboardCount: 0, // ag-psd does not provide artboard info directly
        };
    } catch (error) {
        logger.error(`[psd-extractor] Failed to extract PSD metadata from ${filePath}: ${error}`);
        throw error;
    }
}

/**
 * 提取PSD文件元数据
 */
export async function extractPsdMetadata(
    filePath: string,
    logger: PhotasaLogger,
): Promise<PsdFileMetadata> {
    try {
        const metadata = await extractPsdMetadataInternal(filePath, logger);

        // 构建完整的元数据对象
        const result: PsdFileMetadata = {
            path: filePath,
            name: path.basename(filePath),
            type: "ai",
            format: "PSD",
            size: metadata.size || 0,
            width: metadata.width || 0,
            height: metadata.height || 0,
            createdTime: metadata.creationTime || new Date(),
            modifiedTime: metadata.modifiedTime || new Date(),
            dateSource: "file_created",
            // PSD文件特有属性
            layers: metadata.layers || 0,
            colorMode: metadata.colorMode || "unknown",
            version: metadata.version || "unknown",
            hasTransparency: metadata.hasTransparency || false,
            artboardCount: metadata.artboardCount || 0,
        };

        logger.info(`[psd-extractor] Successfully extracted PSD metadata for ${filePath}`);
        return result;
    } catch (error) {
        logger.error(`[psd-extractor] Failed to extract PSD metadata from ${filePath}: ${error}`);
        throw error;
    }
}

/**
 * 获取PSD文件格式的显示名称
 */
export function getPsdFormatName(): string {
    return "Photoshop";
}
