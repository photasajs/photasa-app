/**
 * 文昌星君仙法类型定义
 * 万世偏好典籍仙法类型
 */

export interface UserPreferences {
    revision: number;
    ui: {
        theme: "light" | "dark" | "auto" | "solarized-dark" | "solarized-light" | string;
        layout: "grid" | "list" | "masonry";
        language: string;
        sidebarWidth: number;
        zoomLevel: number;
    };
    display: {
        thumbnailSize: number;
        sortOrder: "name" | "date" | "size" | "type";
        groupBy: "none" | "date" | "folder" | "type";
        showHidden: boolean;
        showMetadata: boolean;
    };
    scanning: {
        autoScan: boolean;
        excludePatterns: string[];
        concurrency: number;
        watchEnabled: boolean;
        paths: string[];
        scanFolders: Array<{
            path: string;
            action: "scan" | "rescan" | "current";
            source: "user" | "auto";
            timestamp: number;
        }>;
    };
    performance: {
        maxCacheSize: number;
        preloadCount: number;
        enableGpuAcceleration: boolean;
    };
    lastModified: number;
}

export interface PreferenceSnapshot {
    revision: number;
    data: UserPreferences;
    timestamp: number;
}

export interface PreferenceDelta {
    ui?: Partial<UserPreferences["ui"]>;
    display?: Partial<UserPreferences["display"]>;
    scanning?: Partial<UserPreferences["scanning"]>;
    performance?: Partial<UserPreferences["performance"]>;
    // 特殊操作，用于处理复杂的路径管理逻辑
    pathOperations?: Array<{
        type: "addPath" | "removePath" | "addScanFolder";
        data: any;
        timestamp: number;
    }>;
}

export interface PreferenceHistory {
    revision: number;
    delta: PreferenceDelta;
    timestamp: number;
    source: "user" | "system" | "import";
}

export interface WenchangConfig {
    enableHistory: boolean;
    maxHistorySize: number;
}

export interface PreferenceChangeEvent {
    type: "updated" | "imported" | "reset";
    snapshot: PreferenceSnapshot;
    delta?: PreferenceDelta;
}

/**
 * 路径同步事件
 */
export interface PathSyncEvent {
    type: "pathSync";
    operation: "addPath" | "removePath";
    path: string;
    timestamp: number;
    source: string;
}

/**
 * 扫描文件夹同步事件
 */
export interface ScanFolderSyncEvent {
    type: "scanFolderSync";
    operation: "addScanFolder" | "removeScanFolder" | "updateScanFolder";
    scanFolder: {
        path: string;
        action: "scan" | "rescan" | "current";
        source: "user" | "auto";
        timestamp: number;
    };
    timestamp: number;
    source: string;
}

/**
 * 路径操作结果
 */
export interface PathOperationResult {
    success: boolean;
    operation: string;
    path: string;
    message?: string;
    timestamp: number;
}
