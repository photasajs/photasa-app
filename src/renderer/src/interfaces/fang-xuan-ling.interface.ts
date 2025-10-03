/**
 * 房玄龄宰相服务接口契约
 * 定义统一Store API的标准接口，避免直接依赖具体实现
 */

/**
 * 偏好管理接口
 */
export interface IPreference {
    // 主题管理 - 只读访问
    readonly currentTheme: string;

    // 语言管理 - 只读访问
    readonly currentLanguage: string;

    // 暗色模式 - 只读访问
    readonly isDarkMode: boolean;

    // 缩略图大小 - 只读访问
    readonly thumbnailSize: number;

    // 状态访问（只读）
    readonly state: any;
}

/**
 * 通知管理接口
 */
export interface INotification {
    show(notification: any): void;
    hide(id: string): void;
    clear(): void;
    readonly notifications: any[];
}

/**
 * 照片管理接口
 */
export interface IPhotos {
    readonly currentPhoto: any;
    setCurrentPhoto(photo: any): void;
    readonly photos: any[];
}

/**
 * 房玄龄宰相服务主接口
 * 统一管理所有Store API，提供类型安全的契约
 */
export interface IFangXuanLingService {
    // 各部门管理接口
    readonly preference: IPreference;
    readonly notification: INotification;
    readonly photos: IPhotos;

    // 全局状态管理
    getGlobalState(): {
        preference: any;
        notification: any;
        photos: any;
    };

    // 全局重置
    resetAll(): void;

    // 奏折处理
    /**
     * 处理各部门奏折
     * @param zouzhe 部门奏折
     * @returns 宰相批复
     */
    processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse>;
}

/**
 * 奏折数据结构
 * 奏折：各部门向房玄龄汇报的内政文书
 */
export interface Zouzhe {
    department: string; // 部门名称
    matter: string; // 事务类型
    content?: any; // 奏折内容
    timestamp: number; // 上奏时间
    priority: "urgent" | "normal" | "low"; // 优先级
}

export interface ZouzheResponse {
    approved: boolean; // 是否批准
    matter: string; // 原始事务
    data: any; // 最终业务数据，房玄龄已拆箱处理
    instruction: string; // 宰相明确指示
    timestamp: number; // 批复时间
    officials?: string[]; // 处理官员链
    metadata?: {
        processTime: number; // 总处理耗时
        escalated: boolean; // 是否上报了天界
        blessing?: string; // 来自天界的加持
    };
}

/**
 * 诏令数据结构
 * 诏令：房玄龄向袁天罡发布的指令文书
 */
export interface Zhaoling {
    command: string; // 指令内容
    context?: any; // 上下文信息
    timestamp: number; // 发布时间
    source: string; // 来源部门
    priority: "imperial" | "urgent" | "normal"; // 优先级
    requiresTianshuApproval?: boolean; // 是否需要天界批准
}

export interface ZhaolingResponse {
    acknowledged: boolean; // 袁天罡是否接受诏令
    command: string; // 原始指令
    data: any; // 直接的业务数据，袁天罡已拆箱处理
    blessing: string; // 钦天监加持
    timestamp: number; // 回馈时间
    error?: string; // 错误信息
    metadata?: {
        engineName: string; // 处理引擎
        processTime: number; // 处理耗时
        urgency: string; // 紧急程度
    };
}

/**
 * 奏折事务类型常量
 */
export const ZOUZHE_MATTERS = {
    THEME_CHANGE: "theme_change", // 主题变更
    LANGUAGE_CHANGE: "language_change", // 语言变更
    THUMBNAIL_SIZE_CHANGE: "thumbnail_size_change", // 缩略图大小变更
    NOTIFICATION_SHOW: "notification_show",
    PHOTO_SWITCH: "photo_switch", // 切换照片
    GET_PREFERENCES: "get_preferences", // 获取偏好设置
} as const;

/**
 * 诏令优先级常量
 */
export const ZHAOLING_PRIORITIES = {
    IMPERIAL: "imperial",
    URGENT: "urgent",
    NORMAL: "normal",
} as const;

/**
 * 奏折优先级常量
 */
export const ZOUZHE_PRIORITIES = {
    URGENT: "urgent",
    NORMAL: "normal",
    LOW: "low",
} as const;

/**
 * 官员身份常量
 */
export const GUANYUAN_NAMES = {
    CHU_SUILIANG: "褚遂良", // 文书管理官员 - 唐朝书法家、政治家
    THEME_SETTINGS: "阎立本", // 主题设置官员 - 唐朝著名画家、工艺家
    LANGUAGE_SETTINGS: "玄奘", // 语言设置官员 - 唐朝翻译家
    NOTIFICATION_SETTINGS: "狄仁杰", // 通知设置官员 - 唐朝名臣
    UPDATE_SETTINGS: "张择端", // 更新设置官员 - 宋代画家
    SCAN_SETTINGS: "米芾", // 扫描设置官员 - 宋代书法家
    ADVANCED_SETTINGS: "高士廉", // 高级设置官员 - 唐朝书法家
} as const;

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
    PROCESSING_FAILED: "processing_failed",
    UNKNOWN_ERROR: "unknown_error",
} as const;

/**
 * Vue注入令牌
 * 用于provide/inject的类型安全标识
 */
export const FANG_XUAN_LING_TOKEN = Symbol("房玄龄");
