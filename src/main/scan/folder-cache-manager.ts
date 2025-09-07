/*
 * folder-cache-manager.ts
 *
 * RFC 0007: Folder Scan Cache Optimization - Milestone 1
 * 实现文件夹级别的智能缓存机制，显著减少应用启动时间
 *
 * 核心功能：
 * - 为每个目录生成 .photasa-folder.json 缓存文件
 * - 基于文件列表+修改时间计算目录哈希
 * - 智能决策：SKIP/INCREMENTAL/FULL 扫描策略
 * - 跨平台文件隐藏支持
 */

import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { PhotasaLogger } from "@common/logger";
import isImage from "is-image";
import isVideo from "is-video";

// RFC 0007 指定的缓存文件结构
export interface FolderCache {
    version: string;
    lastScan: number;
    fileCount: number;
    folderHash: string;
    scanCompleted: boolean;
    scanDuration: number;
    thumbnailsGenerated: number;
    errors: string[];
    incrementalSupported: boolean;
}

// RFC 0007 扫描策略枚举
export enum ScanStrategy {
    SKIP = "skip", // 无变化检测，跳过扫描
    INCREMENTAL = "incremental", // 少量变化，增量处理
    FULL = "full", // 大量变化或首次扫描
}

// 扫描决策结果
export interface ScanDecision {
    strategy: ScanStrategy;
    reason: string;
    changedFiles?: string[];
    newFiles?: string[];
    deletedFiles?: string[];
}

// 目录文件信息（用于哈希计算）
interface DirectoryFileInfo {
    name: string;
    size: number;
    mtime: number;
}

/**
 * 纯函数：计算目录的内容哈希值
 * 基于目录中所有媒体文件的名称、大小和修改时间生成哈希
 * 优化：添加增量哈希计算支持
 *
 * @param folderPath - 目录路径
 * @param excludeFiles - 要排除的文件列表（用于增量计算）
 * @returns Promise<string> - SHA256 哈希值
 */
export async function computeFolderHash(
    folderPath: string,
    excludeFiles: string[] = [],
): Promise<string> {
    const files: DirectoryFileInfo[] = [];

    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isFile()) {
                const filePath = path.join(folderPath, entry.name);

                // 跳过排除的文件（增量计算优化）
                if (excludeFiles.includes(entry.name)) {
                    continue;
                }

                // 只考虑媒体文件（使用项目现有的isImage和isVideo库）
                if (isImage(filePath) || isVideo(filePath)) {
                    const stats = await fs.stat(filePath);
                    files.push({
                        name: entry.name,
                        size: stats.size,
                        mtime: stats.mtimeMs,
                    });
                }
            }
        }

        // 按文件名排序确保哈希一致性
        files.sort((a, b) => a.name.localeCompare(b.name));

        // 生成哈希字符串
        const hashContent = files.map((f) => `${f.name}:${f.size}:${f.mtime}`).join("|");

        return crypto.createHash("sha256").update(hashContent).digest("hex");
    } catch (error) {
        // 目录不可读时返回空哈希
        return "";
    }
}

// 移除重复的isMediaFile函数，直接使用项目现有的isImage和isVideo库

/**
 * 纯函数：获取目录的缓存信息
 *
 * @param folderPath - 目录路径
 * @param logger - 日志记录器
 * @returns Promise<FolderCache | null> - 缓存信息或null（如果不存在）
 */
export async function getCacheInfo(
    folderPath: string,
    logger: PhotasaLogger,
): Promise<FolderCache | null> {
    const cacheFilePath = path.join(folderPath, ".photasa-folder.json");

    try {
        if (await fs.pathExists(cacheFilePath)) {
            const content = await fs.readFile(cacheFilePath, "utf8");
            const cache = JSON.parse(content) as FolderCache;

            // 验证缓存版本
            if (cache.version !== "1.0") {
                logger.warn(`[getCacheInfo] 缓存版本不匹配: ${cacheFilePath}`);
                return null;
            }

            return cache;
        }
        return null;
    } catch (error) {
        logger.error(`[getCacheInfo] 读取缓存文件失败: ${cacheFilePath}`, error);
        return null;
    }
}

/**
 * 纯函数：保存目录的缓存信息
 *
 * @param folderPath - 目录路径
 * @param cache - 缓存信息
 * @param logger - 日志记录器
 * @returns Promise<void>
 */
export async function saveCacheInfo(
    folderPath: string,
    cache: FolderCache,
    logger: PhotasaLogger,
): Promise<void> {
    const cacheFilePath = path.join(folderPath, ".photasa-folder.json");

    try {
        const content = JSON.stringify(cache, null, 2);
        await fs.writeFile(cacheFilePath, content, "utf8");

        // 跨平台文件隐藏
        await hideConfigFile(cacheFilePath, logger);

        logger.debug(`[saveCacheInfo] 缓存文件已保存: ${cacheFilePath}`);
    } catch (error) {
        logger.error(`[saveCacheInfo] 保存缓存文件失败: ${cacheFilePath}`, error);
        throw error;
    }
}

/**
 * 纯函数：比较哈希值并决定扫描策略
 *
 * @param cachedHash - 缓存的哈希值
 * @param currentHash - 当前计算的哈希值
 * @param cache - 缓存信息（可选，用于更详细的决策）
 * @returns ScanDecision - 扫描决策结果
 */
export function compareHashesAndDecide(
    cachedHash: string,
    currentHash: string,
    cache?: FolderCache,
): ScanDecision {
    // 哈希完全匹配，跳过扫描
    if (cachedHash === currentHash && cache?.scanCompleted) {
        return {
            strategy: ScanStrategy.SKIP,
            reason: "目录内容无变化且上次扫描已完成",
        };
    }

    // 第一次扫描或哈希为空，执行完整扫描
    if (!cachedHash || cachedHash === "") {
        return {
            strategy: ScanStrategy.FULL,
            reason: "首次扫描或缓存无效",
        };
    }

    // 哈希不匹配，说明有文件变化
    if (cachedHash !== currentHash) {
        // 简单策略：先实现完整扫描，后续可优化为增量扫描
        return {
            strategy: ScanStrategy.FULL,
            reason: "检测到文件变化，执行完整重新扫描",
        };
    }

    // 扫描未完成，执行完整扫描
    return {
        strategy: ScanStrategy.FULL,
        reason: "上次扫描未完成，需要重新扫描",
    };
}

/**
 * 纯函数：跨平台文件隐藏
 * 在Windows上使用attrib命令，在macOS/Linux上依赖.开头的文件名
 *
 * @param filePath - 文件路径
 * @param logger - 日志记录器
 * @returns Promise<void>
 */
export async function hideConfigFile(filePath: string, logger: PhotasaLogger): Promise<void> {
    if (process.platform === "win32") {
        try {
            const { exec } = await import("child_process");
            const { promisify } = await import("util");
            const execAsync = promisify(exec);

            await execAsync(`attrib +H "${filePath}"`);
            logger.debug(`[hideConfigFile] Windows文件隐藏成功: ${filePath}`);
        } catch (error) {
            logger.warn(`[hideConfigFile] Windows文件隐藏失败: ${filePath}`, error);
            // 非致命错误，继续执行
        }
    } else {
        // macOS/Linux上，.开头的文件自动隐藏
        logger.debug(`[hideConfigFile] Unix系统文件自动隐藏: ${filePath}`);
    }
}

/**
 * 纯函数：验证隐藏文件状态（主要用于Windows）
 *
 * @param filePath - 文件路径
 * @param logger - 日志记录器
 * @returns Promise<boolean> - 是否已隐藏
 */
export async function validateHiddenStatus(
    filePath: string,
    logger: PhotasaLogger,
): Promise<boolean> {
    if (process.platform !== "win32") {
        return true; // Unix系统默认隐藏
    }

    try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        const { stdout } = await execAsync(`attrib "${filePath}"`);
        const isHidden = stdout.includes("H");

        logger.debug(`[validateHiddenStatus] ${filePath} 隐藏状态: ${isHidden}`);
        return isHidden;
    } catch (error) {
        logger.warn(`[validateHiddenStatus] 检查隐藏状态失败: ${filePath}`, error);
        return false;
    }
}

/**
 * 纯函数：创建默认的缓存对象
 *
 * @param folderHash - 目录哈希值
 * @param fileCount - 文件数量
 * @returns FolderCache - 默认缓存对象
 */
export function createDefaultCache(folderHash: string, fileCount: number): FolderCache {
    return {
        version: "1.0",
        lastScan: Date.now(),
        fileCount,
        folderHash,
        scanCompleted: false,
        scanDuration: 0,
        thumbnailsGenerated: 0,
        errors: [],
        incrementalSupported: true,
    };
}
