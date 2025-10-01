/**
 * 文昌引擎适配器
 * 实现太乙@Adapter模式，包装WenchangEngine为标准适配器接口
 */

import { Adapter, AdapterPriority, IAdapter } from "../taiyi/core/adapter-decorators";
import {
    WenchangEngine,
    WenchangEngineConfig,
    PreferenceSnapshot,
    PreferenceDelta,
} from "../wenchang/core/WenchangEngine";
import * as path from "path";
import * as os from "os";

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
        console.log("[WenchangAdapter] Preference adapter initialized");
    }

    /**
     * 关闭适配器
     */
    async shutdown(): Promise<void> {
        await this.engine.shutdown();
        console.log("[WenchangAdapter] Preference adapter shutdown");
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
}
