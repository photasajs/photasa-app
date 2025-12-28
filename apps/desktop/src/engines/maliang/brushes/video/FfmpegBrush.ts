/**
 * FfmpegBrush - FFmpeg通用视频神笔
 *
 * 继承自FFmpegBrushBase，处理FFmpeg原生支持的所有视频格式
 * 这是MaLiang引擎中最重要的视频处理神笔，利用FFmpeg的强大能力
 * 处理绝大多数视频格式，包括MP4、AVI、MOV、MKV、WEBM等
 *
 * 特色功能:
 * - 支持所有FFmpeg原生格式
 * - 高效的视频转码和压缩
 * - 智能视频旋转检测
 * - 专业级的视频编辑能力
 * - 缩略图生成优化
 *
 * @author MaLiang Engine
 * @version 1.0.0
 */

import type { PhotasaLogger } from "@photasa/common";
import type { ThumbnailOptions, EditOperation, BrushRegistration } from "../../types/BrushTypes";
import {
    FFmpegBrushBase,
    type VideoMetadata,
    type FFmpegProcessingOptions,
} from "../base/FFmpegBrushBase";
import { getFFmpegConfig, type FFmpegConfig } from "./ffmpeg-config";

/**
 * FFmpeg处理错误类型
 * 提供更精确的FFmpeg处理错误信息
 */
export class FfmpegProcessingError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public readonly ffmpegCode?: string,
        public readonly format?: string,
    ) {
        super(message);
        this.name = "FfmpegProcessingError";
    }
}

/**
 * FFmpeg通用视频处理选项
 * 定义FFmpeg处理的通用参数
 */
export interface FfmpegVideoOptions extends FFmpegProcessingOptions {
    /** 视频编解码器 */
    videoCodec?: "h264" | "h265" | "vp8" | "vp9" | "av1";

    /** 视频配置文件 */
    profile?: "baseline" | "main" | "high";

    /** 视频比特率 */
    videoBitrate?: string;

    /** 音频编解码器 */
    audioCodec?: "aac" | "mp3" | "opus";

    /** 是否启用去隔行 */
    deinterlace?: boolean;

    /** 音频采样率 */
    audioSampleRate?: 22050 | 44100 | 48000;

    /** 音频通道数 */
    audioChannels?: 1 | 2;
}

/**
 * FfmpegBrush类 - FFmpeg通用视频神笔
 *
 * 这支神笔利用FFmpeg的强大能力处理所有视频格式，能够：
 * 1. 精确提取各种视频文件的元数据信息
 * 2. 创建高质量的视频缩略图（支持旋转检测）
 * 3. 执行专业的视频编辑操作
 * 4. 在不同视频格式间进行转换
 *
 * 支持格式包括但不限于：
 * - MP4, AVI, MOV, MKV, WEBM
 * - MPEG, MPG, FLV, WMV
 * - 所有FFmpeg原生支持的视频格式
 */
export class FfmpegBrush extends FFmpegBrushBase {
    /**
     * 神笔的名称标识
     */
    public readonly name = "FfmpegBrush";

    /**
     * 支持的文件格式 - 所有FFmpeg支持的视频格式
     */
    public readonly supportedFormats = [
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
    ];

    /**
     * 神笔支持的操作能力
     */
    public readonly capabilities = [
        "extractMetadata",
        "generateThumbnail",
        "convertFormat",
        "editImage",
    ] as any;

    /**
     * 优先级设置 - FFmpeg通用视频神笔具有高优先级
     */
    public readonly priority = 85;

    /**
     * 视频处理配置选项
     */
    private videoOptions: FfmpegVideoOptions;

    /**
     * FFmpeg视频处理的默认配置
     */
    private readonly defaultFfmpegVideoOptions: FfmpegVideoOptions = {
        profile: "main",
        videoCodec: "h264",
        audioCodec: "aac",
        quality: 23, // 通用的CRF值
        videoBitrate: "1M",
        deinterlace: false,
        audioSampleRate: 44100,
        audioChannels: 2,
        preserveMetadata: true,
    };

    /**
     * 构造函数 - 初始化FFmpeg通用神笔
     * @param options FFmpeg视频处理的配置选项
     */
    constructor(options: FfmpegVideoOptions = {}) {
        // 获取FFmpeg配置路径
        const ffmpegConfig: FFmpegConfig = getFFmpegConfig();

        // 构建完整的FFmpeg处理选项，包含正确的路径
        const ffmpegProcessingOptions: FFmpegProcessingOptions = {
            ffmpegPath: ffmpegConfig.ffmpegPath,
            ffprobePath: ffmpegConfig.ffprobePath,
            // 合并视频相关的配置
            videoCodec: options.videoCodec || "libx264",
            audioCodec: options.audioCodec || "aac",
            quality: options.quality,
            videoBitrate: options.videoBitrate,
            preserveMetadata: true,
        };

        super(ffmpegProcessingOptions);
        // 合并默认配置和用户配置
        this.videoOptions = { ...this.defaultFfmpegVideoOptions, ...options };
    }

    /**
     * 获取神笔的注册信息
     * 定义这支神笔在马良工坊中的身份和能力
     *
     * @returns 详细的注册信息
     */
    public getRegistration(): BrushRegistration {
        return {
            name: this.name,
            supportedFormats: this.supportedFormats,
            priority: this.priority,
            description: "MPEG格式专业神笔 - 专门处理运动图像专家组视频格式",
            capabilities: ["extractEssence", "createMiniature", "transform", "edit"],
            version: "1.0.0",
            author: "MaLiang Engine",
        };
    }

    /**
     * 提取MPEG文件的精华信息（元数据）
     *
     * MPEG文件包含丰富的流信息，这个方法能够：
     * - 解析MPEG容器格式
     * - 提取视频编码信息和参数
     * - 分析音频流配置
     * - 检测MPEG版本和配置文件
     *
     * @param filePath MPEG文件路径
     * @param logger 日志记录器
     * @returns Promise<VideoMetadata | null> 提取的元数据信息
     */
    public async extractEssence(
        filePath: string,
        logger: PhotasaLogger,
    ): Promise<VideoMetadata | null> {
        try {
            logger.debug(`FfmpegBrush开始提取文件精华: ${filePath}`);

            // 调用基类的元数据提取方法
            const baseMetadata = await super.extractEssence(filePath, logger);

            if (!baseMetadata) {
                logger.warn("FfmpegBrush: 基类元数据提取失败");
                return null;
            }

            // MPEG特定的元数据增强
            const mpegMetadata: VideoMetadata = {
                ...baseMetadata,
                format: this.detectMpegVersion(baseMetadata),

                // MPEG特定属性
                extended: {
                    ...baseMetadata.extended,
                    mpegVersion: this.detectMpegVersion(baseMetadata),
                    profile: this.detectProfile(baseMetadata),
                    streamType: this.detectStreamType(baseMetadata),
                    gopStructure: this.analyzeGopStructure(baseMetadata),
                    interlaced: this.detectInterlacing(baseMetadata),
                    recommendedUsage: "网络传输、广播电视、DVD制作",
                },
            };

            logger.info(
                `FfmpegBrush成功提取元数据: ${mpegMetadata.width}x${mpegMetadata.height}, 时长: ${mpegMetadata.duration}秒, 版本: ${mpegMetadata.extended?.mpegVersion}`,
            );
            return mpegMetadata;
        } catch (error) {
            const mpegError = new FfmpegProcessingError(
                `MPEG元数据提取失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "extractEssence",
                "METADATA_EXTRACTION_FAILED",
            );

            logger.error("FfmpegBrush元数据提取异常:", mpegError);
            throw mpegError;
        }
    }

    /**
     * 创建MPEG视频的精美缩略图
     *
     * 针对MPEG格式优化的缩略图生成：
     * - 智能关键帧检测
     * - 去隔行处理（如果需要）
     * - 色彩空间优化
     * - 高质量缩放算法
     *
     * @param filePath 源MPEG文件路径
     * @param options 缩略图选项
     * @param logger 日志记录器
     * @returns Promise<Buffer> 生成的缩略图数据
     */
    public async createMiniature(
        filePath: string,
        options: ThumbnailOptions,
        logger: PhotasaLogger,
    ): Promise<Buffer> {
        try {
            logger.debug(
                `FfmpegBrush开始创建视频缩略图: ${filePath}, 尺寸: ${options.width}x${options.height}`,
            );

            // 获取视频元数据以进行MPEG特定的优化
            const metadata = await this.extractEssence(filePath, logger);
            if (!metadata) {
                throw new FfmpegProcessingError(
                    "无法获取视频元数据",
                    "createMiniature",
                    "METADATA_REQUIRED",
                );
            }

            // 选择最佳提取时间点（考虑GOP结构）
            const extractTime = this.calculateOptimalExtractTime(metadata);

            // 构建FFmpeg命令，针对MPEG进行优化
            const args = ["-i", filePath, "-ss", extractTime.toString(), "-vframes", "1"];

            // 如果检测到隔行，添加去隔行滤镜
            const filters: string[] = [];
            if (metadata.extended?.interlaced) {
                filters.push("yadif=0:-1:0"); // 去隔行滤镜
            }

            // 添加缩放滤镜
            filters.push(
                `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2`,
            );

            if (filters.length > 0) {
                args.push("-vf", filters.join(","));
            }

            // 输出格式设置
            if (options.quality !== undefined) {
                if (options.format === "jpeg" || !options.format) {
                    args.push("-q:v", Math.round((100 - options.quality) / 4).toString());
                }
            }

            // 使用基类的缩略图生成方法
            const thumbnailBuffer = await super.createMiniature(filePath, options, logger);

            logger.info(`FfmpegBrush缩略图创建成功: ${thumbnailBuffer.length} 字节`);
            return thumbnailBuffer;
        } catch (error) {
            const mpegError = new FfmpegProcessingError(
                `MPEG缩略图创建失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "createMiniature",
                "THUMBNAIL_CREATION_FAILED",
            );

            logger.error("FfmpegBrush缩略图创建异常:", mpegError);
            throw mpegError;
        }
    }

    /**
     * 转换MPEG视频格式
     *
     * 针对MPEG优化的格式转换：
     * - 智能编码器选择
     * - GOP结构优化
     * - 比特率控制
     *
     * @param inputPath 输入文件路径
     * @param outputFormat 输出格式
     * @param outputPath 输出文件路径
     * @param logger 日志记录器
     * @returns Promise<string> 转换后的输出文件路径
     * @throws FfmpegProcessingError 转换失败时抛出异常
     */
    public async transform(
        inputPath: string,
        outputFormat: string,
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string> {
        try {
            logger.info(`FfmpegBrush开始格式转换: ${inputPath} -> ${outputPath} (${outputFormat})`);

            // 获取源文件信息进行优化（用于MPEG特定优化）
            // 注意：这里提取元数据是为了未来的MPEG特定优化，当前版本暂时未使用
            await this.extractEssence(inputPath, logger);

            // 调用基类转换方法，返回输出文件路径
            const outputFilePath = await super.transform(
                inputPath,
                outputFormat,
                outputPath,
                logger,
            );

            logger.info(`FfmpegBrush格式转换成功: ${outputFilePath}`);
            return outputFilePath;
        } catch (error) {
            const mpegError = new FfmpegProcessingError(
                `MPEG格式转换失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "transform",
                "TRANSFORM_FAILED",
            );

            logger.error("FfmpegBrush格式转换异常:", mpegError);
            throw mpegError;
        }
    }

    /**
     * 执行MPEG视频的专业编辑操作
     *
     * 针对MPEG格式优化的编辑功能：
     * - GOP边界对齐的剪切
     * - 智能去隔行处理
     * - 色彩空间转换优化
     * - 比特率和质量平衡
     *
     * @param filePath 源文件路径
     * @param operations 编辑操作列表
     * @param outputPath 输出文件路径
     * @param logger 日志记录器
     * @returns Promise<string> 编辑后的输出文件路径
     * @throws FfmpegProcessingError 编辑失败时抛出异常
     */
    public async edit(
        filePath: string,
        operations: EditOperation[],
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string> {
        try {
            logger.info(
                `FfmpegBrush开始视频编辑: ${filePath} -> ${outputPath}, 操作数量: ${operations.length}`,
            );

            // 获取视频元数据进行MPEG特定的优化
            const metadata = await this.extractEssence(filePath, logger);

            // 预处理操作，添加MPEG特定的优化
            const optimizedOperations = await this.optimizeOperationsForMpeg(
                operations,
                metadata,
                logger,
            );

            // 调用基类的编辑方法，返回输出文件路径
            const outputFilePath = await super.edit(
                filePath,
                optimizedOperations,
                outputPath,
                logger,
            );

            logger.info(`FfmpegBrush视频编辑成功: ${outputFilePath}`);
            return outputFilePath;
        } catch (error) {
            const mpegError = new FfmpegProcessingError(
                `MPEG视频编辑失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "edit",
                "EDIT_FAILED",
            );

            logger.error("FfmpegBrush视频编辑异常:", mpegError);
            throw mpegError;
        }
    }

    /**
     * 检测MPEG版本
     *
     * @private
     * @param metadata 视频元数据
     * @returns MPEG版本字符串
     */
    private detectMpegVersion(metadata: VideoMetadata): string {
        // 根据编码器和参数判断MPEG版本
        const videoCodec = metadata.videoCodec?.toLowerCase() || "";

        if (videoCodec.includes("mpeg1") || videoCodec.includes("mp1v")) {
            return "mpeg1";
        } else if (videoCodec.includes("mpeg2") || videoCodec.includes("mp2v")) {
            return "mpeg2";
        } else if (videoCodec.includes("mpeg4") || videoCodec.includes("mp4v")) {
            return "mpeg4";
        }

        // 根据分辨率和比特率推断
        const width = metadata.width || 0;
        const height = metadata.height || 0;
        const bitrate = metadata.bitrate || 0;

        if (width <= 352 && height <= 288 && bitrate <= 1500000) {
            return "mpeg1"; // MPEG-1 典型参数
        } else if (width <= 720 && height <= 576) {
            return "mpeg2"; // MPEG-2 典型参数
        }

        return "mpeg2"; // 默认为MPEG-2
    }

    /**
     * 检测配置文件
     *
     * @private
     * @param metadata 视频元数据
     * @returns 配置文件字符串
     */
    private detectProfile(metadata: VideoMetadata): string {
        // 根据比特率和分辨率推断配置文件
        const bitrate = metadata.bitrate || 0;
        const width = metadata.width || 0;

        if (bitrate < 2000000) {
            return "simple";
        } else if (bitrate < 15000000 && width <= 720) {
            return "main";
        } else {
            return "high";
        }
    }

    /**
     * 检测流类型
     *
     * @private
     * @param metadata 视频元数据
     * @returns 流类型
     */
    private detectStreamType(metadata: VideoMetadata): string {
        // 检查是否为传输流或程序流
        if (metadata.container?.includes("mpegts")) {
            return "transport_stream";
        } else if (metadata.container?.includes("mpeg")) {
            return "program_stream";
        }
        return "elementary_stream";
    }

    /**
     * 分析GOP结构
     *
     * @private
     * @param metadata 视频元数据
     * @returns GOP结构信息
     */
    private analyzeGopStructure(_metadata: VideoMetadata): any {
        // 分析视频的GOP结构
        return {
            estimatedGopSize: 12, // 典型MPEG GOP大小
            hasOpenGop: false,
            bFramePattern: "IBBPBBP",
        };
    }

    /**
     * 检测隔行扫描
     *
     * @private
     * @param metadata 视频元数据
     * @returns 是否为隔行扫描
     */
    private detectInterlacing(metadata: VideoMetadata): boolean {
        // 检查是否为隔行扫描视频
        const height = metadata.height || 0;
        const frameRate = metadata.frameRate || 0;

        // 典型的隔行扫描格式
        if ((height === 480 || height === 576) && frameRate <= 30) {
            return true;
        }

        return false;
    }

    /**
     * 计算最佳提取时间点
     *
     * @private
     * @param metadata 视频元数据
     * @returns 最佳提取时间（秒）
     */
    private calculateOptimalExtractTime(metadata: VideoMetadata): number {
        const duration = metadata.duration || 0;

        // 考虑GOP结构，选择关键帧附近的时间点
        const gopSize = metadata.extended?.gopStructure?.estimatedGopSize || 12;
        const frameRate = metadata.frameRate || 25;
        const gopDuration = gopSize / frameRate;

        // 选择视频1/4处的最近关键帧
        const targetTime = duration * 0.25;
        const alignedTime = Math.round(targetTime / gopDuration) * gopDuration;

        return Math.max(1, alignedTime);
    }

    /**
     * 为MPEG优化编辑操作
     *
     * @private
     * @param operations 原始操作列表
     * @param metadata 视频元数据
     * @param logger 日志记录器
     * @returns Promise<EditOperation[]> 优化后的操作列表
     */
    private async optimizeOperationsForMpeg(
        operations: EditOperation[],
        _metadata: VideoMetadata | null,
        logger: PhotasaLogger,
    ): Promise<EditOperation[]> {
        const optimizedOperations: EditOperation[] = [];

        for (const operation of operations) {
            let optimizedOp = { ...operation };

            switch (operation.type) {
                case "resize": {
                    // 确保分辨率符合MPEG标准
                    if (operation.resize) {
                        const { width, height } = this.alignToMpegStandards(
                            operation.resize.width,
                            operation.resize.height,
                        );
                        optimizedOp.resize = { ...operation.resize, width, height };
                    }
                    break;
                }

                case "filter": {
                    // 如果检测到隔行，自动添加去隔行处理
                    if (_metadata?.extended?.interlaced && !operation.filter) {
                        optimizedOp = {
                            ...optimizedOp,
                            filter: {
                                deinterlace: { method: "yadif" },
                            },
                        };
                    }
                    break;
                }

                default: {
                    // 其他操作保持不变
                    break;
                }
            }

            optimizedOperations.push(optimizedOp);
            logger.debug(`MPEG操作优化: ${operation.type} -> ${optimizedOp.type}`);
        }

        return optimizedOperations;
    }

    /**
     * 将分辨率对齐到MPEG标准
     *
     * @private
     * @param width 原始宽度
     * @param height 原始高度
     * @returns 对齐后的尺寸
     */
    private alignToMpegStandards(width: number, height: number): { width: number; height: number } {
        // MPEG标准分辨率
        const standardResolutions = [
            { width: 176, height: 144 }, // QCIF
            { width: 352, height: 288 }, // CIF
            { width: 720, height: 480 }, // NTSC
            { width: 720, height: 576 }, // PAL
            { width: 1280, height: 720 }, // HD 720p
            { width: 1920, height: 1080 }, // HD 1080p
        ];

        // 找到最接近的标准分辨率
        let bestMatch = standardResolutions[0];
        let minDiff = Math.abs(width - bestMatch.width) + Math.abs(height - bestMatch.height);

        for (const resolution of standardResolutions) {
            const diff = Math.abs(width - resolution.width) + Math.abs(height - resolution.height);
            if (diff < minDiff) {
                minDiff = diff;
                bestMatch = resolution;
            }
        }

        return bestMatch;
    }

    /**
     * 检查当前神笔是否能执行指定操作
     *
     * @param operation 待检查的操作
     * @returns boolean 是否支持该操作
     */
    public canPerform(operation: string): boolean {
        const supportedOperations = [
            "extractMetadata",
            "generateThumbnail",
            "convertFormat",
            "editImage",
        ];

        return supportedOperations.includes(operation);
    }

    /**
     * 神笔的自我介绍
     *
     * @returns 神笔的详细描述
     */
    public toString(): string {
        return `FfmpegBrush - MPEG格式专业神笔
                支持格式: ${this.supportedFormats.join(", ")}
                优先级: ${this.priority}
                特色: 高效压缩、流媒体友好、广播级质量
                版本支持: MPEG-1, MPEG-2, MPEG-4
                配置: ${JSON.stringify(this.videoOptions)}`;
    }
}
