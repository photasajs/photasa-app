import fs from "fs-extra";
import path from "path";
import ExifReader from "exifreader";
import ffmpeg from "fluent-ffmpeg";
import createHeifModule from "@saschazar/wasm-heif";
import type { PhotasaLogger } from "@common/logger";
import type {
    MetadataRequest,
    FileMetadata,
    ImageMetadata,
    VideoMetadata,
    GPSInfo,
    CameraInfo,
    DateSource,
    FileGroup,
    FileInfo,
} from "@common/import-types";
import { HeicExtensionRE } from "@common/utils";
import { extractDateTimeFromExif } from "@common/exif-util";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

// 配置ffmpeg路径
const ffmpegPath = (ffmpegStatic as string).replace("app.asar", "app.asar.unpacked");
const ffprobePath = ffprobeStatic.path.replace("app.asar", "app.asar.unpacked");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * 独立的HEIC元数据处理器（不复用thumbnail处理逻辑）
 */
class HEICMetadataProcessor {
    private static heifModule: any = null;

    static async initialize(): Promise<void> {
        if (!this.heifModule) {
            try {
                // 使用默认配置初始化HEIF模块
                this.heifModule = await createHeifModule();
            } catch (error) {
                // 如果默认初始化失败，尝试使用WASM文件
                const wasmPath = path.join(__dirname, "../../resources/wasm_heif.wasm");
                if (await fs.pathExists(wasmPath)) {
                    const wasmBinary = await fs.readFile(wasmPath);
                    this.heifModule = await createHeifModule({
                        wasmBinary: wasmBinary as any,
                    } as any);
                } else {
                    throw new Error("HEIF WASM module not found and default initialization failed");
                }
            }
        }
    }

    static async extractMetadata(filePath: string, logger: PhotasaLogger): Promise<ImageMetadata> {
        await this.initialize();

        try {
            const buffer = await fs.readFile(filePath);

            // 获取文件统计信息作为回退
            const stats = await fs.stat(filePath);
            const fileCreatedTime = stats.birthtime;

            // 直接从HEIC文件中提取EXIF数据，不依赖thumbnail处理
            let exifData: any = null;
            let imageInfo: { width: number; height: number } | null = null;
            let extractedDateTime: Date | null = null;

            try {
                // 使用ExifReader直接读取HEIC文件的EXIF数据
                const tags = ExifReader.load(buffer);
                delete tags["MakerNote"]; // 移除大型标签以节省内存
                exifData = tags;

                // 尝试从EXIF中提取日期时间
                extractedDateTime = this.extractDateTime(exifData);

                // 尝试从EXIF中提取图像尺寸
                const exifWidth = exifData.ImageWidth?.value || exifData.PixelXDimension?.value;
                const exifHeight = exifData.ImageLength?.value || exifData.PixelYDimension?.value;

                if (exifWidth && exifHeight) {
                    imageInfo = { width: exifWidth, height: exifHeight };
                    logger.debug(`[HEIC] Got dimensions from EXIF: ${exifWidth}x${exifHeight}`);
                } else if (this.heifModule) {
                    // 如果EXIF中没有尺寸信息且WASM可用，则解码HEIC获取
                    this.heifModule.decode(buffer, buffer.byteLength, false);
                    const { width, height } = this.heifModule.dimensions();
                    imageInfo = { width, height };
                    logger.debug(`[HEIC] Got dimensions from WASM decode: ${width}x${height}`);
                }
            } catch (e) {
                logger.warn(`[HEIC] Failed to extract EXIF from ${filePath}: ${e}`);
                // 即使EXIF提取失败，也尝试获取基本图像信息
                if (this.heifModule) {
                    try {
                        this.heifModule.decode(buffer, buffer.byteLength, false);
                        const { width, height } = this.heifModule.dimensions();
                        imageInfo = { width, height };
                    } catch (decodeError) {
                        logger.error(`[HEIC] Failed to decode ${filePath}: ${decodeError}`);
                    }
                } else {
                    logger.debug(
                        `[HEIC] WASM module not available, cannot extract dimensions from ${filePath}`,
                    );
                }
            }

            // 确定最终使用的日期和日期源
            let finalDateTime: Date | undefined;
            let dateSource: DateSource;

            if (extractedDateTime) {
                finalDateTime = extractedDateTime;
                dateSource = "exif";
                logger.debug(`[HEIC] Using EXIF date for ${filePath}: ${extractedDateTime}`);
            } else {
                finalDateTime = fileCreatedTime;
                dateSource = "file_created";
                logger.debug(
                    `[HEIC] EXIF date not available, using file created time for ${filePath}: ${fileCreatedTime}`,
                );
            }

            return {
                width: imageInfo?.width || 0,
                height: imageInfo?.height || 0,
                dateTime: finalDateTime,
                gpsInfo: this.extractGPSInfo(exifData) || undefined,
                cameraInfo: this.extractCameraInfo(exifData) || undefined,
                format: "HEIC",
                dateSource,
            };
        } catch (error) {
            logger.error(`[HEIC] Error processing ${filePath}: ${error}`);
            // 回退到文件统计信息
            const stats = await fs.stat(filePath);
            return {
                width: 0,
                height: 0,
                dateTime: stats.birthtime,
                gpsInfo: undefined,
                cameraInfo: undefined,
                format: "HEIC",
                dateSource: "file_created",
            };
        }
    }

    private static extractDateTime(exifData: any): Date | null {
        return extractDateTimeFromExif(exifData);
    }

    private static extractGPSInfo(exifData: any): GPSInfo | null {
        if (!exifData || !exifData.GPSLatitude || !exifData.GPSLongitude) return null;

        try {
            return {
                latitude: this.parseGPSCoordinate(
                    exifData.GPSLatitude.description,
                    exifData.GPSLatitudeRef?.description,
                ),
                longitude: this.parseGPSCoordinate(
                    exifData.GPSLongitude.description,
                    exifData.GPSLongitudeRef?.description,
                ),
                altitude: exifData.GPSAltitude?.value || null,
            };
        } catch (error) {
            return null;
        }
    }

    private static parseGPSCoordinate(coordinate: string, ref: string): number {
        // 解析GPS坐标，格式如 "39° 54' 36.00""
        const parts = coordinate.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"/);
        if (!parts) return 0;

        const degrees = parseInt(parts[1]);
        const minutes = parseInt(parts[2]);
        const seconds = parseFloat(parts[3]);

        let decimal = degrees + minutes / 60 + seconds / 3600;

        // 根据参考方向调整符号
        if (ref === "S" || ref === "W") {
            decimal = -decimal;
        }

        return decimal;
    }

    private static extractCameraInfo(exifData: any): CameraInfo | null {
        if (!exifData) return null;

        return {
            make: exifData.Make?.description || null,
            model: exifData.Model?.description || null,
            lens: exifData.LensModel?.description || null,
            iso: exifData.ISO?.value || null,
            focalLength: exifData.FocalLength?.value || null,
            aperture: exifData.FNumber?.value || null,
            shutterSpeed: exifData.ExposureTime?.value || null,
        };
    }
}

/**
 * 视频元数据处理器
 */
export class VideoMetadataProcessor {
    static async extractMetadata(filePath: string, logger: PhotasaLogger): Promise<VideoMetadata> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    logger.error(`[Video] Error extracting metadata from ${filePath}: ${err}`);
                    reject(err);
                    return;
                }

                try {
                    const videoStream = metadata.streams.find((s) => s.codec_type === "video");
                    const creationTime = this.parseCreationTime(metadata);

                    resolve({
                        duration: metadata.format.duration || 0,
                        creationTime: creationTime || undefined,
                        resolution: {
                            width: videoStream?.width || 0,
                            height: videoStream?.height || 0,
                        },
                        codec: videoStream?.codec_name || "unknown",
                        gpsInfo: this.extractGPSFromVideo(metadata) || undefined,
                        format: path.extname(filePath).toLowerCase().slice(1),
                        dateSource: creationTime ? "video_metadata" : "file_created",
                    });
                } catch (error) {
                    logger.error(`[Video] Error parsing metadata for ${filePath}: ${error}`);
                    reject(error);
                }
            });
        });
    }

    private static parseCreationTime(metadata: any): Date | null {
        // Priority order based on accuracy for actual recording time:
        // 1. com.apple.quicktime.creationdate - Most accurate for Apple devices
        // 2. creation_time - Standard metadata field
        // 3. date - Fallback date field
        const timeFields = ["com.apple.quicktime.creationdate", "creation_time", "date"];

        // 检查format级别的tags
        for (const field of timeFields) {
            const time = metadata.format.tags?.[field];
            if (time && VideoMetadataProcessor.isValidVideoDate(time)) {
                try {
                    const date = new Date(time);
                    // 验证 Date 对象是否有效
                    if (isNaN(date.getTime())) {
                        continue; // 跳过无效的日期
                    }
                    return date;
                } catch (e) {
                    continue;
                }
            }
        }

        // 检查stream级别的tags
        for (const stream of metadata.streams) {
            for (const field of timeFields) {
                const time = stream.tags?.[field];
                if (time && VideoMetadataProcessor.isValidVideoDate(time)) {
                    try {
                        const date = new Date(time);
                        // 验证 Date 对象是否有效
                        if (isNaN(date.getTime())) {
                            continue; // 跳过无效的日期
                        }
                        return date;
                    } catch (e) {
                        continue;
                    }
                }
            }
        }

        return null;
    }

    private static isValidVideoDate(dateString: string): boolean {
        // 排除明显无效的日期格式
        if (
            !dateString ||
            dateString === "0000-00-00T00:00:00.000000Z" ||
            dateString.startsWith("1970-01-01T00:00:00") || // Unix epoch 时间通常表示设备时钟未设置
            dateString === "invalid-date"
        ) {
            return false;
        }
        return true;
    }

    private static extractGPSFromVideo(metadata: any): GPSInfo | null {
        // 尝试从视频元数据中提取GPS信息
        const locationFields = ["location", "com.apple.quicktime.location.ISO6709"];

        for (const stream of metadata.streams) {
            for (const field of locationFields) {
                const location = stream.tags?.[field];
                if (location) {
                    return this.parseGPSString(location);
                }
            }
        }

        return null;
    }

    private static parseGPSString(locationString: string): GPSInfo | null {
        try {
            // 解析ISO6709格式的GPS字符串，如 "+37.7749-122.4194/"
            const match = locationString.match(/([+-]\d+\.?\d*)([+-]\d+\.?\d*)/);
            if (match) {
                return {
                    latitude: parseFloat(match[1]),
                    longitude: parseFloat(match[2]),
                };
            }
        } catch (error) {
            // 忽略解析错误
        }
        return null;
    }
}

/**
 * RAW格式元数据处理器
 */
class RAWMetadataProcessor {
    static async extractMetadata(filePath: string, logger: PhotasaLogger): Promise<ImageMetadata> {
        try {
            // 使用ExifReader处理RAW文件
            const buffer = await fs.readFile(filePath);
            const tags = ExifReader.load(buffer);
            delete tags["MakerNote"]; // 移除大型标签

            const dateTime = this.extractDateTime(tags);
            const gpsInfo = this.extractGPSInfo(tags);
            const cameraInfo = this.extractCameraInfo(tags);

            return {
                dateTime: dateTime || undefined,
                gpsInfo: gpsInfo || undefined,
                cameraInfo: cameraInfo || undefined,
                format: path.extname(filePath).slice(1).toUpperCase(),
                dateSource: dateTime ? "exif" : "file_created",
                width: (tags.ImageWidth?.value as number) || 0,
                height: (tags.ImageLength?.value as number) || 0,
            };
        } catch (error) {
            logger.error(`[RAW] Error processing ${filePath}: ${error}`);
            // 回退到基本文件信息
            const stats = await fs.stat(filePath);
            return {
                dateTime: stats.birthtime,
                dateSource: "file_created",
                format: path.extname(filePath).slice(1).toUpperCase(),
                width: 0,
                height: 0,
            };
        }
    }

    private static extractDateTime(tags: any): Date | null {
        return extractDateTimeFromExif(tags);
    }

    private static extractGPSInfo(tags: any): GPSInfo | null {
        if (!tags.GPSLatitude || !tags.GPSLongitude) return null;

        try {
            return {
                latitude: this.parseGPSCoordinate(
                    tags.GPSLatitude.description,
                    tags.GPSLatitudeRef?.description,
                ),
                longitude: this.parseGPSCoordinate(
                    tags.GPSLongitude.description,
                    tags.GPSLongitudeRef?.description,
                ),
                altitude: tags.GPSAltitude?.value || null,
            };
        } catch (error) {
            return null;
        }
    }

    private static parseGPSCoordinate(coordinate: string, ref: string): number {
        // 解析GPS坐标
        const parts = coordinate.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"/);
        if (!parts) return 0;

        const degrees = parseInt(parts[1]);
        const minutes = parseInt(parts[2]);
        const seconds = parseFloat(parts[3]);

        let decimal = degrees + minutes / 60 + seconds / 3600;

        if (ref === "S" || ref === "W") {
            decimal = -decimal;
        }

        return decimal;
    }

    private static extractCameraInfo(tags: any): CameraInfo | null {
        return {
            make: tags.Make?.description || null,
            model: tags.Model?.description || null,
            lens: tags.LensModel?.description || null,
            iso: tags.ISO?.value || null,
            focalLength: tags.FocalLength?.value || null,
            aperture: tags.FNumber?.value || null,
            shutterSpeed: tags.ExposureTime?.value || null,
        };
    }
}

/**
 * 统一的元数据提取入口
 * 按照时间优先级处理：EXIF > 视频元数据 > 文件创建时间
 */
export async function extractMetadata(
    request: MetadataRequest,
    logger: PhotasaLogger,
): Promise<FileMetadata> {
    const { filePath } = request;
    const ext = path.extname(filePath).toLowerCase();

    logger.info(`[extractMetadata] Processing file: ${filePath} with ext as ${ext}`);
    try {
        // 获取基本文件信息
        const stats = await fs.stat(filePath);
        const baseMetadata = {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size,
            modifiedTime: stats.mtime,
            createdTime: stats.birthtime,
        };

        // 根据文件类型提取特定元数据
        if (HeicExtensionRE.test(filePath)) {
            const heicMetadata = await HEICMetadataProcessor.extractMetadata(filePath, logger);
            const result = { ...baseMetadata, ...heicMetadata, type: "image" as const };
            // 确保null转换为undefined以符合FileMetadata接口
            return {
                ...result,
                dateTime: result.dateTime || undefined,
                gpsInfo: result.gpsInfo || undefined,
                cameraInfo: result.cameraInfo || undefined,
            };
        } else if ([".mp4", ".mov", ".avi", ".mkv", ".wmv"].includes(ext)) {
            logger.info(`[extractMetadata] Processing Video File ${filePath}`);
            const videoMetadata = await VideoMetadataProcessor.extractMetadata(filePath, logger);
            const result = { ...baseMetadata, ...videoMetadata, type: "video" as const };
            // 确保null转换为undefined以符合FileMetadata接口
            return {
                ...result,
                dateTime: videoMetadata.creationTime || undefined,
                gpsInfo: result.gpsInfo || undefined,
            };
        } else if ([".cr2", ".nef", ".arw", ".dng", ".raf", ".orf", ".rw2"].includes(ext)) {
            const rawMetadata = await RAWMetadataProcessor.extractMetadata(filePath, logger);
            const result = { ...baseMetadata, ...rawMetadata, type: "image" as const };
            // 确保null转换为undefined以符合FileMetadata接口
            return {
                ...result,
                dateTime: result.dateTime || undefined,
                gpsInfo: result.gpsInfo || undefined,
                cameraInfo: result.cameraInfo || undefined,
            };
        } else if ([".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".gif"].includes(ext)) {
            // 处理常规图片格式
            const buffer = await fs.readFile(filePath);
            const tags = ExifReader.load(buffer);
            delete tags["MakerNote"];
            const dateTime = extractDateTimeFromExif(tags);

            return {
                ...baseMetadata,
                type: "image",
                dateTime: dateTime || undefined,
                dateSource: dateTime ? "exif" : "file_created",
                format: ext.slice(1).toUpperCase(),
            };
        } else {
            // 其他文件类型
            return {
                ...baseMetadata,
                type: "other",
                dateTime: stats.birthtime,
                dateSource: "file_created",
            };
        }
    } catch (error) {
        logger.error(`[Metadata] Error extracting metadata from ${filePath}: ${error}`);
        throw error;
    }
}

/**
 * 文件组检测器
 */
export class FileGroupDetector {
    private readonly RELATED_EXTENSIONS = {
        mp4: [".thm", ".lrv", ".srt"],
        mov: [".thm", ".lrv"],
        avi: [".thm", ".idx"],
        mts: [".modd"],
        m2ts: [".modd"],
        // 可以根据需要添加更多格式
    };

    detectFileGroups(files: FileInfo[]): FileGroup[] {
        const groups: FileGroup[] = [];
        const processed = new Set<string>();

        for (const file of files) {
            if (processed.has(file.path)) continue;

            const group = this.findRelatedFiles(file, files);
            if (group.files.length > 1) {
                groups.push(group);
                group.files.forEach((f) => processed.add(f.path));
            } else {
                groups.push({
                    mainFile: file,
                    files: [file],
                    type: "single",
                    totalSize: file.size,
                });
                processed.add(file.path);
            }
        }

        return groups;
    }

    private findRelatedFiles(mainFile: FileInfo, allFiles: FileInfo[]): FileGroup {
        const baseName = path.parse(mainFile.path).name;
        const baseDir = path.dirname(mainFile.path);
        const mainExt = path.extname(mainFile.path).toLowerCase().slice(1);

        const relatedExtensions = this.RELATED_EXTENSIONS[mainExt] || [];
        const relatedFiles = [mainFile];

        for (const ext of relatedExtensions) {
            const candidatePath = path.join(baseDir, baseName + ext);
            const relatedFile = allFiles.find((f) => f.path === candidatePath);
            if (relatedFile) {
                relatedFiles.push(relatedFile);
            }
        }

        const totalSize = relatedFiles.reduce((sum, file) => sum + file.size, 0);

        return {
            mainFile,
            files: relatedFiles,
            type: relatedFiles.length > 1 ? "group" : "single",
            totalSize,
        };
    }

    isRelatedFile(mainFile: string, candidateFile: string): boolean {
        const mainBaseName = path.parse(mainFile).name;
        const mainExt = path.extname(mainFile).toLowerCase().slice(1);
        const candidateBaseName = path.parse(candidateFile).name;
        const candidateExt = path.extname(candidateFile).toLowerCase();

        // 检查基础文件名是否相同
        if (mainBaseName !== candidateBaseName) return false;

        // 检查扩展名是否在关联列表中
        const relatedExtensions = this.RELATED_EXTENSIONS[mainExt] || [];
        return relatedExtensions.includes(candidateExt);
    }

    getGroupMainFile(group: FileGroup): FileInfo {
        return group.mainFile;
    }

    /**
     * 增强的文件组检测 - 支持更多格式和特殊命名模式
     */
    detectFileGroupsEnhanced(files: FileInfo[], logger?: PhotasaLogger): FileGroup[] {
        // 扩展的关联文件映射
        const ENHANCED_EXTENSIONS = {
            // 视频文件及其关联文件
            mp4: [".thm", ".lrv", ".srt", ".sub", ".ass", ".vtt"], // GoPro, DJI等
            mov: [".thm", ".lrv", ".xml", ".fcpxml"], // 苹果设备, Final Cut Pro
            avi: [".thm", ".idx", ".sub"], // 传统摄像机
            mts: [".modd", ".moff"], // Sony AVCHD
            m2ts: [".modd", ".moff", ".cpi", ".bup"], // Panasonic AVCHD
            mkv: [".srt", ".sub", ".ass", ".vtt"], // Matroska容器
            wmv: [".srt", ".sub"], // Windows Media

            // RAW文件及其关联文件
            cr2: [".xmp", ".pp3", ".jpg", ".jpeg"], // Canon RAW + JPEG
            cr3: [".xmp", ".pp3", ".jpg", ".jpeg"], // Canon RAW (新格式)
            nef: [".xmp", ".pp3", ".jpg", ".jpeg"], // Nikon RAW + JPEG
            arw: [".xmp", ".pp3", ".jpg", ".jpeg"], // Sony RAW + JPEG
            dng: [".xmp", ".pp3"], // Adobe DNG
            raf: [".xmp", ".pp3", ".jpg", ".jpeg"], // Fujifilm RAW + JPEG
            orf: [".xmp", ".pp3", ".jpg", ".jpeg"], // Olympus RAW + JPEG
            rw2: [".xmp", ".pp3", ".jpg", ".jpeg"], // Panasonic RAW + JPEG

            // JPEG文件及其关联文件
            jpg: [".xmp", ".pp3", ".aae"], // JPEG + 编辑信息
            jpeg: [".xmp", ".pp3", ".aae"], // JPEG + 编辑信息

            // HEIC文件及其关联文件
            heic: [".xmp", ".aae", ".jpg", ".jpeg"], // iOS编辑信息 + JPEG版本
            heif: [".xmp", ".aae", ".jpg", ".jpeg"], // HEIF + 编辑信息

            // 其他特殊格式
            tiff: [".xmp", ".pp3"], // TIFF + 编辑信息
            psd: [".xmp"], // Photoshop文件
        };

        const groups: FileGroup[] = [];
        const processed = new Set<string>();

        // 文件优先级定义
        const FILE_PRIORITY = {
            ".mp4": 1,
            ".mov": 1,
            ".avi": 1,
            ".mkv": 1,
            ".wmv": 1,
            ".mts": 1,
            ".m2ts": 1,
            ".cr2": 2,
            ".cr3": 2,
            ".nef": 2,
            ".arw": 2,
            ".dng": 2,
            ".raf": 2,
            ".orf": 2,
            ".rw2": 2,
            ".heic": 3,
            ".heif": 3,
            ".jpg": 4,
            ".jpeg": 4,
            ".png": 4,
            ".tiff": 4,
            ".xmp": 10,
            ".pp3": 10,
            ".aae": 10,
            ".thm": 11,
            ".lrv": 11,
            ".srt": 12,
            ".sub": 12,
        };

        // 按优先级排序
        const sortedFiles = [...files].sort((a, b) => {
            const extA = path.extname(a.path).toLowerCase();
            const extB = path.extname(b.path).toLowerCase();
            const priorityA = FILE_PRIORITY[extA] || 99;
            const priorityB = FILE_PRIORITY[extB] || 99;
            return priorityA - priorityB;
        });

        for (const file of sortedFiles) {
            if (processed.has(file.path)) continue;

            const group = this.findRelatedFilesEnhanced(file, files, ENHANCED_EXTENSIONS);

            if (group.files.length > 1) {
                logger?.debug(
                    `[FileGroup] Enhanced detection - group: ${group.mainFile.name} with ${group.files.length} files`,
                );
                groups.push(group);
                group.files.forEach((f) => processed.add(f.path));
            } else {
                groups.push({
                    mainFile: file,
                    files: [file],
                    type: "single",
                    totalSize: file.size,
                });
                processed.add(file.path);
            }
        }

        return groups;
    }

    private findRelatedFilesEnhanced(
        mainFile: FileInfo,
        allFiles: FileInfo[],
        extensionMap: Record<string, string[]>,
    ): FileGroup {
        const baseName = path.parse(mainFile.path).name;
        const baseDir = path.dirname(mainFile.path);
        const mainExt = path.extname(mainFile.path).toLowerCase().slice(1);

        const relatedExtensions = extensionMap[mainExt] || [];
        const relatedFiles = [mainFile];

        // 查找完全匹配的关联文件
        for (const ext of relatedExtensions) {
            const candidatePath = path.join(baseDir, baseName + ext);
            const relatedFile = allFiles.find((f) => f.path === candidatePath);
            if (relatedFile) {
                relatedFiles.push(relatedFile);
            }
        }

        // 查找特殊命名模式的文件
        this.findSpecialPatternFiles(mainFile, allFiles, relatedFiles);

        const totalSize = relatedFiles.reduce((sum, file) => sum + file.size, 0);

        return {
            mainFile,
            files: relatedFiles,
            type: relatedFiles.length > 1 ? "group" : "single",
            totalSize,
        };
    }

    private findSpecialPatternFiles(
        mainFile: FileInfo,
        allFiles: FileInfo[],
        relatedFiles: FileInfo[],
    ): void {
        const baseName = path.parse(mainFile.path).name;
        const mainExt = path.extname(mainFile.path).toLowerCase().slice(1);

        // GoPro命名模式: GOPR0001.MP4 -> GP010001.LRV, GP020001.MP4等
        if (baseName.startsWith("GOPR") && mainExt === "mp4") {
            const number = baseName.slice(4);
            const patterns = [
                `GP01${number}.LRV`,
                `GP02${number}.MP4`,
                `GP03${number}.MP4`,
                `GOPR${number}.THM`,
            ];

            for (const pattern of patterns) {
                const file = allFiles.find((f) => path.basename(f.path) === pattern);
                if (file && !relatedFiles.includes(file)) {
                    relatedFiles.push(file);
                }
            }
        }

        // DJI命名模式: DJI_0001.MP4 -> DJI_0001.SRT
        if (baseName.startsWith("DJI_") && mainExt === "mp4") {
            const srtName = `${baseName}.SRT`;
            const file = allFiles.find((f) => path.basename(f.path) === srtName);
            if (file && !relatedFiles.includes(file)) {
                relatedFiles.push(file);
            }
        }

        // Sony相机命名模式: DSC00001.ARW -> DSC00001.JPG
        if (baseName.startsWith("DSC") && ["arw", "cr2", "nef"].includes(mainExt)) {
            const jpgName = `${baseName}.JPG`;
            const file = allFiles.find((f) => path.basename(f.path) === jpgName);
            if (file && !relatedFiles.includes(file)) {
                relatedFiles.push(file);
            }
        }

        // Canon相机命名模式: IMG_0001.CR2 -> IMG_0001.JPG
        if (baseName.startsWith("IMG_") && ["cr2", "cr3"].includes(mainExt)) {
            const jpgName = `${baseName}.JPG`;
            const file = allFiles.find((f) => path.basename(f.path) === jpgName);
            if (file && !relatedFiles.includes(file)) {
                relatedFiles.push(file);
            }
        }
    }

    /**
     * 获取文件组的统计信息
     */
    getGroupStatistics(groups: FileGroup[]): {
        totalGroups: number;
        singleFiles: number;
        multiFileGroups: number;
        totalFiles: number;
        averageGroupSize: number;
        largestGroupSize: number;
        groupsByType: Record<string, number>;
    } {
        const singleFiles = groups.filter((g) => g.type === "single").length;
        const multiFileGroups = groups.filter((g) => g.type === "group").length;
        const totalFiles = groups.reduce((sum, g) => sum + g.files.length, 0);
        const largestGroupSize = Math.max(...groups.map((g) => g.files.length));

        // 按主文件类型分组统计
        const groupsByType: Record<string, number> = {};
        for (const group of groups) {
            const ext = path.extname(group.mainFile.path).toLowerCase();
            groupsByType[ext] = (groupsByType[ext] || 0) + 1;
        }

        return {
            totalGroups: groups.length,
            singleFiles,
            multiFileGroups,
            totalFiles,
            averageGroupSize: totalFiles / groups.length,
            largestGroupSize,
            groupsByType,
        };
    }

    /**
     * 验证文件组的完整性
     */
    validateFileGroup(group: FileGroup): {
        isValid: boolean;
        missingFiles: string[];
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const missingFiles: string[] = [];
        const recommendations: string[] = [];

        // 检查主文件是否存在
        if (!fs.existsSync(group.mainFile.path)) {
            issues.push(`Main file not found: ${group.mainFile.path}`);
            missingFiles.push(group.mainFile.path);
        }

        // 检查关联文件是否存在
        for (const file of group.files) {
            if (file !== group.mainFile && !fs.existsSync(file.path)) {
                issues.push(`Related file not found: ${file.path}`);
                missingFiles.push(file.path);
            }
        }

        // 检查文件大小是否合理
        if (group.mainFile.size === 0) {
            issues.push(`Main file has zero size: ${group.mainFile.path}`);
        }

        // 检查是否有常见的缺失关联文件
        const mainExt = path.extname(group.mainFile.path).toLowerCase().slice(1);
        if (["mp4", "mov"].includes(mainExt)) {
            const hasThm = group.files.some((f) => path.extname(f.path).toLowerCase() === ".thm");
            if (!hasThm) {
                recommendations.push(
                    `Consider looking for .THM thumbnail file for ${group.mainFile.name}`,
                );
            }
        }

        if (["cr2", "nef", "arw"].includes(mainExt)) {
            const hasJpg = group.files.some((f) =>
                [".jpg", ".jpeg"].includes(path.extname(f.path).toLowerCase()),
            );
            if (!hasJpg) {
                recommendations.push(
                    `Consider looking for JPEG preview file for ${group.mainFile.name}`,
                );
            }
        }

        return {
            isValid: issues.length === 0,
            missingFiles,
            issues,
            recommendations,
        };
    }

    /**
     * 检查两个文件组是否可能相关
     */
    areGroupsRelated(group1: FileGroup, group2: FileGroup): boolean {
        // 检查是否在同一目录
        const dir1 = path.dirname(group1.mainFile.path);
        const dir2 = path.dirname(group2.mainFile.path);
        if (dir1 !== dir2) return false;

        // 检查文件名模式
        const name1 = path.parse(group1.mainFile.path).name;
        const name2 = path.parse(group2.mainFile.path).name;

        // 检查序列文件（如 IMG_0001, IMG_0002）
        const match1 = name1.match(/^(.+?)(\d+)$/);
        const match2 = name2.match(/^(.+?)(\d+)$/);

        if (match1 && match2) {
            const [, prefix1, num1] = match1;
            const [, prefix2, num2] = match2;

            if (prefix1 === prefix2) {
                const diff = Math.abs(parseInt(num1) - parseInt(num2));
                return diff <= 5; // 序列号相差不超过5
            }
        }

        return false;
    }
}

/**
 * 处理文件组的导入
 */
export async function processFileGroup(
    group: FileGroup,
    logger: PhotasaLogger,
): Promise<FileGroup> {
    logger.debug(`[FileGroup] Processing group with ${group.files.length} files`);

    // 确保所有文件的元数据都已提取
    for (const file of group.files) {
        // 只有当文件没有元数据且没有有效日期信息时才提取元数据
        if (
            !file.metadata &&
            (!file.dateTime || isNaN(file.dateTime.getTime())) &&
            !file.createdTime
        ) {
            try {
                const metadata = await extractMetadata({ filePath: file.path }, logger);
                file.metadata = metadata as ImageMetadata | VideoMetadata;
                file.dateTime = metadata.dateTime || file.createdTime;
                file.dateSource = metadata.dateSource;
            } catch (error) {
                logger.warn(`[FileGroup] Failed to extract metadata for ${file.path}: ${error}`);
                // 使用文件创建时间作为回退
                file.dateTime = file.createdTime;
                file.dateSource = "file_created";
            }
        }
    }

    // 使用主文件的日期作为整个文件组的日期
    // 遵循正确的日期回退顺序：dateTime -> createdTime -> 今天
    let targetDate: Date;
    let dateReason = "";

    // 第一优先级：使用EXIF或其他元数据日期
    if (group.mainFile.dateTime && !isNaN(group.mainFile.dateTime.getTime())) {
        targetDate = group.mainFile.dateTime;
        dateReason = `using metadata date (${group.mainFile.dateSource || "unknown source"})`;
    }
    // 第二优先级：使用文件创建时间
    else if (group.mainFile.createdTime && !isNaN(group.mainFile.createdTime.getTime())) {
        targetDate = group.mainFile.createdTime;
        dateReason = "using file created time";
    }
    // 最后回退：使用今天的日期
    else {
        targetDate = new Date();
        dateReason = "using today's date as last resort";
        logger.warn(`[FileGroup] No valid date found for ${group.mainFile.name}, ${dateReason}`);
    }

    logger.debug(
        `[FileGroup] Selected date for ${group.mainFile.name}: ${targetDate.toISOString()}, ${dateReason}`,
    );

    // 生成目标路径：YYYY/YYYYMMDD 格式
    // 再次验证目标日期的有效性（双重保险）
    if (isNaN(targetDate.getTime())) {
        logger.error(
            `[FileGroup] Target date is still invalid for ${group.mainFile.name}, using current date`,
        );
        targetDate = new Date();
    }

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");
    group.targetPath = `${year}/${year}${month}${day}`;

    return group;
}
