import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { selectBestDate } from "../parsers/date-parser";
import { extractVideoGPS } from "../parsers/gps-parser";
import type { PhotasaLogger } from "@common/logger";
import type { VideoMetadata } from "@common/import-types";

// 提取器返回的元数据接口（不包含dateSource，由主函数处理）
type ExtractedVideoMetadata = Omit<VideoMetadata, "dateSource">;
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

// 配置ffmpeg路径
const ffmpegPath = (ffmpegStatic as string).replace("app.asar", "app.asar.unpacked");
const ffprobePath = ffprobeStatic.path.replace("app.asar", "app.asar.unpacked");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * 视频时间字段优先级（基于录制时间准确性）
 */
const VIDEO_TIME_FIELDS = [
    "com.apple.quicktime.creationdate", // Apple设备最准确
    "creation_time", // 标准元数据字段
    "date", // 回退日期字段
];

/**
 * 提取视频流信息
 */
function extractVideoStreamInfo(metadata: any): {
    width: number;
    height: number;
    codec: string;
} {
    const videoStream = metadata.streams?.find((s: any) => s.codec_type === "video");

    return {
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        codec: videoStream?.codec_name || "unknown",
    };
}

/**
 * 使用Promise包装的ffprobe
 */
function ffprobeAsync(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                resolve(metadata);
            }
        });
    });
}

/**
 * 提取视频文件的元数据（纯函数版本）
 * @param filePath 文件路径
 * @param logger 日志记录器
 * @returns Promise<VideoMetadata>
 */
export async function extractVideoMetadata(
    filePath: string,
    logger: PhotasaLogger,
): Promise<ExtractedVideoMetadata | null> {
    try {
        logger.info(`[Video] Processing file: ${filePath}`);

        const metadata = await ffprobeAsync(filePath);
        const streamInfo = extractVideoStreamInfo(metadata);
        const creationTime = selectBestDate(metadata, VIDEO_TIME_FIELDS);
        const gpsInfo = extractVideoGPS(metadata);

        if (!creationTime) {
            logger.debug(
                `[Video] ${path.basename(filePath)} - No creation time extracted, returning null for fallback handling`,
            );
            return null;
        }

        return {
            duration: metadata.format?.duration || 0,
            creationTime: creationTime,
            resolution: {
                width: streamInfo.width,
                height: streamInfo.height,
            },
            codec: streamInfo.codec,
            gpsInfo: gpsInfo || undefined,
            format: path.extname(filePath).toLowerCase().slice(1),
        };
    } catch (error) {
        logger.error(`[Video] Error extracting metadata from ${filePath}: ${error}`);
        // Return null on failure - let extractMetadata handle fallback
        return null;
    }
}

/**
 * 检查文件是否为视频格式
 */
export function isVideoFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".mp4", ".mov", ".avi", ".mkv", ".wmv", ".m4v", ".flv", ".webm"].includes(ext);
}

/**
 * 检查文件是否为常见的视频格式（用于元数据提取）
 */
export function isSupportedVideoFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".mp4", ".mov", ".avi", ".mkv", ".wmv"].includes(ext);
}

/**
 * 获取视频格式的显示名称
 */
export function getVideoFormatName(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const formatNames: Record<string, string> = {
        mp4: "MP4",
        mov: "QuickTime",
        avi: "AVI",
        mkv: "Matroska",
        wmv: "Windows Media",
        m4v: "iTunes Video",
        flv: "Flash Video",
        webm: "WebM",
    };

    return formatNames[ext] || ext.toUpperCase();
}
