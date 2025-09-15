import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { selectBestDate } from "../parsers/date-parser";
import { extractVideoGPS } from "../parsers/gps-parser";
import type { PhotasaLogger } from "@common/logger";
import type { VideoMetadata } from "@common/import-types";

// 提取器返回的元数据接口（不包含dateSource，由主函数处理）
type ExtractedVideoMetadata = Omit<VideoMetadata, "dateSource">;
import { configureFFmpeg } from "../../../utils/ffmpeg-config";

// 配置 FFmpeg（使用共享库）
configureFFmpeg();

/**
 * 视频时间字段优先级（基于录制时间准确性）
 */
const VIDEO_TIME_FIELDS = [
    "com.apple.quicktime.creationdate", // Apple设备最准确
    "creation_time", // 标准元数据字段
    "date", // 回退日期字段
];

/**
 * 获取视频旋转角度
 * @param metadata - ffprobe元数据
 * @returns 旋转角度（0, 90, 180, 270）
 */
function getVideoRotation(metadata: any): number {
    const stream = metadata.streams?.find((s: any) => s.codec_type === "video");

    // 方法1: 从stream tags中获取rotate标签（旧版本ffmpeg）
    const rotateTag = stream?.tags?.rotate;
    if (rotateTag) {
        return parseInt(rotateTag, 10) || 0;
    }

    // 方法2: 从side_data中获取rotation（新版本ffmpeg）
    const sideData = stream?.side_data_list;
    if (sideData && Array.isArray(sideData)) {
        const displayMatrix = sideData.find(
            (data: any) => data.side_data_type === "Display Matrix",
        );
        if (displayMatrix && displayMatrix.rotation) {
            // rotation可能是负数，需要转换为0-360度
            let rotation = parseFloat(displayMatrix.rotation);
            rotation = ((rotation % 360) + 360) % 360;
            return rotation;
        }
    }

    // 方法3: 从format tags中获取rotate标签（某些容器格式）
    const formatRotate = metadata.format?.tags?.rotate;
    if (formatRotate) {
        return parseInt(formatRotate, 10) || 0;
    }

    return 0;
}

/**
 * 提取视频流信息
 */
function extractVideoStreamInfo(metadata: any): {
    width: number;
    height: number;
    codec: string;
    rotation: number;
} {
    const videoStream = metadata.streams?.find((s: any) => s.codec_type === "video");
    const rotation = getVideoRotation(metadata);

    let width = videoStream?.width || 0;
    let height = videoStream?.height || 0;

    // 如果视频旋转了90度或270度，需要交换宽高
    // 这样在展示时可以获得正确的显示尺寸
    if (rotation === 90 || rotation === 270) {
        [width, height] = [height, width];
    }

    return {
        width,
        height,
        codec: videoStream?.codec_name || "unknown",
        rotation,
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
            rotation: streamInfo.rotation,
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
    return [".mp4", ".mov", ".avi", ".mkv", ".wmv", ".m4v", ".flv", ".webm", ".3gp"].includes(ext);
}

/**
 * 检查文件是否为常见的视频格式（用于元数据提取）
 */
export function isSupportedVideoFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".mp4", ".mov", ".avi", ".mkv", ".wmv", ".3gp"].includes(ext);
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
