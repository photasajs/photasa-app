/**
 * @fileoverview FFmpeg and FFprobe binary path configuration module
 * @author Photasa Team
 * @version 1.0.0
 */

import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs-extra";
import { getLogger } from "@photasa/common";

const logger = getLogger("ffmpeg-config");

/**
 * FFmpeg path configuration interface
 */
export interface FFmpegConfig {
    ffmpegPath: string;
    ffprobePath: string;
}

/**
 * Get FFmpeg path (supporting development and production environments)
 */
export function getFfmpegPath(): string {
    const originalPath = ffmpegStatic as string;

    // Development: use original path
    if (originalPath.includes("node_modules") && !originalPath.includes("app.asar")) {
        logger.debug(`Using development FFmpeg path: ${originalPath}`);
        return originalPath;
    }

    // Production: replace with unpacked path
    if (originalPath.includes("app.asar")) {
        const unpackedPath = originalPath.replace("app.asar", "app.asar.unpacked");
        logger.debug(`Using production FFmpeg path: ${unpackedPath}`);
        return unpackedPath;
    }

    logger.debug(`Using fallback FFmpeg path: ${originalPath}`);
    return originalPath;
}

/**
 * Get FFprobe path (supporting development and production environments)
 */
export function getFfprobePath(): string {
    // ffprobe-static returns an object with .path

    const originalPath = ffprobeStatic.path || (ffprobeStatic as unknown as string);

    // Development: use original path
    if (
        originalPath &&
        originalPath.includes("node_modules") &&
        !originalPath.includes("app.asar")
    ) {
        logger.debug(`Using development FFprobe path: ${originalPath}`);
        return originalPath;
    }

    // Production: replace with unpacked path
    if (originalPath && originalPath.includes("app.asar")) {
        const unpackedPath = originalPath.replace("app.asar", "app.asar.unpacked");
        logger.debug(`Using production FFprobe path: ${unpackedPath}`);
        return unpackedPath;
    }

    logger.debug(`Using fallback FFprobe path: ${originalPath}`);
    return originalPath;
}

/**
 * Verify if FFmpeg and FFprobe binaries exist
 */
/**
 * Configure FFmpeg and FFprobe paths (Public API, Lazy loading)
 * @param silent If true, suppresses log output
 */
export function configureFFmpeg(silent = false): FFmpegConfig {
    if (silent) {
        // Temporarily silence logger or just pass flag if we refactored internal config,
        // but since internal uses global logger, we might just want to be quieter.
        // For now, let's just use the ensureFFmpegConfigured but we can't easily silence the shared logger without side effects.
        // A better approach for CLI is to check paths manually or assume the logger level can be set.
        // Let's modify ensureFFmpegConfigured to take options.
        return ensureFFmpegConfigured(silent);
    }
    return ensureFFmpegConfigured();
}

// Lazy loading state management
let ffmpegConfigured = false;
let ffmpegConfig: FFmpegConfig | null = null;

function ensureFFmpegConfigured(silent = false): FFmpegConfig {
    if (!ffmpegConfigured || !ffmpegConfig) {
        ffmpegConfig = configureFFmpegInternal(silent);
        ffmpegConfigured = true;
    }
    return ffmpegConfig;
}

function configureFFmpegInternal(silent = false): FFmpegConfig {
    const ffmpegPath = getFfmpegPath();
    const ffprobePath = getFfprobePath();

    const config: FFmpegConfig = {
        ffmpegPath,
        ffprobePath,
    };

    const isValid = validatePaths(config, silent);

    if (!isValid && !silent) {
        logger.warn("Some FFmpeg binaries are missing, but continuing with available ones");
    }

    // Configure fluent-ffmpeg
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);

    if (!silent) {
        logger.info(`FFmpeg configured - FFmpeg: ${ffmpegPath}, FFprobe: ${ffprobePath}`);
    }

    return config;
}

function validatePaths(config: FFmpegConfig, silent = false): boolean {
    let isValid = true;

    if (!fs.existsSync(config.ffmpegPath)) {
        if (!silent) {
            logger.error(`FFmpeg not found at: ${config.ffmpegPath}`);

            logger.error(`Original path: ${ffmpegStatic}`);
        }
        isValid = false;
    } else if (!silent) {
        logger.debug(`FFmpeg found at: ${config.ffmpegPath}`);
    }

    if (!fs.existsSync(config.ffprobePath)) {
        if (!silent) {
            logger.error(`FFprobe not found at: ${config.ffprobePath}`);

            logger.error(`Original path: ${ffprobeStatic.path}`);
        }
        isValid = false;
    } else if (!silent) {
        logger.debug(`FFprobe found at: ${config.ffprobePath}`);
    }

    return isValid;
}

/**
 * Get current FFmpeg configuration (Lazy loading)
 */
export function getFFmpegConfig(): FFmpegConfig {
    return ensureFFmpegConfigured();
}

/**
 * Check if FFmpeg is available (Lazy loading)
 */
export function isFFmpegAvailable(): boolean {
    const config = ensureFFmpegConfigured(true); // Silent check
    return fs.existsSync(config.ffmpegPath) && fs.existsSync(config.ffprobePath);
}

/**
 * Get FFmpeg version information by running binary directly
 */
export async function getFFmpegVersion(): Promise<string | null> {
    if (!isFFmpegAvailable()) {
        return null;
    }

    const config = getFFmpegConfig();

    // Run ffmpeg -version
    const { spawn } = await import("child_process");

    return new Promise((resolve) => {
        const process = spawn(config.ffmpegPath, ["-version"]);

        let output = "";
        process.stdout.on("data", (data: any) => {
            output += data.toString();
        });

        process.on("close", (code: number) => {
            if (code === 0) {
                const match = output.match(/ffmpeg version ([^\s]+)/);
                resolve(match ? match[1] : output.split("\n")[0]);
            } else {
                resolve(null);
            }
        });

        process.on("error", (_err: any) => {
            resolve(null);
        });
    });
}

/**
 * Get FFprobe version information by running binary directly
 */
export async function getFFprobeVersion(): Promise<string | null> {
    if (!isFFmpegAvailable()) {
        return null;
    }

    const config = getFFmpegConfig();

    // Run ffprobe -version
    const { spawn } = await import("child_process");

    return new Promise((resolve) => {
        const process = spawn(config.ffprobePath, ["-version"]);

        let output = "";
        process.stdout.on("data", (data: any) => {
            output += data.toString();
        });

        process.on("close", (code: number) => {
            if (code === 0) {
                const match = output.match(/ffprobe version ([^\s]+)/);
                resolve(match ? match[1] : output.split("\n")[0]);
            } else {
                resolve(null);
            }
        });

        process.on("error", (_err: any) => {
            resolve(null);
        });
    });
}
