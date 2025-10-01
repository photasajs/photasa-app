/**
 * 文昌偏好管理引擎
 * 负责用户偏好的持久化、镜像和同步
 */

import { EventEmitter } from "events";
import * as fs from "fs/promises";
import * as path from "path";
import { loggers } from "@common/logger";

const logger = loggers.wenchang;

/**
 * 用户偏好接口
 */
export interface UserPreferences {
    revision: number;
    ui: {
        theme: string;
        layout: string;
        language: string;
        sidebarWidth: number;
        zoomLevel: number;
    };
    display: {
        thumbnailSize: number;
        sortOrder: string;
        groupBy: string;
        showHidden: boolean;
        showMetadata: boolean;
    };
    scanning: {
        autoScan: boolean;
        excludePatterns: string[];
        concurrency: number;
        watchEnabled: boolean;
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
        sidebarWidth: 280,
        zoomLevel: 1,
    },
    display: {
        thumbnailSize: 200,
        sortOrder: "dateDesc",
        groupBy: "date",
        showHidden: false,
        showMetadata: true,
    },
    scanning: {
        autoScan: true,
        excludePatterns: ["node_modules", ".git", "*.tmp"],
        concurrency: 4,
        watchEnabled: true,
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
    private isDirty = false; // 脏标记，标识是否需要保存

    constructor(config: WenchangEngineConfig) {
        super();
        this.config = {
            autoSaveInterval: 0, // 禁用自动保存，所有修改都会立即保存
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
            logger.info("🌌 初始化偏好管理引擎");

            // 确保偏好目录存在
            await fs.mkdir(this.config.preferencesDir, { recursive: true });

            // 加载现有偏好
            await this.loadPreferences();

            // 启动自动保存
            if (this.config.autoSaveInterval && this.config.autoSaveInterval > 0) {
                this.startAutoSave();
            }

            this.isInitialized = true;
            logger.info("🌌 偏好管理引擎初始化完成");
            this.emit("initialized");
        } catch (error) {
            logger.error("🌌 初始化偏好管理引擎失败", error);
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
            logger.info("🌌 关闭偏好管理引擎");

            // 停止自动保存
            if (this.autoSaveTimer) {
                clearInterval(this.autoSaveTimer);
                this.autoSaveTimer = undefined;
            }

            // 保存当前偏好
            await this.savePreferences();

            this.isInitialized = false;
            logger.info("🌌 偏好管理引擎关闭完成");
            this.emit("shutdown");
        } catch (error) {
            logger.error("🌌 关闭偏好管理引擎失败", error);
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
            logger.error("🌌 偏好管理引擎未初始化");
            throw new Error("WenchangEngine not initialized");
        }

        try {
            // 应用变更
            // const _oldPreferences = { ...this.preferences };

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

            logger.info(`🌌 应用偏好变更, 新版本: ${this.preferences.revision}`);
            return this.preferences.revision;
        } catch (error) {
            logger.error("🌌 应用偏好变更失败", error);
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

        logger.info("🌌 重置偏好到默认值");
        return snapshot;
    }

    /**
     * 加载偏好文件
     */
    private async loadPreferences(): Promise<void> {
        try {
            const data = await fs.readFile(this.preferencesFile, "utf-8");
            const loaded = JSON.parse(data) as UserPreferences;

            // 深度合并偏好，确保所有默认字段都存在
            this.preferences = {
                ...DEFAULT_PREFERENCES,
                revision: loaded.revision || 1,
                ui: {
                    ...DEFAULT_PREFERENCES.ui,
                    ...(loaded.ui || {}),
                },
                display: {
                    ...DEFAULT_PREFERENCES.display,
                    ...(loaded.display || {}),
                },
                scanning: {
                    ...DEFAULT_PREFERENCES.scanning,
                    ...(loaded.scanning || {}),
                },
                lastModified: loaded.lastModified || Date.now(),
            };

            logger.info(`🌌 加载偏好, 版本: ${this.preferences.revision}`);
        } catch (error) {
            if ((error as any).code === "ENOENT") {
                logger.info("🌌 没有现有偏好文件, 使用默认值");
                await this.savePreferences();
            } else {
                logger.error("🌌 加载偏好失败", error);
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
            logger.info(`🌌 保存偏好, 版本: ${this.preferences.revision}`);
        } catch (error) {
            logger.error("🌌 保存偏好失败", error);
            throw error;
        }
    }

    /**
     * 启动自动保存
     */
    private startAutoSave(): void {
        this.autoSaveTimer = setInterval(async () => {
            // 只有在数据发生变化时才保存
            if (this.isDirty) {
                try {
                    await this.savePreferences();
                    this.isDirty = false; // 保存后重置脏标记
                } catch (error) {
                    logger.error("🌌 自动保存失败", error);
                }
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
