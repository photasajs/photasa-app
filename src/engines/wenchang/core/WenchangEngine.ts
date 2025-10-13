/**
 * 文昌星君仙法殿堂
 * 掌管万世偏好典籍，主察仙界人间之心意传承
 */

import { EventEmitter } from "events";
import * as fs from "fs/promises";
import * as path from "path";
import { loggers } from "@common/logger";

const logger = loggers.wenchang;

// 使用统一的类型定义
import type {
    UserPreferences,
    PreferenceDelta,
    PreferenceSnapshot,
    PreferenceChangeEvent,
} from "../types/index";

// 接口定义已移至 types/index.ts

/**
 * 文昌星君仙法配置
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
 * 作为天界(Main进程)偏好设置的初始值和重置基准
 * 这些默认值应与人界(Renderer进程)PreferenceStore的默认值保持一致
 */
const DEFAULT_PREFERENCES: UserPreferences = {
    /** 初始修订版本号 */
    revision: 1,

    /** UI默认设置 */
    ui: {
        theme: "solarized-dark", // 默认使用solarized-dark主题，与Store一致
        layout: "grid", // 默认网格布局
        language: "zh-CN", // 默认简体中文
        sidebarWidth: 240, // 默认侧边栏宽度240px，与Store一致
        zoomLevel: 1.0, // 默认缩放级别100%
    },

    /** 显示默认设置 */
    display: {
        thumbnailSize: 150, // 默认缩略图尺寸150px，与Store一致
        sortOrder: "name", // 默认按名称排序，与Store一致
        groupBy: "none", // 默认不分组，与Store一致
        showHidden: false, // 默认不显示隐藏文件
        showMetadata: true, // 默认显示元数据
    },

    /** 扫描默认设置 */
    scanning: {
        autoScan: true, // 默认启用自动扫描
        excludePatterns: ["node_modules", ".git", "*.tmp"], // 默认排除常见的开发文件
        concurrency: 4, // 默认并发数为4
        watchEnabled: true, // 默认启用文件监控
        paths: [], // 初始监控路径为空，由用户添加
        // ✅ RFC 0038: scanFolders已删除
    },

    /** 性能默认设置 */
    performance: {
        maxCacheSize: 1000, // 默认最大缓存1000MB
        preloadCount: 50, // 默认预加载50个缩略图
        enableGpuAcceleration: true, // 默认启用GPU加速
    },

    /** 创建时间戳 */
    lastModified: Date.now(),
};

/**
 * 文昌星君仙法殿堂
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
     * 文昌星君仙法觉醒
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            logger.info("🌌 文昌星君归位，掌管偏好典籍");

            // 确保偏好目录存在
            await fs.mkdir(this.config.preferencesDir, { recursive: true });

            // 加载现有偏好
            await this.loadPreferences();

            // 启动自动保存
            if (this.config.autoSaveInterval && this.config.autoSaveInterval > 0) {
                this.startAutoSave();
            }

            this.isInitialized = true;
            logger.info("🌌 文昌星君就位完成，典籍库已开启");
            this.emit("initialized");
        } catch (error) {
            logger.error("🌌 文昌星君归位受阻，典籍库未能开启", error);
            throw error;
        }
    }

    /**
     * 文昌星君仙法清静
     */
    async shutdown(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        try {
            logger.info("🌌 文昌星君归隐，典籍库封存");

            // 停止自动保存
            if (this.autoSaveTimer) {
                clearInterval(this.autoSaveTimer);
                this.autoSaveTimer = undefined;
            }

            // 保存当前偏好
            await this.savePreferences();

            this.isInitialized = false;
            logger.info("🌌 文昌星君归隐完成，典籍库已封存");
            this.emit("shutdown");
        } catch (error) {
            logger.error("🌌 文昌星君归隐受阻，典籍库未能封存", error);
            throw error;
        }
    }

    /**
     * 获取当前偏好快照
     */
    getCurrentSnapshot(): PreferenceSnapshot {
        if (!this.isInitialized) {
            logger.warn("🌌 文昌星君尚未归位，返回默认偏好快照");
            return {
                data: { ...this.preferences },
                timestamp: Date.now(),
                revision: this.preferences.revision,
            };
        }

        return {
            data: { ...this.preferences },
            timestamp: Date.now(),
            revision: this.preferences.revision,
        };
    }

    /**
     * 深度合并对象（纯函数）
     * 递归合并source到target，不修改原始对象
     *
     * @param target 目标对象
     * @param source 源对象
     * @returns 合并后的新对象
     */
    private deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
        if (!source || typeof source !== "object") {
            return target;
        }

        if (!target || typeof target !== "object") {
            return source as T;
        }

        // 创建target的浅拷贝
        const result: Record<string, unknown> = { ...target };

        // 递归合并对象属性
        for (const [key, value] of Object.entries(source)) {
            if (value !== null && typeof value === "object" && !Array.isArray(value)) {
                // 嵌套对象递归合并
                if (!result[key] || typeof result[key] !== "object") {
                    result[key] = {};
                }
                result[key] = this.deepMerge(
                    result[key] as Record<string, unknown>,
                    value as Record<string, unknown>,
                );
            } else {
                // 基础类型和数组直接覆盖
                result[key] = value;
            }
        }

        return result as T;
    }

    /**
     * 应用偏好变更增量
     *
     * 【基于路径的深度合并存储逻辑】
     * 文昌星君只负责典籍持久化，不管理业务逻辑。
     * 所有业务计算（如路径数组的添加/移除）应由房玄龄在人界完成，
     * 文昌星君使用深度合并确保不丢失未修改的嵌套字段。
     */
    async applyDelta(delta: PreferenceDelta, _source = "unknown"): Promise<number> {
        if (!this.isInitialized) {
            logger.error("🌌 文昌星君尚未归位，典籍库未开启");
            throw new Error("WenchangEngine not initialized");
        }

        try {
            // ✅ 基于路径的深度merge：保留未修改的嵌套字段
            if (delta.ui) {
                this.preferences.ui = this.deepMerge(this.preferences.ui, delta.ui);
            }
            if (delta.display) {
                this.preferences.display = this.deepMerge(this.preferences.display, delta.display);
            }
            if (delta.scanning) {
                this.preferences.scanning = this.deepMerge(
                    this.preferences.scanning,
                    delta.scanning,
                );
            }
            if (delta.performance) {
                this.preferences.performance = this.deepMerge(
                    this.preferences.performance,
                    delta.performance,
                );
            }

            // 更新版本和时间戳
            this.preferences.revision++;
            this.preferences.lastModified = Date.now();

            // 保存偏好
            await this.savePreferences();

            // 创建快照并广播变更事件
            const snapshot = this.getCurrentSnapshot();
            const changeEvent: PreferenceChangeEvent = {
                type: "updated",
                snapshot,
                delta,
            };

            this.emit("preferenceChanged", changeEvent);

            logger.info(`🌌 仙术成功，典籍更新至第${this.preferences.revision}版`);
            return this.preferences.revision;
        } catch (error) {
            logger.error("🌌 仙术失败，典籍更新未能成功", error);
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

        logger.info("🌌 文昌星君逆转时空，典籍重归太初");
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

            logger.info(`🌌 文昌星君召唤典籍，第${this.preferences.revision}版已入仙库`);
        } catch (error) {
            if ((error as any).code === "ENOENT") {
                logger.info("🌌 先古典籍尚未存世，文昌星君创世之初");
                await this.savePreferences();
            } else {
                logger.error("🌌 典籍召唤受阻，仙缘未到", error);
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
            logger.info(`🌌 文昌星君封印典籍，第${this.preferences.revision}版永世传承`);
        } catch (error) {
            logger.error("🌌 典籍封印受阻，仙法受干扬", error);
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
                    logger.error("🌌 自动仙法受阻，典籍未能自动封印", error);
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
     * 检查文昌星君是否已觉醒
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

            // 添加调试信息，显示实际验证的数据类型和内容
            const actualType = Array.isArray(targetData) ? "array" : typeof targetData;
            logger.debug(`🌌 文昌星君查验数据：类型=${actualType}`, {
                dataKeys: Array.isArray(targetData)
                    ? `数组长度=${targetData.length}`
                    : typeof targetData === "object"
                      ? Object.keys(targetData)
                      : "非对象类型",
                dataType: actualType,
            });

            // 解析YAML格式的验证规则
            if (data.rules && Array.isArray(data.rules)) {
                for (const rule of data.rules) {
                    // 处理不同格式的规则
                    if (typeof rule === "object") {
                        // 增强类型验证 - 明确区分数组和对象
                        if (rule.type) {
                            const expectedType = rule.type;
                            let actualDataType: string = typeof targetData;

                            // 特殊处理数组类型
                            if (Array.isArray(targetData)) {
                                actualDataType = "array";
                            }

                            if (expectedType === "object" && actualDataType !== "object") {
                                errors.push(
                                    `数据类型不正确，期望 ${expectedType}，实际为 ${actualDataType}`,
                                );
                            } else if (expectedType === "array" && !Array.isArray(targetData)) {
                                errors.push(`数据类型不正确，期望 array，实际为 ${actualDataType}`);
                            } else if (
                                expectedType !== "object" &&
                                expectedType !== "array" &&
                                actualDataType !== expectedType
                            ) {
                                errors.push(
                                    `数据类型不正确，期望 ${expectedType}，实际为 ${actualDataType}`,
                                );
                            }
                        }

                        // 非空验证
                        if (
                            rule.notEmpty &&
                            (!targetData ||
                                (Array.isArray(targetData) && targetData.length === 0) ||
                                (typeof targetData === "object" &&
                                    !Array.isArray(targetData) &&
                                    Object.keys(targetData).length === 0))
                        ) {
                            errors.push("数据不能为空");
                        }

                        // 允许的键验证 - 仅对非数组对象进行此验证
                        if (rule.allowedKeys && Array.isArray(rule.allowedKeys)) {
                            if (Array.isArray(targetData)) {
                                errors.push(
                                    `数据类型错误：期望对象格式以进行字段验证，但收到数组类型（长度=${targetData.length}）`,
                                );
                            } else if (typeof targetData === "object") {
                                const dataKeys = Object.keys(targetData);
                                const invalidKeys = dataKeys.filter(
                                    (key) => !rule.allowedKeys.includes(key),
                                );
                                if (invalidKeys.length > 0) {
                                    errors.push(
                                        `不允许的字段: ${invalidKeys.join(", ")}，允许的字段: ${rule.allowedKeys.join(", ")}`,
                                    );
                                }
                            } else {
                                errors.push(
                                    `数据类型错误：期望对象格式以进行字段验证，但收到 ${typeof targetData} 类型`,
                                );
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
            logger.info(`🌌 文昌星君推演天机${isValid ? "，天道认可" : "，天道不容"}`, {
                errors: isValid ? [] : errors,
            });

            return {
                valid: isValid,
                errors: isValid ? undefined : errors,
            };
        } catch (error) {
            logger.error("🌌 推演天机遭反噶，仙法被阻", error);
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
    async sanitize(data: any): Promise<any> {
        logger.info("🌌 文昌星君施展净化之术");

        const sourceData = data.source || data;

        // 简单实现：直接返回源数据
        // 在实际应用中，这里应该根据rules进行数据清理和转换
        return sourceData;
    }

    /**
     * 更新偏好设置
     * 工作流支持方法
     */
    async updatePreferences(data: any): Promise<{ result: any }> {
        logger.info("🌌 文昌星君更新偏好典籍");

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
        logger.info("🌌 文昌星君广播天音");

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
        logger.info("🌌 文昌星君整理仙谕格式");
        return { result: data };
    }
}
