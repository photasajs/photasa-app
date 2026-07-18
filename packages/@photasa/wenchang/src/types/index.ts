/**
 * 文昌星君仙法类型定义
 * 万世偏好典籍仙法类型
 *
 * 此接口定义用户偏好设置的完整结构，是天界(Main进程)偏好设置的权威定义。
 * 人界(Renderer进程)的PreferenceStore应与此结构保持一致，形成天地镜像。
 */

export interface UserPreferences {
    /** 修订版本号，用于偏好设置的版本控制和同步验证 */
    revision: number;

    /** 用户界面相关偏好设置 */
    ui: {
        /** 主题标识：支持light、dark、auto、solarized-dark、solarized-light等 */
        theme: "light" | "dark" | "auto" | "solarized-dark" | "solarized-light" | string;
        /** 布局模式：网格、列表、瀑布流 */
        layout: "grid" | "list" | "masonry";
        /** 语言代码：如zh-CN、en-US等 */
        language: string;
        /** 侧边栏宽度(像素) */
        sidebarWidth: number;
        /** 缩放级别：1.0为100% */
        zoomLevel: number;
    };

    /** 显示相关偏好设置 */
    display: {
        /** 缩略图尺寸(像素)：范围150-400 */
        thumbnailSize: number;
        /** 排序方式：按名称、日期、大小、类型 */
        sortOrder: "name" | "date" | "size" | "type";
        /** 分组方式：不分组、按日期、按文件夹、按类型 */
        groupBy: "none" | "date" | "folder" | "type";
        /** 是否显示隐藏文件 */
        showHidden: boolean;
        /** 是否显示元数据信息 */
        showMetadata: boolean;
    };

    /** 扫描相关偏好设置 */
    scanning: {
        /** 是否启用自动扫描 */
        autoScan: boolean;
        /** 排除的路径模式列表：如.git、node_modules等 */
        excludePatterns: string[];
        /** 扫描并发数：控制同时扫描的文件夹数量 */
        concurrency: number;
        /** 是否启用文件监控 */
        watchEnabled: boolean;
        /** 监控的路径列表：用户添加的顶层文件夹路径 */
        paths: string[];
        // ✅ RFC 0038: scanFolders已删除
        // 扫描队列(scanningFolder)将来由尉迟恭服务(人界)和千里眼引擎(天界)管理
        // 不应作为用户偏好设置的一部分持久化
    };

    /** 性能相关偏好设置 */
    performance: {
        /** 最大缓存大小(MB) */
        maxCacheSize: number;
        /** 预加载数量：提前加载的缩略图数量 */
        preloadCount: number;
        /** 是否启用GPU加速 */
        enableGpuAcceleration: boolean;
    };

    /** 最后修改时间戳 */
    lastModified: number;
}

/**
 * 偏好设置快照
 * 用于捕获某一时刻的完整偏好设置状态，支持历史记录和回滚功能
 */
export interface PreferenceSnapshot {
    /** 快照对应的修订版本号 */
    revision: number;
    /** 完整的偏好设置数据 */
    data: UserPreferences;
    /** 快照创建时间戳 */
    timestamp: number;
}

/**
 * 偏好设置增量更新
 * 用于描述偏好设置的部分更新，避免传输完整数据，提高同步效率
 *
 * ✅ RFC 0038架构修正：PreferenceDelta只包含纯数据字段
 * - 业务逻辑由房玄龄负责：计算需要修改的preferences字段
 * - Wenchang只负责存储：接收delta并应用到preferences
 * - 不再需要pathOperations等业务操作指令
 */
export interface PreferenceDelta {
    /** UI设置的部分更新 */
    ui?: Partial<UserPreferences["ui"]>;
    /** 显示设置的部分更新 */
    display?: Partial<UserPreferences["display"]>;
    /** 扫描设置的部分更新 */
    scanning?: Partial<UserPreferences["scanning"]>;
    /** 性能设置的部分更新 */
    performance?: Partial<UserPreferences["performance"]>;
    // ✅ RFC 0038: pathOperations已删除
    // 房玄龄直接通过scanning字段修改paths，不需要特殊的pathOperations指令
}

/**
 * 偏好设置历史记录
 * 用于记录每次偏好设置变更的增量信息，支持审计和回滚
 */
export interface PreferenceHistory {
    /** 变更对应的修订版本号 */
    revision: number;
    /** 增量变更内容 */
    delta: PreferenceDelta;
    /** 变更时间戳 */
    timestamp: number;
    /** 变更来源：用户操作、系统自动、导入 */
    source: "user" | "system" | "import";
}

/**
 * 文昌引擎配置
 * 控制文昌引擎的行为特性
 */
export interface WenchangConfig {
    /** 是否启用历史记录功能 */
    enableHistory: boolean;
    /** 最大历史记录数量：超过后自动清理旧记录 */
    maxHistorySize: number;
}

/**
 * 偏好设置变更事件
 * 文昌引擎在偏好设置变更后发出此事件，用于通知人界更新镜像
 *
 * ✅ RFC 0038架构修正：统一使用preferenceChanged事件
 * - 所有偏好变更（包括paths、excludePatterns等）都通过此事件通知
 * - 不再需要特殊的PathSyncEvent或ScanFolderSyncEvent
 * - 人界通过监听此事件保持与天界的镜像同步
 */
export interface PreferenceChangeEvent {
    /** 事件类型：更新、导入、重置 */
    type: "updated" | "imported" | "reset";
    /** 变更后的完整快照 */
    snapshot: PreferenceSnapshot;
    /** 增量变更内容(可选) */
    delta?: PreferenceDelta;
}

// ✅ RFC 0038: PathSyncEvent、ScanFolderSyncEvent、PathOperationResult已删除
//
// 架构修正原因：
// 1. PathSyncEvent: 路径变更由房玄龄通过applyDelta处理，统一使用preferenceChanged事件通知
// 2. ScanFolderSyncEvent: 扫描文件夹管理将来由尉迟恭(人界)和千里眼(天界)负责
// 3. PathOperationResult: 属于业务逻辑返回值，不应在Wenchang类型定义中
//
// Wenchang只需要一个统一的preferenceChanged事件，涵盖所有偏好变更场景
