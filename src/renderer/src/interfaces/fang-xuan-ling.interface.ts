/**
 * 房玄龄宰相服务接口契约
 * 定义统一Store API的标准接口，避免直接依赖具体实现
 */

import type { FolderNode } from "@common/folder-types";
import type { ScanQueueItem } from "@renderer/stores/scanning-types";

export interface IBaseStore {
    reset(): void;
}

/**
 * 偏好管理接口
 */
export interface IPreference extends IBaseStore {
    // 主题管理 - 只读访问
    readonly currentTheme: string;

    // 语言管理 - 只读访问
    readonly currentLanguage: string;

    // 缩略图大小 - 只读访问
    readonly thumbnailSize: number;

    // 路径管理 - 只读访问
    // TODO: should clean up
    readonly paths: string[];
}

/**
 * 通知管理接口
 */
export interface INotification extends IBaseStore {
    show(notification: Record<string, unknown>): void;
    hide(id: string): void;
    clear(): void;
    readonly notifications: Record<string, unknown>[];
}

/**
 * 照片管理接口
 */
export interface IPhotos extends IBaseStore {
    readonly currentPhoto: Record<string, unknown> | null;
    setCurrentPhoto(photo: Record<string, unknown>): void;
    readonly photos: Record<string, unknown>[];
    /** ✅ RFC 0057: 当前正在扫描的文件路径（只读） */
    readonly processingFile: string;
    /** ✅ RFC 0057: 当前扫描进度（只读） */
    readonly scanProgress: number;
    /** ✅ RFC 0057: 更新扫描进度 */
    updateScanProgress(filePath: string, progress: number): void;
    /** ✅ RFC 0057: 清空扫描进度 */
    clearScanProgress(): void;
}

/**
 * 扫描队列访问器接口（RFC 0048 v3）
 *
 * ⚠️ 重要设计原则：只读访问模式
 * - 房玄龄只提供典籍查阅（只读访问）
 * - 所有修改操作需通过奏折系统（Zouzhe）
 * - 由其他官员（如尉迟恭）呈递奏折，经批准后执行
 */
export interface IScanning extends IBaseStore {
    /** 查阅扫描队列（只读副本，v3: 包含状态机） */
    readonly queue: ScanQueueItem[];
    /** 查询队列大小（只读） */
    readonly queueSize: number;
    /** 查询当前处理状态（只读） */
    readonly isProcessing: boolean;
    /** 查询当前处理路径（只读） */
    readonly currentPath: string | null;
    /** 检查路径是否在队列中（只读查询） */
    isInQueue(path: string): boolean;
    /** 查询下一个待处理任务（只读，v3: ScanQueueItem） */
    readonly nextScanAction: ScanQueueItem | null;
}

export interface IAppState extends IBaseStore {
    readonly folderTree: FolderNode[];
    readonly currentFolder: string;
    readonly lastOpenedFolder: string;
}

/**
 * ✅ RFC 0057: 状态栏管理接口
 */
export interface IStatusBar extends IBaseStore {
    /** 当前任务（只读） */
    readonly currentTask: string;
    /** 状态（只读） */
    readonly status: string;
    /** 进度（只读） */
    readonly progress: number | undefined;
    /** 错误信息（只读） */
    readonly error: string | undefined;
    /** 更新时间戳（只读） */
    readonly timestamp: number;
    /** 更新状态栏 */
    update(payload: {
        type: string;
        task: string;
        status: string;
        error?: string;
        timestamp: number;
        data?: unknown;
    }): void;
    /** 清空状态栏 */
    clear(): void;
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
    readonly scanning: IScanning;
    readonly appState: IAppState;
    /** ✅ RFC 0057: 状态栏管理接口 */
    readonly statusBar: IStatusBar;

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
    content?: Record<string, unknown>; // 奏折内容
    timestamp: number; // 上奏时间
    priority: "urgent" | "normal" | "low"; // 优先级
}

export interface ZouzheResponse {
    approved: boolean; // 是否批准
    matter: string; // 原始事务
    data: unknown; // 最终业务数据，房玄龄已拆箱处理
    instruction: string; // 宰相明确指示
    timestamp: number; // 批复时间
    officials?: string[]; // 处理官员链
    metadata?: {
        processTime: number; // 总处理耗时
        escalated: boolean; // 是否上报了天界
        blessing?: string; // 来自天界的加持
        strategy?: string; // 使用的策略名称
    };
}

/**
 * 诏令数据结构
 * 诏令：房玄龄向袁天罡发布的指令文书
 */
export interface Zhaoling {
    command: string; // 指令内容
    context?: Record<string, unknown>; // 上下文信息
    timestamp: number; // 发布时间
    source: string; // 来源部门
    priority: "imperial" | "urgent" | "normal"; // 优先级
    requiresTianshuApproval?: boolean; // 是否需要天界批准
}

export interface ZhaolingResponse {
    acknowledged: boolean; // 袁天罡是否接受诏令
    command: string; // 原始指令
    data: unknown; // 直接的业务数据，袁天罡已拆箱处理
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
    ADD_PATH: "add_path", // 添加监控路径
    REMOVE_PATH: "remove_path", // 移除监控路径
    ADD_SCAN_FOLDER: "add_scan_folder", // 添加扫描文件夹
    GET_SCANNING_QUEUE: "get_scanning_queue", // 获取扫描队列（应用启动时恢复）
    ADD_SCAN_ACTION: "add_scan_action", // ✅ RFC 0042 Phase 2.4: 添加单个扫描任务（尉迟恭 → 房玄龄 → 天界）
    REMOVE_SCAN_ACTION: "remove_scan_action", // ✅ RFC 0042 Phase 2.4: 移除单个扫描任务（尉迟恭 → 房玄龄 → 天界）
    UPDATE_SCAN_ACTION_STATUS: "update_scan_action_status", // ✅ RFC 0048 v3: 更新扫描任务状态（状态机转换）
    // ✅ RFC 0042 Step 2.5: 魏征appState管理事务
    RESTORE_APP_STATE: "restore_app_state", // 恢复应用状态（应用启动时调用）
    UPDATE_FOLDER_TREE: "update_folder_tree", // 更新文件夹树（魏征 → 房玄龄 → 天界）
    SWITCH_FOLDER: "switch_folder", // 切换当前文件夹
    GET_FOLDER_TREE: "get_folder_tree", // 获取文件夹树（应用启动时恢复）
    UPDATE_PREFERENCES: "update_preferences", // 更新偏好设置
    SCAN_FOLDER: "scan_folder", // 扫描文件夹
    GET_STATUS: "get_status", // 获取状态
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
    YU_CHI_GONG: "尉迟恭", // 扫描队列管理官员 - 唐朝名将
    WEI_ZHENG: "魏征", // ✅ RFC 0042 Step 2.5: appState监察官员 - 唐朝谏臣
    THEME_SETTINGS: "阎立本", // 主题设置官员 - 唐朝著名画家、工艺家
    LANGUAGE_SETTINGS: "玄奘", // 语言设置官员 - 唐朝翻译家
    NOTIFICATION_SETTINGS: "狄仁杰", // 通知设置官员 - 唐朝名臣
    UPDATE_SETTINGS: "张择端", // 更新设置官员 - 宋代画家
    SCAN_SETTINGS: "米芾", // 扫描设置官员 - 宋代书法家
    ADVANCED_SETTINGS: "高士廉", // 高级设置官员 - 唐朝书法家
    QIN_QIONG: "秦琼", // 文件系统事件守护官员 - 唐朝名将
    YUANTIANGANG: "袁天罡", // 天界守护官员 - 唐朝道士
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
