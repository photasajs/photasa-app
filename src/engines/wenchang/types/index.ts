/**
 * 文昌引擎类型定义
 * 独立的偏好管理服务类型
 */

export interface UserPreferences {
    revision: number;
    ui: {
        theme: "light" | "dark" | "auto";
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
    path: string; // e.g., 'ui.theme', 'display.thumbnailSize'
    value: any;
    revision: number; // 基于哪个版本的修改
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
