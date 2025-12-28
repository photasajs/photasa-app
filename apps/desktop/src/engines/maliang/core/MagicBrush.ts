/**
 * MagicBrush - 神笔接口
 * 每支神笔的基本能力定义
 */

import type { PhotasaLogger } from "@photasa/common";
import type {
    PaintOperation,
    ThumbnailOptions,
    Metadata,
    EditOperation,
    BrushRegistration,
} from "../types/BrushTypes";

/**
 * 神笔接口 - 每支神笔的基本能力
 * 所有神笔都必须实现这个接口
 */
export interface MagicBrush {
    // 神笔基本信息
    readonly name: string;
    readonly supportedFormats: string[];
    readonly capabilities: PaintOperation[];
    readonly priority: number;

    // 神笔四大绝技

    /**
     * 提取精华（元数据提取）
     * @param filePath 文件路径
     * @param logger 日志记录器
     * @returns Promise<Metadata | null>
     */
    extractEssence(filePath: string, logger: PhotasaLogger): Promise<Metadata | null>;

    /**
     * 制作微缩版（缩略图生成）
     * @param filePath 文件路径
     * @param options 缩略图选项
     * @param logger 日志记录器
     * @returns Promise<string | Buffer> 缩略图路径或数据
     */
    createMiniature(
        filePath: string,
        options: ThumbnailOptions,
        logger: PhotasaLogger,
    ): Promise<string | Buffer>;

    /**
     * 变形术（格式转换）- 可选能力
     * @param filePath 源文件路径
     * @param targetFormat 目标格式
     * @param outputPath 输出路径
     * @param logger 日志记录器
     * @returns Promise<string> 转换后的输出文件路径
     * @throws Error 转换失败时抛出异常
     */
    transform?(
        filePath: string,
        targetFormat: string,
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string>;

    /**
     * 神笔改画（图像编辑）- 可选能力
     * @param filePath 文件路径
     * @param operations 编辑操作
     * @param outputPath 输出路径
     * @param logger 日志记录器
     * @returns Promise<string> 编辑后的输出文件路径
     * @throws Error 编辑失败时抛出异常
     */
    edit?(
        filePath: string,
        operations: EditOperation[],
        outputPath: string,
        logger: PhotasaLogger,
    ): Promise<string>;

    // 神笔管理方法

    /**
     * 检查文件是否支持
     * @param filePath 文件路径
     * @returns boolean
     */
    supports(filePath: string): boolean;

    /**
     * 检查操作是否支持
     * @param operation 操作类型
     * @returns boolean
     */
    canPerform(operation: PaintOperation): boolean;

    /**
     * 获取神笔注册信息
     * @returns BrushRegistration
     */
    getRegistration(): BrushRegistration;

    /**
     * 初始化神笔
     * @param config 配置参数
     * @param logger 日志记录器
     * @returns Promise<void>
     */
    initialize?(config?: Record<string, any>, logger?: PhotasaLogger): Promise<void>;

    /**
     * 清理神笔资源
     * @param logger 日志记录器
     * @returns Promise<void>
     */
    cleanup?(logger?: PhotasaLogger): Promise<void>;
}

/**
 * 神笔基类 - 提供通用实现
 * 其他神笔可以继承这个基类来减少代码重复
 */
export abstract class BaseMagicBrush implements MagicBrush {
    public abstract readonly name: string;
    public abstract readonly supportedFormats: string[];
    public abstract readonly capabilities: PaintOperation[];
    public readonly priority: number = 50; // 默认优先级

    constructor(priority?: number) {
        if (priority !== undefined) {
            (this as any).priority = priority;
        }
    }

    // 抽象方法 - 子类必须实现
    public abstract extractEssence(
        filePath: string,
        logger: PhotasaLogger,
    ): Promise<Metadata | null>;
    public abstract createMiniature(
        filePath: string,
        options: ThumbnailOptions,
        logger: PhotasaLogger,
    ): Promise<string | Buffer>;

    // 默认实现 - 子类可以覆盖
    public supports(filePath: string): boolean {
        const ext = this.getFileExtension(filePath);
        return this.supportedFormats.includes(ext);
    }

    public canPerform(operation: PaintOperation): boolean {
        return this.capabilities.includes(operation);
    }

    public getRegistration(): BrushRegistration {
        return {
            name: this.name,
            supportedFormats: this.supportedFormats,
            priority: this.priority,
            capabilities: this.capabilities,
        };
    }

    // 工具方法
    protected getFileExtension(filePath: string): string {
        return filePath.toLowerCase().split(".").pop() || "";
    }

    protected validateFilePath(filePath: string): void {
        if (!filePath || typeof filePath !== "string") {
            throw new Error(`Invalid file path: ${filePath}`);
        }
    }

    protected validateOptions(options: any, requiredFields: string[]): void {
        for (const field of requiredFields) {
            if (!(field in options)) {
                throw new Error(`Missing required option: ${field}`);
            }
        }
    }

    // 可选方法的默认实现
    public async transform?(
        _filePath: string,
        _targetFormat: string,
        _outputPath: string,
        _logger: PhotasaLogger,
    ): Promise<string> {
        throw new Error(`${this.name} does not support format transformation`);
    }

    public async edit?(
        _filePath: string,
        _operations: EditOperation[],
        _outputPath: string,
        _logger: PhotasaLogger,
    ): Promise<string> {
        throw new Error(`${this.name} does not support image editing`);
    }

    public async initialize?(config?: Record<string, any>, logger?: PhotasaLogger): Promise<void> {
        // 默认不需要初始化
        logger?.debug(`${this.name} initialized with config:`, config);
    }

    public async cleanup?(logger?: PhotasaLogger): Promise<void> {
        // 默认不需要清理
        logger?.debug(`${this.name} cleaned up`);
    }
}
