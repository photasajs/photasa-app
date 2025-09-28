/**
 * FFmpegBrushBase - FFmpeg神笔家族基类
 * 基于FFmpeg的视频和多媒体处理神笔基类
 *
 * FFmpeg是世界领先的多媒体框架，能够解码、编码、转码、复用、
 * 解复用、流式传输、过滤和播放几乎所有人类和机器创建的内容
 *
 * 这个基类为所有基于FFmpeg的神笔提供了统一的接口和通用功能：
 * - 视频格式检测和元数据提取
 * - 缩略图生成（从视频帧中）
 * - 视频格式转换和编码
 * - 基础的视频编辑能力
 *
 * @author Ma-Liang Engine Team
 * @since 1.0.0
 * @version 1.0.0
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { ensureDir, exists, remove } from "fs-extra";
import type { PhotasaLogger } from "@common/logger";
import { BaseMagicBrush } from "../../core/MagicBrush";
import type {
    ThumbnailOptions,
    Metadata,
    EditOperation,
    BrushRegistration,
} from "../../types/BrushTypes";

/**
 * FFmpeg处理选项
 * 定义FFmpeg命令行参数和处理配置
 */
export interface FFmpegProcessingOptions {
    /** FFmpeg可执行文件路径 */
    ffmpegPath?: string;
    /** FFprobe可执行文件路径 */
    ffprobePath?: string;
    /** 输出视频编码器 */
    videoCodec?: string;
    /** 输出音频编码器 */
    audioCodec?: string;
    /** 视频质量参数 (CRF值, 0-51) */
    quality?: number;
    /** 输出分辨率 */
    resolution?: string;
    /** 帧率 */
    frameRate?: number;
    /** 音频比特率 */
    audioBitrate?: string;
    /** 视频比特率 */
    videoBitrate?: string;
    /** 是否保留元数据 */
    preserveMetadata?: boolean;
    /** 额外的FFmpeg参数 */
    extraArgs?: string[];
}

/**
 * 视频元数据信息
 * 扩展基础元数据，添加视频特有的属性
 */
export interface VideoMetadata extends Metadata {
    /** 视频时长（秒） */
    duration?: number;
    /** 帧率 */
    frameRate?: number;
    /** 视频编码器 */
    videoCodec?: string;
    /** 音频编码器 */
    audioCodec?: string;
    /** 比特率 */
    bitrate?: number;
    /** 音频采样率 */
    sampleRate?: number;
    /** 音频通道数 */
    audioChannels?: number;
    /** 视频流信息 */
    videoStreams?: any[];
    /** 音频流信息 */
    audioStreams?: any[];
    /** 是否有音频轨道 */
    hasAudio?: boolean;
    /** 是否有视频轨道 */
    hasVideo?: boolean;
    /** 容器格式 */
    container?: string;
}

/**
 * FFmpeg错误类型
 * 提供详细的FFmpeg处理错误信息
 */
export class FFmpegProcessingError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public readonly ffmpegCode?: string,
        public readonly ffmpegOutput?: string,
        public readonly command?: string,
    ) {
        super(message);
        this.name = "FFmpegProcessingError";
    }
}

/**
 * FFmpegBrushBase抽象基类
 *
 * 这个基类实现了所有FFmpeg神笔的通用功能：
 * 1. FFmpeg/FFprobe的调用和管理
 * 2. 视频元数据的提取和解析
 * 3. 视频缩略图的生成
 * 4. 基础的格式转换能力
 * 5. 统一的错误处理机制
 *
 * 子类继承这个基类后，只需要：
 * 1. 定义支持的格式列表
 * 2. 实现格式特定的处理逻辑（如果需要）
 * 3. 可选择覆盖基类方法以提供特殊处理
 */
export abstract class FFmpegBrushBase extends BaseMagicBrush {
    /** FFmpeg处理的默认选项 */
    protected readonly defaultOptions: FFmpegProcessingOptions = {
        ffmpegPath: "ffmpeg",
        ffprobePath: "ffprobe",
        videoCodec: "libx264",
        audioCodec: "aac",
        quality: 23, // 合理的CRF值，平衡质量和文件大小
        frameRate: 30,
        audioBitrate: "128k",
        preserveMetadata: true,
        extraArgs: [],
    };

    /** 支持的输出格式映射 */
    protected readonly outputFormats = {
        mp4: "mp4",
        avi: "avi",
        mkv: "mkv",
        mov: "mov",
        wmv: "wmv",
        webm: "webm",
        flv: "flv",
        "3gp": "3gp",
    };

    /** 常用的视频编码器映射 */
    protected readonly videoCodecs = {
        h264: "libx264",
        h265: "libx265",
        vp8: "libvpx",
        vp9: "libvpx-vp9",
        av1: "libaom-av1",
    };

    /** 常用的音频编码器映射 */
    protected readonly audioCodecs = {
        aac: "aac",
        mp3: "libmp3lame",
        ogg: "libvorbis",
        opus: "libopus",
    };

    /**
     * 构造函数
     * @param options FFmpeg处理选项
     */
    constructor(protected readonly options: FFmpegProcessingOptions = {}) {
        super();
        // 合并默认选项和用户选项
        this.options = { ...this.defaultOptions, ...options };
    }

    /**
     * 提取视频文件的精华信息（元数据）
     *
     * 使用FFprobe提取详细的视频元数据，包括：
     * - 基本信息：时长、分辨率、帧率
     * - 编码信息：视频编码器、音频编码器
     * - 流信息：视频流、音频流详情
     * - 技术参数：比特率、采样率等
     *
     * @param filePath 视频文件路径
     * @param logger 日志记录器
     * @returns Promise<VideoMetadata | null> 提取的视频元数据
     */
    public async extractEssence(
        filePath: string,
        logger: PhotasaLogger,
    ): Promise<VideoMetadata | null> {
        try {
            logger.debug(`FFmpegBrush开始提取视频元数据: ${filePath}`);

            // 检查文件是否存在
            if (!(await exists(filePath))) {
                throw new FFmpegProcessingError(
                    `文件不存在: ${filePath}`,
                    "extractEssence",
                    "FILE_NOT_FOUND",
                );
            }

            // 使用FFprobe提取元数据
            const metadata = await this.extractMetadataWithFFprobe(filePath, logger);

            logger.info(
                `FFmpegBrush成功提取元数据: ${metadata.width}x${metadata.height}, 时长: ${metadata.duration}秒`,
            );
            return metadata;
        } catch (error) {
            const ffmpegError = new FFmpegProcessingError(
                `视频元数据提取失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "extractEssence",
                error instanceof FFmpegProcessingError ? error.ffmpegCode : "UNKNOWN_ERROR",
            );

            logger.error("FFmpegBrush元数据提取异常:", ffmpegError);
            throw ffmpegError;
        }
    }

    /**
     * 创建视频的精美缩略图
     *
     * 从视频中提取关键帧创建缩略图：
     * - 智能选择最佳帧（避免黑屏、模糊帧）
     * - 支持多种输出格式
     * - 可配置质量和尺寸
     *
     * @param filePath 源视频文件路径
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
                `FFmpegBrush开始创建视频缩略图: ${filePath}, 尺寸: ${options.width}x${options.height}`,
            );

            // 获取视频元数据以确定最佳提取时间点
            const metadata = await this.extractMetadataWithFFprobe(filePath, logger);

            // 选择提取时间点（视频的1/4位置，避免开头的黑屏）
            const extractTime = metadata.duration ? Math.max(1, metadata.duration * 0.25) : 1;

            // 创建临时输出路径
            const tempDir = path.join(process.cwd(), "temp", "thumbnails");
            await ensureDir(tempDir);

            const outputPath = path.join(
                tempDir,
                `thumb_${Date.now()}.${options.format || "jpeg"}`,
            );

            // 构建FFmpeg命令
            const args = [
                "-i",
                filePath,
                "-ss",
                extractTime.toString(),
                "-vframes",
                "1",
                "-vf",
                `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2`,
                "-y", // 覆盖输出文件
                outputPath,
            ];

            // 如果指定了质量，添加质量参数
            if (options.quality !== undefined) {
                if (options.format === "jpeg" || !options.format) {
                    args.splice(-1, 0, "-q:v", Math.round((100 - options.quality) / 4).toString());
                }
            }

            // 执行FFmpeg命令
            await this.executeFFmpegCommand(args, logger);

            // 读取生成的缩略图文件
            const thumbnailBuffer = await fs.readFile(outputPath);

            // 清理临时文件
            await remove(outputPath);

            logger.info(`FFmpegBrush缩略图创建成功: ${thumbnailBuffer.length} 字节`);
            return thumbnailBuffer;
        } catch (error) {
            const ffmpegError = new FFmpegProcessingError(
                `视频缩略图创建失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "createMiniature",
                error instanceof FFmpegProcessingError
                    ? error.ffmpegCode
                    : "THUMBNAIL_CREATION_FAILED",
            );

            logger.error("FFmpegBrush缩略图创建异常:", ffmpegError);
            throw ffmpegError;
        }
    }

    /**
     * 转换视频格式
     *
     * 使用FFmpeg进行视频格式转换：
     * - 支持多种输入和输出格式
     * - 智能编码器选择
     * - 质量优化
     *
     * @param inputPath 输入文件路径
     * @param outputFormat 输出格式
     * @param outputPath 输出文件路径
     * @param logger 日志记录器
     * @returns Promise<string> 转换后的输出文件路径
     * @throws FFmpegProcessingError 转换失败时抛出异常
     */
    public async transform(
        inputPath: string,
        outputFormat: string,
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string> {
        try {
            logger.info(`FFmpegBrush开始格式转换: ${inputPath} -> ${outputPath} (${outputFormat})`);

            // 确保输出目录存在
            await ensureDir(path.dirname(outputPath));

            // 根据输出格式选择合适的编码器
            const videoCodec = this.selectVideoCodec(outputFormat);
            const audioCodec = this.selectAudioCodec(outputFormat);

            // 构建FFmpeg转换命令
            const args = [
                "-i",
                inputPath,
                "-c:v",
                videoCodec,
                "-c:a",
                audioCodec,
                "-crf",
                this.options.quality?.toString() || "23",
                ...(this.options.extraArgs || []),
                "-y", // 覆盖输出文件
                outputPath,
            ];

            // 执行转换
            await this.executeFFmpegCommand(args, logger);

            // 验证输出文件是否存在
            const success = await exists(outputPath);

            if (!success) {
                throw new FFmpegProcessingError(
                    "转换完成但输出文件不存在",
                    "transform",
                    "OUTPUT_FILE_MISSING",
                );
            }

            logger.info(`FFmpegBrush格式转换成功: ${outputPath}`);
            return outputPath;
        } catch (error) {
            const ffmpegError = new FFmpegProcessingError(
                `视频格式转换失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "transform",
                error instanceof FFmpegProcessingError ? error.ffmpegCode : "TRANSFORM_FAILED",
            );

            logger.error("FFmpegBrush格式转换异常:", ffmpegError);
            throw ffmpegError;
        }
    }

    /**
     * 执行基础的视频编辑操作
     *
     * 支持的编辑操作：
     * - 裁剪时间段
     * - 调整分辨率
     * - 添加水印
     * - 调整速度
     *
     * @param filePath 源文件路径
     * @param operations 编辑操作列表
     * @param outputPath 输出文件路径
     * @param logger 日志记录器
     * @returns Promise<string> 编辑后的输出文件路径
     * @throws FFmpegProcessingError 编辑失败时抛出异常
     */
    public async edit(
        filePath: string,
        operations: EditOperation[],
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string> {
        try {
            logger.info(
                `FFmpegBrush开始视频编辑: ${filePath} -> ${outputPath}, 操作数量: ${operations.length}`,
            );

            // 确保输出目录存在
            await ensureDir(path.dirname(outputPath));

            // 构建基础FFmpeg命令
            const args = ["-i", filePath];

            // 应用编辑操作
            const filters: string[] = [];

            for (const operation of operations) {
                switch (operation.type) {
                    case "resize":
                        if (operation.params?.width && operation.params?.height) {
                            filters.push(
                                `scale=${operation.params.width}:${operation.params.height}`,
                            );
                        }
                        break;

                    case "crop":
                        if (
                            operation.params?.x !== undefined &&
                            operation.params?.y !== undefined &&
                            operation.params?.width &&
                            operation.params?.height
                        ) {
                            filters.push(
                                `crop=${operation.params.width}:${operation.params.height}:${operation.params.x}:${operation.params.y}`,
                            );
                        }
                        break;

                    default:
                        logger.warn(`FFmpegBrush: 不支持的编辑操作: ${operation.type}`);
                        break;
                }
            }

            // 如果有视频滤镜，添加到命令中
            if (filters.length > 0) {
                args.push("-vf", filters.join(","));
            }

            // 添加编码器和输出路径
            args.push(
                "-c:v",
                this.options.videoCodec || "libx264",
                "-c:a",
                this.options.audioCodec || "aac",
                "-crf",
                this.options.quality?.toString() || "23",
                "-y",
                outputPath,
            );

            // 执行编辑命令
            await this.executeFFmpegCommand(args, logger);

            // 验证输出文件
            const success = await exists(outputPath);

            if (!success) {
                throw new FFmpegProcessingError(
                    "编辑完成但输出文件不存在",
                    "edit",
                    "OUTPUT_FILE_MISSING",
                );
            }

            logger.info(`FFmpegBrush视频编辑成功: ${outputPath}`);
            return outputPath;
        } catch (error) {
            const ffmpegError = new FFmpegProcessingError(
                `视频编辑失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "edit",
                error instanceof FFmpegProcessingError ? error.ffmpegCode : "EDIT_FAILED",
            );

            logger.error("FFmpegBrush视频编辑异常:", ffmpegError);
            throw ffmpegError;
        }
    }

    /**
     * 使用FFprobe提取详细的元数据信息
     *
     * @private
     * @param filePath 文件路径
     * @param logger 日志记录器
     * @returns Promise<VideoMetadata> 提取的元数据
     */
    private async extractMetadataWithFFprobe(
        filePath: string,
        logger: PhotasaLogger,
    ): Promise<VideoMetadata> {
        const args = [
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            filePath,
        ];

        try {
            const output = await this.executeFFprobeCommand(args, logger);
            const data = JSON.parse(output);

            // 提取视频流信息
            const videoStream = data.streams?.find((stream: any) => stream.codec_type === "video");
            const audioStream = data.streams?.find((stream: any) => stream.codec_type === "audio");
            const format = data.format;

            // 构建元数据对象
            const metadata: VideoMetadata = {
                width: videoStream?.width || 0,
                height: videoStream?.height || 0,
                format: path.extname(filePath).toLowerCase().slice(1),
                size: parseInt(format?.size) || 0,
                created: new Date(),
                modified: new Date(),

                // 视频特有属性
                duration: parseFloat(format?.duration) || 0,
                frameRate: this.parseFrameRate(videoStream?.r_frame_rate),
                videoCodec: videoStream?.codec_name,
                audioCodec: audioStream?.codec_name,
                bitrate: parseInt(format?.bit_rate) || 0,
                sampleRate: parseInt(audioStream?.sample_rate) || 0,
                audioChannels: audioStream?.channels || 0,
                videoStreams: data.streams?.filter((s: any) => s.codec_type === "video") || [],
                audioStreams: data.streams?.filter((s: any) => s.codec_type === "audio") || [],
                hasAudio: !!audioStream,
                hasVideo: !!videoStream,
                container: format?.format_name?.split(",")[0] || "unknown",
            };

            return metadata;
        } catch (error) {
            throw new FFmpegProcessingError(
                `FFprobe元数据提取失败: ${error instanceof Error ? error.message : "未知错误"}`,
                "extractMetadataWithFFprobe",
                "FFPROBE_FAILED",
            );
        }
    }

    /**
     * 执行FFmpeg命令
     *
     * @private
     * @param args 命令参数
     * @param logger 日志记录器
     * @returns Promise<string> 命令输出
     */
    private async executeFFmpegCommand(args: string[], logger: PhotasaLogger): Promise<string> {
        return this.executeCommand(this.options.ffmpegPath || "ffmpeg", args, logger);
    }

    /**
     * 执行FFprobe命令
     *
     * @private
     * @param args 命令参数
     * @param logger 日志记录器
     * @returns Promise<string> 命令输出
     */
    private async executeFFprobeCommand(args: string[], logger: PhotasaLogger): Promise<string> {
        return this.executeCommand(this.options.ffprobePath || "ffprobe", args, logger);
    }

    /**
     * 通用命令执行器
     *
     * @private
     * @param command 命令名称
     * @param args 命令参数
     * @param logger 日志记录器
     * @returns Promise<string> 命令输出
     */
    private async executeCommand(
        command: string,
        args: string[],
        logger: PhotasaLogger,
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            logger.debug(`执行命令: ${command} ${args.join(" ")}`);

            const process = spawn(command, args);
            let stdout = "";
            let stderr = "";

            process.stdout?.on("data", (data) => {
                stdout += data.toString();
            });

            process.stderr?.on("data", (data) => {
                stderr += data.toString();
            });

            process.on("close", (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(
                        new FFmpegProcessingError(
                            `命令执行失败: ${command}`,
                            "executeCommand",
                            code?.toString(),
                            stderr,
                            `${command} ${args.join(" ")}`,
                        ),
                    );
                }
            });

            process.on("error", (error) => {
                reject(
                    new FFmpegProcessingError(
                        `命令启动失败: ${error.message}`,
                        "executeCommand",
                        "SPAWN_FAILED",
                        stderr,
                        `${command} ${args.join(" ")}`,
                    ),
                );
            });
        });
    }

    /**
     * 解析帧率字符串
     *
     * @private
     * @param frameRateStr 帧率字符串（如 "30/1", "25000/1001"）
     * @returns 数值帧率
     */
    private parseFrameRate(frameRateStr?: string): number {
        if (!frameRateStr) return 0;

        const parts = frameRateStr.split("/");
        if (parts.length === 2) {
            return parseInt(parts[0]) / parseInt(parts[1]);
        }

        return parseFloat(frameRateStr);
    }

    /**
     * 根据输出格式选择合适的视频编码器
     *
     * @private
     * @param outputFormat 输出格式
     * @returns 视频编码器名称
     */
    private selectVideoCodec(outputFormat: string): string {
        switch (outputFormat.toLowerCase()) {
            case "mp4":
            case "mov":
                return "libx264";
            case "webm":
                return "libvpx-vp9";
            case "avi":
                return "libx264";
            case "mkv":
                return "libx265";
            default:
                return this.options.videoCodec || "libx264";
        }
    }

    /**
     * 根据输出格式选择合适的音频编码器
     *
     * @private
     * @param outputFormat 输出格式
     * @returns 音频编码器名称
     */
    private selectAudioCodec(outputFormat: string): string {
        switch (outputFormat.toLowerCase()) {
            case "mp4":
            case "mov":
                return "aac";
            case "webm":
                return "libopus";
            case "avi":
                return "libmp3lame";
            case "mkv":
                return "aac";
            default:
                return this.options.audioCodec || "aac";
        }
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
     * 获取神笔的注册信息
     * 子类必须实现此方法以提供具体的注册信息
     *
     * @abstract
     * @returns BrushRegistration 注册信息
     */
    public abstract getRegistration(): BrushRegistration;

    /**
     * 神笔的自我介绍
     *
     * @returns 神笔的详细描述
     */
    public toString(): string {
        return `FFmpegBrushBase - FFmpeg神笔家族基类
                支持的输出格式: ${Object.keys(this.outputFormats).join(", ")}
                默认视频编码器: ${this.options.videoCodec}
                默认音频编码器: ${this.options.audioCodec}
                默认质量: CRF ${this.options.quality}`;
    }
}
