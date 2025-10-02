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
 * 默认偏好设置 - 与人界Store保持一致
 */
const DEFAULT_PREFERENCES: UserPreferences = {
    revision: 1,
    ui: {
        theme: "solarized-dark", // 与Store默认主题一致
        layout: "grid",
        language: "zh-CN",
        sidebarWidth: 240, // 与Store默认值一致
        zoomLevel: 1.0,
    },
    display: {
        thumbnailSize: 150, // 与Store默认值一致
        sortOrder: "name", // 与Store默认值一致
        groupBy: "none", // 与Store默认值一致
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

    /**
     * 验证输入数据
     * 工作流支持方法
     */
    async validate(data: any): Promise<{ valid: boolean; errors?: string[] }> {
        try {
            const errors: string[] = [];

            // 基本数据验证 - 检查主要数据字段
            const targetData = data.delta || data.data || data;

            if (targetData === null || targetData === undefined) {
                errors.push("验证数据不能为空");
                return { valid: false, errors };
            }

            // 解析YAML格式的验证规则
            if (data.rules && Array.isArray(data.rules)) {
                for (const rule of data.rules) {
                    // 处理不同格式的规则
                    if (typeof rule === "object") {
                        // 类型验证
                        if (rule.type && rule.type === "object" && typeof targetData !== "object") {
                            errors.push("数据类型不正确，期望 object");
                        }

                        // 非空验证
                        if (
                            rule.notEmpty &&
                            (!targetData || Object.keys(targetData).length === 0)
                        ) {
                            errors.push("数据不能为空");
                        }

                        // 允许的键验证
                        if (rule.allowedKeys && Array.isArray(rule.allowedKeys)) {
                            const dataKeys = Object.keys(targetData);
                            const invalidKeys = dataKeys.filter(
                                (key) => !rule.allowedKeys.includes(key),
                            );
                            if (invalidKeys.length > 0) {
                                errors.push(`不允许的字段: ${invalidKeys.join(", ")}`);
                            }
                        }
                    }

                    // 传统字段验证（向后兼容）
                    if (rule.field) {
                        if (
                            rule.required &&
                            (targetData[rule.field] === null ||
                                targetData[rule.field] === undefined)
                        ) {
                            errors.push(`字段 ${rule.field} 是必需的`);
                        }
                        if (rule.type && typeof targetData[rule.field] !== rule.type) {
                            errors.push(`字段 ${rule.field} 类型不正确，期望 ${rule.type}`);
                        }
                        if (rule.min !== undefined && targetData[rule.field] < rule.min) {
                            errors.push(`字段 ${rule.field} 值过小，最小值为 ${rule.min}`);
                        }
                        if (rule.max !== undefined && targetData[rule.field] > rule.max) {
                            errors.push(`字段 ${rule.field} 值过大，最大值为 ${rule.max}`);
                        }
                    }
                }
            }

            const isValid = errors.length === 0;
            logger.info(`🌌 偏好验证${isValid ? "通过" : "失败"}`, {
                errors: isValid ? [] : errors,
            });

            return {
                valid: isValid,
                errors: isValid ? undefined : errors,
            };
        } catch (error) {
            logger.error("🌌 验证过程失败", error);
            return {
                valid: false,
                errors: ["验证过程出现异常"],
            };
        }
    }

    /**
     * 清理和验证数据
     * 工作流支持方法
     */
    async sanitize(data: any): Promise<{ result: any }> {
        logger.info("🌌 文昌引擎施展净化之术");

        const sourceData = data.source || data;

        // 简单实现：直接返回源数据
        // 在实际应用中，这里应该根据rules进行数据清理和转换
        return { result: sourceData };
    }

    /**
     * 更新偏好设置
     * 工作流支持方法
     */
    async updatePreferences(data: any): Promise<{ result: any }> {
        logger.info("🌌 文昌引擎更新偏好典籍");

        const delta = data.delta || data;
        const source = data.source || "workflow";

        const revision = await this.applyDelta(delta, source);
        return { result: { revision, success: true } };
    }

    /**
     * 发送事件
     * 工作流支持方法
     */
    async emitEvent(data: any): Promise<{ id: string }> {
        logger.info("🌌 文昌引擎广播消息");

        // 生成事件ID并发送事件
        const eventId = `event-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        // 发送偏好变更事件
        this.emit("preferenceEvent", {
            id: eventId,
            data,
            timestamp: Date.now(),
        });

        return { id: eventId };
    }

    /**
     * 格式化响应
     * 工作流支持方法
     */
    async formatResponse(data: any): Promise<{ result: any }> {
        logger.info("🌌 文昌引擎整理响应格式");
        return { result: data };
    }
}
