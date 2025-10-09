/**
 * 褚遂良路径处理工具
 * 集成RFC 0012统一路径处理架构
 *
 * 设计原理：
 * 1. 统一路径处理：在数据流早期统一处理所有路径
 * 2. 平台无关：支持Windows和Mac的路径格式
 * 3. 验证集成：将路径验证和规范化集成在一起
 * 4. 性能优化：避免重复的路径处理操作
 *
 * RFC 0012集成：
 * - 使用统一的normalizePath函数
 * - 支持file://协议和系统路径
 * - 处理URL编码和特殊字符
 * - 跨平台兼容性
 */

import { normalizePath } from "@renderer/utils/path";
import { loggers } from "@common/logger";

const logger = loggers.chusuiliang;

/**
 * 路径验证结果
 */
export interface PathValidationResult {
    /** 是否有效 */
    isValid: boolean;
    /** 规范化后的路径 */
    normalizedPath: string;
    /** 错误信息（如果有） */
    error?: string;
}

/**
 * 路径重复检查结果
 */
export interface PathDuplicationResult {
    /** 是否重复 */
    isDuplicate: boolean;
    /** 规范化后的路径 */
    normalizedPath: string;
    /** 现有路径列表中的匹配项 */
    existingMatch?: string;
}

/**
 * 验证和规范化单个路径
 * 集成RFC 0012的路径处理能力
 * @param path 输入路径（可能是file://协议或系统路径）
 * @returns 验证结果
 */
export function validateAndNormalizePath(path: string): PathValidationResult {
    try {
        if (!path || typeof path !== "string") {
            return {
                isValid: false,
                normalizedPath: "",
                error: "路径不能为空",
            };
        }

        // 使用RFC 0012的统一路径规范化
        const normalizedPath = normalizePath(path);

        if (!normalizedPath) {
            return {
                isValid: false,
                normalizedPath: "",
                error: "路径规范化失败",
            };
        }

        // 基本路径格式验证
        if (normalizedPath.length < 3) {
            return {
                isValid: false,
                normalizedPath,
                error: "路径长度不足",
            };
        }

        logger.debug("📚 路径验证和规范化完成", {
            original: path,
            normalized: normalizedPath,
        });

        return {
            isValid: true,
            normalizedPath,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("📚 路径验证失败", { path, error: errorMessage });

        return {
            isValid: false,
            normalizedPath: "",
            error: `路径处理错误: ${errorMessage}`,
        };
    }
}

/**
 * 检查路径是否与现有路径重复
 * 支持规范化路径比较，避免不同格式的同一路径被认为是不同的
 * @param newPath 新路径
 * @param existingPaths 现有路径列表
 * @returns 重复检查结果
 */
export function checkPathDuplication(
    newPath: string,
    existingPaths: string[],
): PathDuplicationResult {
    const validationResult = validateAndNormalizePath(newPath);

    if (!validationResult.isValid) {
        return {
            isDuplicate: false,
            normalizedPath: validationResult.normalizedPath,
        };
    }

    const normalizedNewPath = validationResult.normalizedPath;

    // 规范化所有现有路径进行比较
    for (const existingPath of existingPaths) {
        const existingValidation = validateAndNormalizePath(existingPath);

        if (existingValidation.isValid && existingValidation.normalizedPath === normalizedNewPath) {
            logger.debug("📚 检测到重复路径", {
                newPath: normalizedNewPath,
                existingPath: existingValidation.normalizedPath,
            });

            return {
                isDuplicate: true,
                normalizedPath: normalizedNewPath,
                existingMatch: existingPath,
            };
        }
    }

    return {
        isDuplicate: false,
        normalizedPath: normalizedNewPath,
    };
}

/**
 * 批量验证和规范化路径
 * 用于处理多个路径的场景
 * @param paths 路径列表
 * @returns 验证结果列表
 */
export function validateAndNormalizePathsBatch(paths: string[]): PathValidationResult[] {
    logger.debug("📚 开始批量路径验证", { count: paths.length });

    const results = paths.map((path) => validateAndNormalizePath(path));

    const validCount = results.filter((r) => r.isValid).length;
    const invalidCount = results.length - validCount;

    logger.info("📚 批量路径验证完成", {
        total: results.length,
        valid: validCount,
        invalid: invalidCount,
    });

    return results;
}

/**
 * 路径安全性检查
 * 检查路径是否安全，避免恶意路径
 * @param path 路径
 * @returns 是否安全
 */
export function isPathSafe(path: string): boolean {
    if (!path) return false;

    // 检查危险模式
    const dangerousPatterns = [
        /\.\./, // 父目录遍历
        /([^:])\/\//, // 双斜杠（不包括协议中的://）
        /[<>"|?*]/, // Windows非法字符
        /^[A-Z]:\\\s*$/i, // 仅驱动器根目录（Windows）
        /^\/\s*$/, // 仅根目录（Unix）
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(path)) {
            logger.warn("📚 检测到不安全路径模式", { path, pattern: pattern.source });
            return false;
        }
    }

    return true;
}

/**
 * 路径类型检测
 * 检测路径是file://协议还是系统路径
 * @param path 路径
 * @returns 路径类型信息
 */
export function detectPathType(path: string): {
    type: "file-protocol" | "system-path" | "unknown";
    platform?: "windows" | "mac" | "unknown";
    hasUrlEncoding: boolean;
} {
    if (!path) {
        return { type: "unknown", hasUrlEncoding: false };
    }

    const isFileProtocol = path.startsWith("file://");
    const hasUrlEncoding = /%[0-9A-Fa-f]{2}/.test(path);

    if (isFileProtocol) {
        // 检测平台类型
        const platform =
            path.includes("%3A") || path.match(/^file:\/\/\/[A-Z]:/i)
                ? "windows"
                : path.startsWith("file:///Users/")
                  ? "mac"
                  : "unknown";

        return {
            type: "file-protocol",
            platform,
            hasUrlEncoding,
        };
    }

    // 系统路径检测
    const isWindowsPath = /^[A-Z]:[\\\/]/i.test(path);
    const isMacPath = path.startsWith("/Users/") || path.startsWith("/Volumes/");

    return {
        type: "system-path",
        platform: isWindowsPath ? "windows" : isMacPath ? "mac" : "unknown",
        hasUrlEncoding,
    };
}

/**
 * 路径处理统计信息
 * 用于监控和调试路径处理性能
 */
export class PathProcessingStats {
    private static instance: PathProcessingStats | null = null;
    private stats = {
        totalProcessed: 0,
        validPaths: 0,
        invalidPaths: 0,
        duplicates: 0,
        fileProtocolPaths: 0,
        systemPaths: 0,
        urlEncodedPaths: 0,
    };

    static getInstance(): PathProcessingStats {
        if (!PathProcessingStats.instance) {
            PathProcessingStats.instance = new PathProcessingStats();
        }
        return PathProcessingStats.instance;
    }

    recordPathProcessing(
        result: PathValidationResult,
        pathType: ReturnType<typeof detectPathType>,
    ): void {
        this.stats.totalProcessed++;

        if (result.isValid) {
            this.stats.validPaths++;
        } else {
            this.stats.invalidPaths++;
        }

        if (pathType.type === "file-protocol") {
            this.stats.fileProtocolPaths++;
        } else if (pathType.type === "system-path") {
            this.stats.systemPaths++;
        }

        if (pathType.hasUrlEncoding) {
            this.stats.urlEncodedPaths++;
        }
    }

    recordDuplication(): void {
        this.stats.duplicates++;
    }

    getStats() {
        return { ...this.stats };
    }

    reset(): void {
        this.stats = {
            totalProcessed: 0,
            validPaths: 0,
            invalidPaths: 0,
            duplicates: 0,
            fileProtocolPaths: 0,
            systemPaths: 0,
            urlEncodedPaths: 0,
        };
    }
}
