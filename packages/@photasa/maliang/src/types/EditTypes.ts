/**
 * MaLiang 图像编辑类型定义
 * 专门用于图像编辑操作的类型系统
 */

import type { EditOperation } from "./BrushTypes";

// 滤镜参数
export interface FilterParams {
    // 模糊滤镜
    blur?: {
        radius: number; // 0-100
    };

    // 锐化滤镜
    sharpen?: {
        amount: number; // 0-100
    };

    // 怀旧滤镜
    vintage?: {
        intensity: number; // 0-100
    };

    // 灰度滤镜
    grayscale?: {
        method: "average" | "luminance" | "desaturation";
    };

    // 乌褐色滤镜
    sepia?: {
        intensity: number; // 0-100
    };

    // 去隔行滤镜（主要用于视频处理）
    deinterlace?: {
        method: "yadif" | "bwdif" | "w3fdif"; // FFmpeg去隔行算法
        mode?: "send_frame" | "send_field"; // 输出模式
        parity?: "tff" | "bff" | "auto"; // 场序
    };
}

// 调整参数
export interface AdjustParams {
    // 亮度调整
    brightness?: {
        value: number; // -100 to 100
    };

    // 对比度调整
    contrast?: {
        value: number; // -100 to 100
    };

    // 饱和度调整
    saturation?: {
        value: number; // -100 to 100
    };

    // 色相调整
    hue?: {
        degrees: number; // -180 to 180
    };

    // 伽马调整
    gamma?: {
        value: number; // 0.1 to 3.0
    };

    // 高光/阴影
    highlightsShadows?: {
        highlights: number; // -100 to 100
        shadows: number; // -100 to 100
    };

    // 色彩平衡
    colorBalance?: {
        shadows: { cyan: number; magenta: number; yellow: number };
        midtones: { cyan: number; magenta: number; yellow: number };
        highlights: { cyan: number; magenta: number; yellow: number };
    };
}

// 特效参数
export interface EffectParams {
    // 晕影效果
    vignette?: {
        intensity: number; // 0-100
        radius: number; // 0-100
        softness: number; // 0-100
    };

    // 噪点效果
    noise?: {
        amount: number; // 0-100
        type: "gaussian" | "uniform" | "salt_pepper";
    };

    // 浮雕效果
    emboss?: {
        depth: number; // 0-100
        direction: number; // 0-360 degrees
    };

    // 边缘检测
    edge_detection?: {
        threshold: number; // 0-255
        method: "sobel" | "canny" | "laplacian";
    };

    // 渐变叠加
    gradient?: {
        type: "linear" | "radial" | "angular";
        colors: string[]; // hex colors
        opacity: number; // 0-100
        angle?: number; // for linear gradient
        centerX?: number; // for radial gradient
        centerY?: number; // for radial gradient
    };
}

// 几何变换参数
export interface GeometryParams {
    // 裁剪
    crop?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };

    // 调整大小
    resize?: {
        width: number;
        height: number;
        method: "nearest" | "bilinear" | "bicubic" | "lanczos";
        maintainAspectRatio: boolean;
    };

    // 旋转
    rotate?: {
        angle: number; // degrees
        backgroundColor?: string;
    };

    // 翻转
    flip?: {
        horizontal: boolean;
        vertical: boolean;
    };

    // 透视变换
    perspective?: {
        topLeft: { x: number; y: number };
        topRight: { x: number; y: number };
        bottomLeft: { x: number; y: number };
        bottomRight: { x: number; y: number };
    };
}

// 组合编辑操作
export interface CompositeEditOperation {
    id: string;
    name: string;
    operations: EditOperation[];
    previewEnabled: boolean;
}

// 编辑历史记录
export interface EditHistory {
    id: string;
    timestamp: Date;
    operation: EditOperation;
    beforeImagePath?: string;
    afterImagePath?: string;
    reversible: boolean;
}

// 预设滤镜
export interface FilterPreset {
    id: string;
    name: string;
    description: string;
    thumbnail?: string;
    operations: EditOperation[];
    category: "basic" | "artistic" | "vintage" | "black_white" | "color_pop" | "custom";
}

// 编辑会话
export interface EditSession {
    id: string;
    originalImagePath: string;
    currentImagePath: string;
    history: EditHistory[];
    undoStack: EditHistory[];
    redoStack: EditHistory[];
    presets: FilterPreset[];
    createdAt: Date;
    modifiedAt: Date;
}
