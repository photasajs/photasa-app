/**
 * 文昌引擎适配器
 * 实现太乙@Adapter模式，包装WenchangEngine为标准适配器接口
 */

import { Adapter, AdapterPriority, IAdapter } from "../taiyi/core/adapter-decorators";
import { WenchangEngine, WenchangEngineConfig } from "../wenchang/core/WenchangEngine";
import type { PreferenceSnapshot, PreferenceDelta } from "../wenchang/types/index";
import { loggers } from "@common/logger";
import * as path from "path";
import * as os from "os";

const logger = loggers.wenchang;

/**
 * 文昌适配器配置
 */
export interface WenchangAdapterConfig {
    /** 自定义偏好目录 */
    customPreferencesDir?: string;
    /** 自动保存间隔 */
    autoSaveInterval?: number;
    /** 是否启用历史记录 */
    enableHistory?: boolean;
}

/**
 * 文昌引擎适配器
 * 使用@Adapter装饰器注册到太乙注册中心
 */
@Adapter({
    name: "wenchang",
    displayName: "文昌偏好管理适配器",
    priority: AdapterPriority.High,
    description: "管理用户偏好、UI设置和应用配置的适配器",
    engineType: "preference",
    dependencies: [], // 文昌引擎不依赖其他引擎
    retryOnFailure: true,
    maxRetries: 3,
})
export class WenchangAdapter implements IAdapter {
    readonly name = "wenchang";
    private engine: WenchangEngine;

    constructor(config: WenchangAdapterConfig = {}) {
        // 默认偏好目录：~/.photasa/preferences/
        const defaultPreferencesDir = path.join(os.homedir(), ".photasa", "preferences");
        const preferencesDir = config.customPreferencesDir || defaultPreferencesDir;

        const engineConfig: WenchangEngineConfig = {
            preferencesDir,
            autoSaveInterval: config.autoSaveInterval || 0, // 禁用自动保存，所有修改都会立即保存
            enableHistory: config.enableHistory !== false,
            historyLimit: 10,
        };

        this.engine = new WenchangEngine(engineConfig);
    }

    /**
     * 初始化适配器
     */
    async initialize(): Promise<void> {
        await this.engine.initialize();
        logger.info("🌌 文昌星君归位，掌管偏好典籍");
    }

    /**
     * 关闭适配器
     */
    async shutdown(): Promise<void> {
        await this.engine.shutdown();
        logger.info("🌌 文昌星君归隐，典籍封存");
    }

    /**
     * 获取当前偏好快照
     */
    getCurrentSnapshot(): PreferenceSnapshot {
        return this.engine.getCurrentSnapshot();
    }

    /**
     * 应用偏好变更
     */
    async applyDelta(delta: PreferenceDelta, source = "adapter"): Promise<number> {
        return this.engine.applyDelta(delta, source);
    }

    /**
     * 重置偏好到默认值
     */
    async resetToDefaults(): Promise<PreferenceSnapshot> {
        return this.engine.resetToDefaults();
    }

    /**
     * 获取当前版本号
     */
    getRevision(): number {
        return this.engine.getRevision();
    }

    /**
     * 检查适配器是否就绪
     */
    isReady(): boolean {
        return this.engine.isReady();
    }

    /**
     * 监听偏好变更事件
     */
    onPreferenceChanged(callback: (event: any) => void): void {
        this.engine.on("preferenceChanged", callback);
    }

    /**
     * 移除偏好变更监听器
     */
    offPreferenceChanged(callback: (event: any) => void): void {
        this.engine.off("preferenceChanged", callback);
    }

    /**
     * 手动保存偏好
     */
    async savePreferences(): Promise<void> {
        await this.engine.savePreferences();
    }

    /**
     * 验证输入数据
     * 委托给引擎处理
     */
    async validate(data: any): Promise<{ valid: boolean; errors?: string[] }> {
        logger.debug("🌌 文昌适配器转发验证请求");
        return this.engine.validate(data);
    }

    /**
     * 清理和验证数据
     * 委托给引擎处理
     */
    async sanitize(data: any): Promise<{ result: any }> {
        logger.debug("🌌 文昌适配器转发净化请求");
        return this.engine.sanitize(data);
    }

    /**
     * 更新偏好设置
     * 委托给引擎处理
     */
    async updatePreferences(data: any): Promise<{ result: any }> {
        logger.debug("🌌 文昌适配器转发偏好更新请求");
        return this.engine.updatePreferences(data);
    }

    /**
     * 发送事件
     * 委托给引擎处理
     */
    async emitEvent(data: any): Promise<{ id: string }> {
        logger.debug("🌌 文昌适配器转发事件发送请求");
        return this.engine.emitEvent(data);
    }

    /**
     * 格式化响应
     * 委托给引擎处理
     */
    async formatResponse(data: any): Promise<{ result: any }> {
        logger.debug("🌌 文昌适配器转发响应格式化请求");
        return this.engine.formatResponse(data);
    }

    /**
     * 添加监控路径
     */
    async addPath(path: string): Promise<{ success: boolean; message?: string }> {
        try {
            const delta = {
                pathOperations: [
                    {
                        type: "addPath" as const,
                        data: path,
                        timestamp: Date.now(),
                    },
                ],
            };

            await this.engine.applyDelta(delta, "adapter");
            logger.info(`🌌 文昌适配器添加路径: ${path}`);
            return { success: true };
        } catch (error) {
            logger.error(`🌌 文昌适配器添加路径失败: ${path}`, error);
            return { success: false, message: (error as Error).message };
        }
    }

    /**
     * 移除监控路径
     */
    async removePath(path: string): Promise<{ success: boolean; message?: string }> {
        try {
            const delta = {
                pathOperations: [
                    {
                        type: "removePath" as const,
                        data: path,
                        timestamp: Date.now(),
                    },
                ],
            };

            await this.engine.applyDelta(delta, "adapter");
            logger.info(`🌌 文昌适配器移除路径: ${path}`);
            return { success: true };
        } catch (error) {
            logger.error(`🌌 文昌适配器移除路径失败: ${path}`, error);
            return { success: false, message: (error as Error).message };
        }
    }

    /**
     * 添加扫描文件夹
     */
    async addScanFolder(
        path: string,
        action: "scan" | "rescan" | "current" = "scan",
        source: "user" | "auto" = "user",
    ): Promise<{ success: boolean; message?: string }> {
        try {
            const delta = {
                pathOperations: [
                    {
                        type: "addScanFolder" as const,
                        data: { path, action, source },
                        timestamp: Date.now(),
                    },
                ],
            };

            await this.engine.applyDelta(delta, "adapter");
            logger.info(`🌌 文昌适配器添加扫描文件夹: ${path} (${action})`);
            return { success: true };
        } catch (error) {
            logger.error(`🌌 文昌适配器添加扫描文件夹失败: ${path}`, error);
            return { success: false, message: (error as Error).message };
        }
    }

    /**
     * 监听路径同步事件
     */
    onPathSync(callback: (event: any) => void): void {
        this.engine.on("pathSync", callback);
    }

    /**
     * 移除路径同步事件监听器
     */
    offPathSync(callback: (event: any) => void): void {
        this.engine.off("pathSync", callback);
    }

    /**
     * 监听扫描文件夹同步事件
     */
    onScanFolderSync(callback: (event: any) => void): void {
        this.engine.on("scanFolderSync", callback);
    }

    /**
     * 移除扫描文件夹同步事件监听器
     */
    offScanFolderSync(callback: (event: any) => void): void {
        this.engine.off("scanFolderSync", callback);
    }
}
