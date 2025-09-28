/**
 * FallbackBrush - 回退神笔
 * 处理不支持格式和错误恢复的通用神笔
 * 为所有文件类型生成通用的占位符缩略图
 */

import path from "path";
import sharp from "sharp";
import { BaseMagicBrush } from "../../core/MagicBrush";

import type { PhotasaLogger } from "@common/logger";
import type { Metadata, ThumbnailOptions, PaintOperation } from "../../types/BrushTypes";

/**
 * 文件类型配置
 */
interface FileTypeConfig {
    icon: string;
    color: string;
    label: string;
}

/**
 * FallbackBrush处理错误类
 */
export class FallbackProcessingError extends Error {
    public readonly code: string;
    constructor(message: string, code = "FALLBACK_ERROR") {
        super(message);
        this.name = "FallbackProcessingError";
        this.code = code;
    }
}

/**
 * FallbackBrush - 通用回退神笔
 * 作为最后的选择，为任何文件生成占位符缩略图
 */
export class FallbackBrush extends BaseMagicBrush {
    public readonly name = "FallbackBrush";
    public readonly supportedFormats = ["*"]; // 支持所有格式作为回退
    public readonly capabilities: PaintOperation[] = ["extractMetadata", "generateThumbnail"];
    public readonly priority: number = 1; // 最低优先级

    /**
     * 提取基础元数据（仅文件系统信息）
     */
    public async extractEssence(filePath: string, logger: PhotasaLogger): Promise<Metadata | null> {
        logger.debug(`[${this.name}] 提取基础元数据: ${filePath}`);
        this.validateFilePath(filePath);

        try {
            const fs = await import("fs-extra");
            const stats = await fs.stat(filePath);

            return {
                format: "UNKNOWN",
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                width: 0,
                height: 0,
            };
        } catch (error) {
            logger.error(`[${this.name}] 无法提取元数据:`, error);
            return null;
        }
    }

    /**
     * 创建通用占位符缩略图
     */
    public async createMiniature(
        filePath: string,
        options: ThumbnailOptions,
        logger: PhotasaLogger,
    ): Promise<string | Buffer> {
        logger.debug(`[${this.name}] 创建回退缩略图: ${filePath}`);
        this.validateFilePath(filePath);
        this.validateOptions(options, ["width", "height"]);

        try {
            const fileConfig = this.getFileTypeConfig(filePath);
            const fileName = path.basename(filePath);
            const displayFileName = this.truncateFileName(fileName, 12);

            const svgContent = this.generateSvgContent(
                options.width,
                options.height,
                fileConfig,
                displayFileName,
            );

            const outputFormat = options.format || "jpeg";
            const pipeline = sharp(Buffer.from(svgContent)).toFormat(outputFormat as any, {
                quality: options.quality || 90,
            });

            // 输出到文件或Buffer
            if (options.outputPath) {
                await pipeline.toFile(options.outputPath);
                logger.info(`[${this.name}] 回退缩略图已创建: ${options.outputPath}`);
                return options.outputPath;
            } else {
                const buffer = await pipeline.toBuffer();
                logger.debug(`[${this.name}] 回退缩略图Buffer已创建`);
                return buffer;
            }
        } catch (error) {
            logger.error(`[${this.name}] 创建回退缩略图失败:`, error);
            throw new FallbackProcessingError(`无法创建回退缩略图: ${error}`, "THUMBNAIL_FAILED");
        }
    }

    /**
     * 检查文件支持（FallbackBrush支持所有文件作为最后选择）
     */
    public supports(_: string): boolean {
        // FallbackBrush支持所有文件，但由于优先级最低，只有在没有其他神笔时才会被选择
        return true;
    }

    // === 私有辅助方法 ===

    /**
     * 获取文件类型配置
     */
    private getFileTypeConfig(filePath: string): FileTypeConfig {
        const ext = this.getFileExtension(filePath).toLowerCase();

        // 图像格式
        if (
            [
                "jpg",
                "jpeg",
                "png",
                "gif",
                "bmp",
                "webp",
                "tiff",
                "tif",
                "svg",
                "ico",
                "heic",
                "heif",
                "avif",
            ].includes(ext)
        ) {
            return { icon: "📷", color: "#28a745", label: "Image" };
        }

        // 视频格式
        if (
            [
                "mp4",
                "avi",
                "mov",
                "mkv",
                "webm",
                "flv",
                "wmv",
                "mpeg",
                "mpg",
                "m4v",
                "3gp",
                "ogv",
                "asf",
                "rmvb",
            ].includes(ext)
        ) {
            return { icon: "🎬", color: "#dc3545", label: "Video" };
        }

        // 音频格式
        if (["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a", "opus"].includes(ext)) {
            return { icon: "🎵", color: "#6f42c1", label: "Audio" };
        }

        // 文档格式
        if (
            [
                "pdf",
                "doc",
                "docx",
                "xls",
                "xlsx",
                "ppt",
                "pptx",
                "txt",
                "rtf",
                "odt",
                "ods",
                "odp",
            ].includes(ext)
        ) {
            return { icon: "📄", color: "#007bff", label: "Document" };
        }

        // 压缩文件
        if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) {
            return { icon: "📦", color: "#fd7e14", label: "Archive" };
        }

        // 代码文件
        if (
            [
                "js",
                "ts",
                "jsx",
                "tsx",
                "html",
                "css",
                "scss",
                "less",
                "json",
                "xml",
                "yaml",
                "yml",
                "py",
                "java",
                "cpp",
                "c",
                "h",
                "cs",
                "php",
                "rb",
                "go",
                "rs",
                "swift",
                "kt",
            ].includes(ext)
        ) {
            return { icon: "💻", color: "#20c997", label: "Code" };
        }

        // 默认
        return { icon: "📁", color: "#6c757d", label: "File" };
    }

    /**
     * 截断文件名用于显示
     */
    private truncateFileName(fileName: string, maxLength: number): string {
        return fileName.length > maxLength
            ? fileName.substring(0, maxLength - 3) + "..."
            : fileName;
    }

    /**
     * 生成SVG内容
     */
    private generateSvgContent(
        width: number,
        height: number,
        fileConfig: FileTypeConfig,
        displayFileName: string,
    ): string {
        return `
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
    }
}
