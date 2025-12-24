/**
 * ⚠️ 重要警告：此模块仅应在主进程中使用
 *
 * 在 Worker 进程中使用会导致以下错误：
 * - Error: Cannot find module 'electron'
 * - Worker 进程无法访问 electron 模块
 *
 * 正确的使用方式：
 * 1. 主进程：使用此模块查找和配置 FFmpeg 路径
 * 2. Worker 进程：接收主进程传递的路径，直接使用
 *
 * @fileoverview FFmpeg 和 FFprobe 二进制文件路径配置模块
 * @author Photasa Team
 * @version 1.0.0
 */

import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs-extra";
import { getLogger } from "@common/logger";

const logger = getLogger("ffmpeg-config");

/**
 * FFmpeg 路径配置接口
 */
export interface FFmpegConfig {
    ffmpegPath: string;
    ffprobePath: string;
}

/**
 * 获取 FFmpeg 路径（支持开发环境和生产环境）
 */
function getFfmpegPath(): string {
    const originalPath = ffmpegStatic as string;

    // 开发环境：直接使用原始路径
    if (originalPath.includes("node_modules") && !originalPath.includes("app.asar")) {
        logger.debug(`Using development FFmpeg path: ${originalPath}`);
        return originalPath;
    }

    // 生产环境：替换为解包路径
    if (originalPath.includes("app.asar")) {
        const unpackedPath = originalPath.replace("app.asar", "app.asar.unpacked");
        logger.debug(`Using production FFmpeg path: ${unpackedPath}`);
        return unpackedPath;
    }

    logger.debug(`Using fallback FFmpeg path: ${originalPath}`);
    return originalPath;
}

/**
 * 获取 FFprobe 路径（支持开发环境和生产环境）
 */
function getFfprobePath(): string {
    const originalPath = ffprobeStatic.path;

    // 开发环境：直接使用原始路径
    if (originalPath.includes("node_modules") && !originalPath.includes("app.asar")) {
        logger.debug(`Using development FFprobe path: ${originalPath}`);
        return originalPath;
    }

    // 生产环境：替换为解包路径
    if (originalPath.includes("app.asar")) {
        const unpackedPath = originalPath.replace("app.asar", "app.asar.unpacked");
        logger.debug(`Using production FFprobe path: ${unpackedPath}`);
        return unpackedPath;
    }

    logger.debug(`Using fallback FFprobe path: ${originalPath}`);
    return originalPath;
}

/**
 * 验证 FFmpeg 和 FFprobe 文件是否存在
 */
function validatePaths(config: FFmpegConfig): boolean {
    let isValid = true;

    if (!fs.existsSync(config.ffmpegPath)) {
        logger.error(`FFmpeg not found at: ${config.ffmpegPath}`);
        logger.error(`Original path: ${ffmpegStatic}`);
        isValid = false;
    } else {
        logger.debug(`FFmpeg found at: ${config.ffmpegPath}`);
    }

    if (!fs.existsSync(config.ffprobePath)) {
        logger.error(`FFprobe not found at: ${config.ffprobePath}`);
        logger.error(`Original path: ${ffprobeStatic.path}`);
        isValid = false;
    } else {
        logger.debug(`FFprobe found at: ${config.ffprobePath}`);
    }

    return isValid;
}

// 懒加载状态管理
let ffmpegConfigured = false;
let ffmpegConfig: FFmpegConfig | null = null;

/**
 * 确保 FFmpeg 已配置（懒加载）
 */
function ensureFFmpegConfigured(): FFmpegConfig {
    if (!ffmpegConfigured || !ffmpegConfig) {
        ffmpegConfig = configureFFmpegInternal();
        ffmpegConfigured = true;
    }
    return ffmpegConfig;
}

/**
 * 配置 FFmpeg 和 FFprobe 路径（内部实现）
 */
function configureFFmpegInternal(): FFmpegConfig {
    const ffmpegPath = getFfmpegPath();
    const ffprobePath = getFfprobePath();

    const config: FFmpegConfig = {
        ffmpegPath,
        ffprobePath,
    };

    // 验证路径
    const isValid = validatePaths(config);

    if (!isValid) {
        logger.warn("Some FFmpeg binaries are missing, but continuing with available ones");
    }

    // 配置 fluent-ffmpeg
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);

    logger.info(`FFmpeg configured - FFmpeg: ${ffmpegPath}, FFprobe: ${ffprobePath}`);

    return config;
}

/**
 * 配置 FFmpeg 和 FFprobe 路径（公开接口，懒加载）
 */
export function configureFFmpeg(): FFmpegConfig {
    return ensureFFmpegConfigured();
}

/**
 * 获取当前 FFmpeg 配置（懒加载）
 */
export function getFFmpegConfig(): FFmpegConfig {
    return ensureFFmpegConfigured();
}

/**
 * 检查 FFmpeg 是否可用（懒加载）
 */
export function isFFmpegAvailable(): boolean {
    const config = ensureFFmpegConfigured();
    return fs.existsSync(config.ffmpegPath) && fs.existsSync(config.ffprobePath);
}

/**
 * 获取 FFmpeg 版本信息
 */
export async function getFFmpegVersion(): Promise<string | null> {
    if (!isFFmpegAvailable()) {
        return null;
    }

    return new Promise((resolve) => {
        ffmpeg.getAvailableFormats((err, formats) => {
            if (err) {
                logger.error("Failed to get FFmpeg version:", err);
                resolve(null);
            } else {
                // 从 formats 对象中提取版本信息
                const version = formats.ffmpeg?.version || "unknown";
                resolve(version);
            }
        });
    });
}
