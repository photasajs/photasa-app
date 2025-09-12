// Color mapping for consistent theming
export const ColorMap = {
    success: "#52c41a",
    primary: "#1890ff",
    warning: "#faad14",
    error: "#ff4d4f",
    disabled: "#999",
    default: "#666",
} as const;

/**
 * Status Color Map for UI
 */
export const StatusColorMap: Record<string, string> = {
    completed: ColorMap.success,
    processing: ColorMap.primary,
    paused: ColorMap.warning,
    error: ColorMap.error,
    cancelled: ColorMap.disabled,
};

export const DirectoryStatusDisplayMap: Record<string, string> = {
    error: "exception",
    completed: "success",
    paused: "normal",
};

/**
 * 目录处理状态
 */
export const DirectoryStatus = {
    error: "error",
    completed: "completed",
    paused: "paused",
    pending: "pending",
    finishing: "finishing",
};

/**
 * IPC事件名称常量 - 导入相关
 */
export const ImportEvents = {
    // IPC调用事件
    EXECUTE: "import:execute",
    CANCEL: "import:cancel",
    PAUSE: "import:pause",
    RESUME: "import:resume",
    PREVIEW: "import:preview",
    SCAN_DIRECTORIES: "import:scan-directories",
    GET_HISTORY: "import:get-history",
    GET_DETAILS: "import:get-details",
    GET_PROGRESS: "import:get-progress",
    PREVIEW_UNDO: "import:preview-undo",
    UNDO: "import:undo",
    CHOOSE_DIRECTORIES: "import:choose-directories",
    EXTRACT_METADATA: "import:extract-metadata",

    // 事件驱动通知
    PROGRESS: "import:progress",
    COMPLETE: "import:complete",
    ERROR: "import:error",
} as const;

/**
 * IPC事件名称类型
 */
export type ImportEventName = (typeof ImportEvents)[keyof typeof ImportEvents];

/**
 * 导入Worker动作类型常量
 */
export const ImportWorkerActions = {
    EXTRACT_METADATA: "extract_metadata",
    PROCESS_FILE_GROUP: "process_file_group",
    SCAN_DIRECTORIES: "scan_directories",
    PREVIEW_IMPORT: "preview_import",
    EXECUTE_IMPORT: "execute_import",
} as const;

/**
 * 导入Worker动作类型
 */
export type ImportWorkerActionType = keyof typeof ImportWorkerActions;

/**
 * 文件类型检测器常量
 */
export const FileTypeDetectors = {
    IMAGE: "image",
    VIDEO: "video",
    OTHER: "other",
    ALL: "all",
} as const;

/**
 * 重复处理策略常量
 */
export const DuplicateStrategies = {
    SKIP: "skip", // 智能跳过：检查文件内容，只跳过真正相同的文件
    RENAME: "rename", // 重命名导入：新文件重命名为 filename_1.jpg 等
    OVERWRITE: "overwrite", // 覆盖原文件：用新文件替换现有文件
    KEEP_BOTH: "keep_both", // 智能保留：根据差异添加有意义后缀
} as const;

/**
 * 错误类别常量
 */
export const ErrorCategories = {
    FILE_SYSTEM: "FILE_SYSTEM",
    METADATA: "METADATA",
    DUPLICATE: "DUPLICATE",
    VALIDATION: "VALIDATION",
    UNKNOWN: "UNKNOWN",
} as const;

/**
 * 错误严重程度常量
 */
export const ErrorSeverities = {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
} as const;

/**
 * 日期来源常量
 */
export const DateSources = {
    EXIF: "exif",
    VIDEO_METADATA: "video_metadata",
    FILE_CREATED: "file_created",
    FILE_MODIFIED: "file_modified",
    CURRENT_DATE: "current_date",
} as const;

/**
 * 文件组类型常量
 */
export const FileGroupTypes = {
    SINGLE: "single",
    GROUP: "group",
} as const;

/**
 * 文件操作事件优先级常量
 */
export const FileOperationPriorities = {
    Delete: 1, // Highest priority
    DeleteDir: 1, // Highest priority
    Change: 2, // Medium priority
    Add: 3, // Lower priority
    AddDir: 4, // Lowest priority
    Default: 5, // Unknown types
} as const;

/**
 * 文件操作去重时间窗口常量 (毫秒)
 */
export const FileOperationDeduplicationWindows = {
    Add: 50, // Short window for add events (new files)
    Change: 200, // Longer window for change events (file modifications)
    Delete: 100, // Medium window for delete events
    AddDir: 100, // Medium window for directory creation
    DeleteDir: 100, // Medium window for directory deletion
    Default: 100, // Unknown types
} as const;

/**
 * 防抖时间配置常量 (毫秒)
 */
export const DebounceTimeConfig = {
    HighLoad: 50, // > 1000 events: shorter debounce
    MediumLoad: 100, // > 100 events: normal debounce
    LowLoad: 200, // <= 100 events: longer debounce for efficiency
    HighLoadThreshold: 1000,
    MediumLoadThreshold: 100,
} as const;

/**
 * 事件丢失防护配置常量
 */
export const EventLossPreventionConfig = {
    MaxPendingEvents: 8000, // Force process when reaching this limit
    ForceProcessInterval: 5000, // Force process after this time (ms)
} as const;
