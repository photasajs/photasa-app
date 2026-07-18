/**
 * MaLiang 神笔类型定义
 * 马良神笔的核心类型系统
 */

import type { FilterParams, AdjustParams } from "./EditTypes";

// 神笔操作类型
export type PaintOperation =
    | "extractMetadata"
    | "generateThumbnail"
    | "convertFormat"
    | "editImage";

// 编辑操作类型
export interface EditOperation {
    type: "filter" | "adjust" | "effect" | "crop" | "resize";
    // 过滤器操作参数
    filter?: FilterParams;
    // 调整操作参数
    adjust?: AdjustParams;
    // 调整大小参数
    resize?: {
        width: number;
        height: number;
        method?: string;
    };
    // 通用参数
    params?: Record<string, any>;
}

// 常用编辑操作子类型
export type FilterType = "blur" | "sharpen" | "vintage" | "grayscale" | "sepia";
export type AdjustType = "brightness" | "contrast" | "saturation" | "hue" | "gamma";
export type EffectType = "vignette" | "noise" | "emboss" | "edge_detection";

// 缩略图选项
export interface ThumbnailOptions {
    width: number;
    height: number;
    withoutEnlargement?: boolean;
    quality?: number;
    format?: "png" | "jpeg" | "jpg" | "webp" | "bmp" | "avif" | "tiff";
    fit?: "inside" | "outside" | "cover" | "contain" | "fill";
    outputPath?: string; // 可选的输出路径
    background?: string | { r: number; g: number; b: number; alpha?: number }; // 背景色

    // HEIC特有选项 - 统一处理预览图和缩略图
    previewPath?: string; // 浏览器预览图路径
    generatePreview?: boolean; // 是否同时生成预览图
    previewFormat?: "png" | "jpeg" | "jpg" | "webp"; // 预览图格式
    previewQuality?: number; // 预览图质量
}

// 作画请求
export interface PaintRequest {
    filePath: string;
    operations: PaintOperation[];
    thumbnailOptions?: ThumbnailOptions;
    editOperations?: EditOperation[];
    outputPath?: string;
}

// 性能指标
export interface PerformanceMetrics {
    startTime: number;
    endTime: number;
    duration: number;
    memoryUsage?: number;
    brushName: string;
}

// 作画结果
export interface PaintResult {
    success: boolean;
    outputs: {
        thumbnail?: string | Buffer;
        preview?: string; // 预览图路径
        metadata?: Metadata;
        converted?: string | boolean;
        edited?: string | boolean;
    };
    brushUsed: string;
    performance: PerformanceMetrics;
    error?: Error;
}

// 元数据基础接口
export interface Metadata {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
    created?: Date;
    modified?: Date;
    colorDepth?: number;
    compression?: string;
    hasPalette?: boolean;
    extended?: Record<string, any>;
    [key: string]: any;
}

// 图像元数据别名
export type ImageMetadata = Metadata;

// 神笔注册信息
export interface BrushRegistration {
    name: string;
    supportedFormats: string[];
    priority: number; // 优先级，数字越大优先级越高
    capabilities: string[];
    description?: string;
    version?: string;
    author?: string;
}

// 神笔工厂配置
export interface BrushFactoryConfig {
    enabledBrushes?: string[];
    defaultPriority?: number;
    maxConcurrency?: number;
}

// 缓存配置
export interface CacheConfig {
    enabled: boolean;
    maxSize: number; // MB
    ttl: number; // seconds
    strategy: "lru" | "fifo" | "ttl";
}

// MaLiang引擎配置
export interface MaLiangConfig {
    brushFactory?: BrushFactoryConfig;
    cache?: CacheConfig;
    performance?: {
        enableMonitoring: boolean;
        logSlowOperations: boolean;
        slowOperationThreshold: number; // ms
    };
    debug?: boolean;
}
