/**
 * FormatDetector - 格式检测器
 * 智能识别文件格式，为神笔选择提供依据
 */

import { readFile } from "fs-extra";
import path from "path";
import type { PhotasaLogger } from "@common/logger";

// 文件签名定义
interface FileSignature {
    format: string;
    signatures: Buffer[];
    description: string;
}

// 文件头检测结果
export interface DetectionResult {
    format: string;
    confidence: number; // 0-100
    method: "signature" | "extension" | "fallback";
    detectedExtension?: string;
    actualExtension?: string;
}

/**
 * 格式检测器类
 * 通过文件头和扩展名智能识别文件格式
 */
export class FormatDetector {
    private static readonly FILE_SIGNATURES: FileSignature[] = [
        // 图像格式
        {
            format: "jpeg",
            signatures: [Buffer.from([0xff, 0xd8, 0xff])],
            description: "JPEG image",
        },
        {
            format: "png",
            signatures: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
            description: "PNG image",
        },
        {
            format: "gif",
            signatures: [Buffer.from("GIF87a", "ascii"), Buffer.from("GIF89a", "ascii")],
            description: "GIF image",
        },
        {
            format: "bmp",
            signatures: [Buffer.from([0x42, 0x4d])], // "BM"
            description: "Bitmap image",
        },
        {
            format: "webp",
            signatures: [Buffer.from("RIFF", "ascii")], // 需要进一步检查 WEBP 标识
            description: "WebP image",
        },
        {
            format: "tiff",
            signatures: [
                Buffer.from([0x49, 0x49, 0x2a, 0x00]), // Little endian
                Buffer.from([0x4d, 0x4d, 0x00, 0x2a]), // Big endian
            ],
            description: "TIFF image",
        },
        {
            format: "heic",
            signatures: [Buffer.from("ftyp", "ascii")], // 需要进一步检查 HEIC 标识
            description: "HEIC image",
        },

        // 视频格式
        {
            format: "mp4",
            signatures: [
                Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]), // ftyp
                Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
            ],
            description: "MP4 video",
        },
        {
            format: "avi",
            signatures: [Buffer.from("RIFF", "ascii")], // 需要进一步检查 AVI 标识
            description: "AVI video",
        },
        {
            format: "mov",
            signatures: [Buffer.from([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74])],
            description: "QuickTime video",
        },
        {
            format: "mkv",
            signatures: [Buffer.from([0x1a, 0x45, 0xdf, 0xa3])],
            description: "Matroska video",
        },
        {
            format: "wmv",
            signatures: [Buffer.from([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11])],
            description: "Windows Media Video",
        },
        {
            format: "mpeg",
            signatures: [
                Buffer.from([0x00, 0x00, 0x01, 0xba]), // MPEG-1/2 PS
                Buffer.from([0x00, 0x00, 0x01, 0xb3]), // MPEG video sequence
            ],
            description: "MPEG video",
        },
        {
            format: "mpg",
            signatures: [
                Buffer.from([0x00, 0x00, 0x01, 0xba]), // Same as MPEG
                Buffer.from([0x00, 0x00, 0x01, 0xb3]),
            ],
            description: "MPEG video (mpg)",
        },
    ];

    private static readonly EXTENSION_MAP: Record<string, string> = {
        // 图像格式
        jpg: "jpeg",
        jpeg: "jpeg",
        png: "png",
        gif: "gif",
        bmp: "bmp",
        webp: "webp",
        tiff: "tiff",
        tif: "tiff",
        heic: "heic",
        heif: "heic",

        // 视频格式
        mp4: "mp4",
        m4v: "mp4",
        mov: "mov",
        avi: "avi",
        mkv: "mkv",
        wmv: "wmv",
        mpeg: "mpeg",
        mpg: "mpg",
        m2v: "mpeg",
        flv: "flv",
        webm: "webm",
        "3gp": "3gp",
    };

    /**
     * 检测文件格式
     * @param filePath 文件路径
     * @param logger 日志记录器
     * @returns Promise<DetectionResult>
     */
    public static async detect(filePath: string, logger?: PhotasaLogger): Promise<DetectionResult> {
        try {
            // 首先尝试文件头检测
            const signatureResult = await this.detectBySignature(filePath, logger);
            if (signatureResult.confidence > 80) {
                return signatureResult;
            }

            // 回退到扩展名检测
            const extensionResult = this.detectByExtension(filePath, logger);

            // 如果文件头检测有结果但置信度不高，结合扩展名判断
            if (signatureResult.confidence > 0 && extensionResult.confidence > 0) {
                if (signatureResult.format === extensionResult.format) {
                    return {
                        ...signatureResult,
                        confidence: Math.max(
                            signatureResult.confidence,
                            extensionResult.confidence,
                        ),
                        method: "signature",
                    };
                } else {
                    logger?.warn(
                        `Format mismatch: signature detected ${signatureResult.format}, extension suggests ${extensionResult.format}`,
                    );
                    return signatureResult.confidence > extensionResult.confidence
                        ? signatureResult
                        : extensionResult;
                }
            }

            // 返回最佳结果
            return signatureResult.confidence > extensionResult.confidence
                ? signatureResult
                : extensionResult;
        } catch (error) {
            logger?.error("Format detection failed:", error);

            // 最后的回退方案
            return {
                format: "unknown",
                confidence: 0,
                method: "fallback",
                actualExtension: this.getFileExtension(filePath),
            };
        }
    }

    /**
     * 通过文件签名检测格式
     */
    private static async detectBySignature(
        filePath: string,
        logger?: PhotasaLogger,
    ): Promise<DetectionResult> {
        try {
            // 读取文件头部（前64字节通常足够）
            const buffer = await readFile(filePath);
            const header = buffer.slice(0, 64);

            logger?.debug(
                `Checking file signature for ${path.basename(filePath)}, header: ${header.toString("hex").substring(0, 32)}...`,
            );

            // 检查每种格式的签名
            for (const signature of this.FILE_SIGNATURES) {
                for (const sig of signature.signatures) {
                    if (this.matchesSignature(header, sig, signature.format)) {
                        logger?.debug(
                            `Signature match found: ${signature.format} (${signature.description})`,
                        );

                        return {
                            format: signature.format,
                            confidence: 95,
                            method: "signature",
                            detectedExtension: signature.format,
                            actualExtension: this.getFileExtension(filePath),
                        };
                    }
                }
            }

            logger?.debug("No signature match found");
            return {
                format: "unknown",
                confidence: 0,
                method: "signature",
                actualExtension: this.getFileExtension(filePath),
            };
        } catch (error) {
            logger?.error("Signature detection failed:", error);
            return {
                format: "unknown",
                confidence: 0,
                method: "signature",
                actualExtension: this.getFileExtension(filePath),
            };
        }
    }

    /**
     * 检查缓冲区是否匹配签名
     */
    private static matchesSignature(buffer: Buffer, signature: Buffer, format: string): boolean {
        if (buffer.length < signature.length) {
            return false;
        }

        // 特殊处理某些需要额外验证的格式
        if (format === "webp") {
            // RIFF + WebP 标识
            if (
                buffer.indexOf(signature) === 0 &&
                buffer.indexOf(Buffer.from("WEBP", "ascii")) === 8
            ) {
                return true;
            }
            return false;
        }

        if (format === "avi") {
            // RIFF + AVI 标识
            if (
                buffer.indexOf(signature) === 0 &&
                buffer.indexOf(Buffer.from("AVI ", "ascii")) === 8
            ) {
                return true;
            }
            return false;
        }

        if (format === "heic") {
            // ftyp + HEIC 标识
            const ftypIndex = buffer.indexOf(signature);
            if (ftypIndex >= 4 && ftypIndex <= 8) {
                const heicMarkers = [
                    Buffer.from("heic", "ascii"),
                    Buffer.from("heix", "ascii"),
                    Buffer.from("hevc", "ascii"),
                    Buffer.from("hevx", "ascii"),
                ];

                for (const marker of heicMarkers) {
                    if (buffer.indexOf(marker, ftypIndex) > 0) {
                        return true;
                    }
                }
            }
            return false;
        }

        // 标准签名匹配
        return buffer.indexOf(signature) === 0;
    }

    /**
     * 通过扩展名检测格式
     */
    private static detectByExtension(filePath: string, logger?: PhotasaLogger): DetectionResult {
        const ext = this.getFileExtension(filePath);
        const format = this.EXTENSION_MAP[ext];

        if (format) {
            logger?.debug(`Extension detection: ${ext} -> ${format}`);
            return {
                format,
                confidence: 70,
                method: "extension",
                detectedExtension: format,
                actualExtension: ext,
            };
        }

        logger?.debug(`Unknown extension: ${ext}`);
        return {
            format: "unknown",
            confidence: 0,
            method: "extension",
            actualExtension: ext,
        };
    }

    /**
     * 获取文件扩展名
     */
    private static getFileExtension(filePath: string): string {
        return path.extname(filePath).toLowerCase().slice(1);
    }

    /**
     * 检查格式是否为图像
     */
    public static isImageFormat(format: string): boolean {
        const imageFormats = ["jpeg", "png", "gif", "bmp", "webp", "tiff", "heic"];
        return imageFormats.includes(format);
    }

    /**
     * 检查格式是否为视频
     */
    public static isVideoFormat(format: string): boolean {
        const videoFormats = [
            "mp4",
            "mov",
            "avi",
            "mkv",
            "wmv",
            "mpeg",
            "mpg",
            "flv",
            "webm",
            "3gp",
        ];
        return videoFormats.includes(format);
    }

    /**
     * 获取格式的显示名称
     */
    public static getFormatDisplayName(format: string): string {
        const displayNames: Record<string, string> = {
            jpeg: "JPEG",
            png: "PNG",
            gif: "GIF",
            bmp: "Bitmap",
            webp: "WebP",
            tiff: "TIFF",
            heic: "HEIC",
            mp4: "MP4",
            mov: "QuickTime",
            avi: "AVI",
            mkv: "Matroska",
            wmv: "Windows Media",
            mpeg: "MPEG",
            mpg: "MPEG",
            flv: "Flash Video",
            webm: "WebM",
            "3gp": "3GPP",
        };

        return displayNames[format] || format.toUpperCase();
    }
}
