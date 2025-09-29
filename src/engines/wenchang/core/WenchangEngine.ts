/**
 * 文昌偏好管理引擎
 * 负责用户偏好的持久化、镜像和同步
 */

import { EventEmitter } from "events";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * 用户偏好接口
 */
export interface UserPreferences {
    revision: number;
    ui: {
        theme: string;
        layout: string;
        language: string;
    };
    display: {
        thumbnailSize: number;
        sortOrder: string;
        groupBy: string;
    };
    scanning: {
        autoScan: boolean;
        excludePatterns: string[];
        concurrency: number;
    };
    lastModified: number;
}

/**
 * 偏好快照接口
 */
export interface PreferenceSnapshot {
    data: UserPreferences;
    timestamp: number;
    revision: number;
}

/**
 * 偏好变更增量接口
 */
export interface PreferenceDelta {
    ui?: Partial<UserPreferences["ui"]>;
    display?: Partial<UserPreferences["display"]>;
    scanning?: Partial<UserPreferences["scanning"]>;
}

/**
 * 偏好变更事件接口
 */
export interface PreferenceChangeEvent {
    snapshot: PreferenceSnapshot;
    changes: PreferenceDelta;
    source: string;
}

/**
 * 文昌引擎配置
 */
export interface WenchangEngineConfig {
    /** 偏好存储目录 */
    preferencesDir: string;
    /** 自动保存间隔（毫秒） */
    autoSaveInterval?: number;
    /** 是否启用版本历史 */
    enableHistory?: boolean;
    /** 历史记录保留数量 */
    historyLimit?: number;
}

/**
 * 默认偏好设置
 */
const DEFAULT_PREFERENCES: UserPreferences = {
    revision: 1,
    ui: {
        theme: "system",
        layout: "grid",
        language: "zh-CN",
    },
    display: {
        thumbnailSize: 200,
        sortOrder: "dateDesc",
        groupBy: "date",
    },
    scanning: {
        autoScan: true,
        excludePatterns: ["node_modules", ".git", "*.tmp"],
        concurrency: 4,
    },
    lastModified: Date.now(),
};

/**
 * 文昌偏好管理引擎
 */
export class WenchangEngine extends EventEmitter {
    private config: WenchangEngineConfig;
    private preferences: UserPreferences;
    private isInitialized = false;
    private preferencesFile: string;
    private autoSaveTimer?: NodeJS.Timeout;

    constructor(config: WenchangEngineConfig) {
        super();
        this.config = {
            autoSaveInterval: 5000,
            enableHistory: true,
            historyLimit: 10,
            ...config,
        };

        this.preferencesFile = path.join(this.config.preferencesDir, "preferences.json");
        this.preferences = { ...DEFAULT_PREFERENCES };
    }

    /**
     * 初始化文昌引擎
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log("[WenchangEngine] Initializing preference engine...");

            // 确保偏好目录存在
            await fs.mkdir(this.config.preferencesDir, { recursive: true });

            // 加载现有偏好
            await this.loadPreferences();

            // 启动自动保存
            if (this.config.autoSaveInterval && this.config.autoSaveInterval > 0) {
                this.startAutoSave();
            }

            this.isInitialized = true;
            console.log("[WenchangEngine] Preference engine initialized successfully");
            this.emit("initialized");
        } catch (error) {
            console.error("[WenchangEngine] Failed to initialize preference engine:", error);
            throw error;
        }
    }

    /**
     * 关闭文昌引擎
     */
    async shutdown(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        try {
            console.log("[WenchangEngine] Shutting down preference engine...");

            // 停止自动保存
            if (this.autoSaveTimer) {
                clearInterval(this.autoSaveTimer);
                this.autoSaveTimer = undefined;
            }

            // 保存当前偏好
            await this.savePreferences();

            this.isInitialized = false;
            console.log("[WenchangEngine] Preference engine shutdown complete");
            this.emit("shutdown");
        } catch (error) {
            console.error("[WenchangEngine] Error during preference engine shutdown:", error);
            throw error;
        }
    }

    /**
     * 获取当前偏好快照
     */
    getCurrentSnapshot(): PreferenceSnapshot {
        return {
            data: { ...this.preferences },
            timestamp: Date.now(),
            revision: this.preferences.revision,
        };
    }

    /**
     * 应用偏好变更增量
     */
    async applyDelta(delta: PreferenceDelta, source = "unknown"): Promise<number> {
        if (!this.isInitialized) {
            throw new Error("WenchangEngine not initialized");
        }

        try {
            // 应用变更
            const _oldPreferences = { ...this.preferences };

            if (delta.ui) {
                this.preferences.ui = { ...this.preferences.ui, ...delta.ui };
            }
            if (delta.display) {
                this.preferences.display = { ...this.preferences.display, ...delta.display };
            }
            if (delta.scanning) {
                this.preferences.scanning = { ...this.preferences.scanning, ...delta.scanning };
            }

            // 更新版本和时间戳
            this.preferences.revision++;
            this.preferences.lastModified = Date.now();

            // 保存偏好
            await this.savePreferences();

            // 创建快照并广播变更事件
            const snapshot = this.getCurrentSnapshot();
            const changeEvent: PreferenceChangeEvent = {
                snapshot,
                changes: delta,
                source,
            };

            this.emit("preferenceChanged", changeEvent);

            console.log(
                `[WenchangEngine] Applied preference delta, new revision: ${this.preferences.revision}`,
            );
            return this.preferences.revision;
        } catch (error) {
            console.error("[WenchangEngine] Failed to apply preference delta:", error);
            throw error;
        }
    }

    /**
     * 重置偏好到默认值
     */
    async resetToDefaults(): Promise<PreferenceSnapshot> {
        if (!this.isInitialized) {
            throw new Error("WenchangEngine not initialized");
        }

        this.preferences = {
            ...DEFAULT_PREFERENCES,
            revision: this.preferences.revision + 1,
            lastModified: Date.now(),
        };

        await this.savePreferences();

        const snapshot = this.getCurrentSnapshot();
        this.emit("preferenceChanged", {
            snapshot,
            changes: {},
            source: "reset",
        });

        console.log("[WenchangEngine] Reset preferences to defaults");
        return snapshot;
    }

    /**
     * 加载偏好文件
     */
    private async loadPreferences(): Promise<void> {
        try {
            const data = await fs.readFile(this.preferencesFile, "utf-8");
            const loaded = JSON.parse(data) as UserPreferences;

            // 验证并合并偏好
            this.preferences = {
                ...DEFAULT_PREFERENCES,
                ...loaded,
                revision: loaded.revision || 1,
            };

            console.log(
                `[WenchangEngine] Loaded preferences, revision: ${this.preferences.revision}`,
            );
        } catch (error) {
            if ((error as any).code === "ENOENT") {
                console.log("[WenchangEngine] No existing preferences file, using defaults");
                await this.savePreferences();
            } else {
                console.error("[WenchangEngine] Error loading preferences:", error);
                throw error;
            }
        }
    }

    /**
     * 保存偏好文件
     */
    async savePreferences(): Promise<void> {
        try {
            const data = JSON.stringify(this.preferences, null, 2);
            await fs.writeFile(this.preferencesFile, data, "utf-8");
            console.log(
                `[WenchangEngine] Saved preferences, revision: ${this.preferences.revision}`,
            );
        } catch (error) {
            console.error("[WenchangEngine] Error saving preferences:", error);
            throw error;
        }
    }

    /**
     * 启动自动保存
     */
    private startAutoSave(): void {
        this.autoSaveTimer = setInterval(async () => {
            try {
                await this.savePreferences();
            } catch (error) {
                console.error("[WenchangEngine] Auto-save failed:", error);
            }
        }, this.config.autoSaveInterval);
    }

    /**
     * 获取当前版本号
     */
    getRevision(): number {
        return this.preferences.revision;
    }

    /**
     * 检查引擎是否已初始化
     */
    isReady(): boolean {
        return this.isInitialized;
    }
}
