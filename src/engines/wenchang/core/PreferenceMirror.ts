/**
 * 文昌偏好镜像 - 为UI层提供无状态的偏好访问接口
 * 完全独立于文昌服务的具体实现，只提供纯粹的数据桥接
 */

import { EventEmitter } from "events";
import type {
    UserPreferences,
    PreferenceSnapshot,
    PreferenceDelta,
    PreferenceChangeEvent,
} from "../types";

export interface PreferenceMirrorState {
    snapshot: PreferenceSnapshot | null;
    isLoading: boolean;
    lastError: Error | null;
}

export interface PreferenceMirrorConfig {
    enableDebugLogging: boolean;
    retryAttempts: number;
    retryDelay: number;
}

/**
 * 偏好镜像 - UI层偏好状态的本地镜像
 * 通过IPC与文昌服务通信，为UI提供即时的偏好数据访问
 */
export class PreferenceMirror extends EventEmitter {
    private state: PreferenceMirrorState = {
        snapshot: null,
        isLoading: false,
        lastError: null,
    };

    private config: PreferenceMirrorConfig;
    private retryTimeouts: Set<NodeJS.Timeout> = new Set();

    constructor(config: Partial<PreferenceMirrorConfig> = {}) {
        super();
        this.config = {
            enableDebugLogging: false,
            retryAttempts: 3,
            retryDelay: 1000,
            ...config,
        };
    }

    /**
     * 初始化镜像，从文昌服务同步当前状态
     */
    async initialize(): Promise<void> {
        this.state.isLoading = true;
        this.state.lastError = null;

        try {
            this.log("[PreferenceMirror] 初始化镜像，从文昌服务同步状态");

            // 通过IPC获取当前偏好快照
            const snapshot = await this.invokeWenchangService("getCurrentSnapshot");

            this.state.snapshot = snapshot;
            this.state.isLoading = false;

            this.log("[PreferenceMirror] 镜像初始化完成", snapshot.revision);

            // 监听文昌服务的变更事件
            this.setupWenchangListener();

            this.emit("initialized", snapshot);
        } catch (error) {
            this.state.lastError = error as Error;
            this.state.isLoading = false;
            this.log("[PreferenceMirror] 镜像初始化失败", error);
            throw error;
        }
    }

    /**
     * 获取当前偏好快照（镜像版本）
     */
    getCurrentSnapshot(): PreferenceSnapshot | null {
        return this.state.snapshot ? { ...this.state.snapshot } : null;
    }

    /**
     * 获取特定路径的偏好值
     */
    getPreferenceValue(path: string): any {
        if (!this.state.snapshot) {
            throw new Error("[PreferenceMirror] 镜像未初始化");
        }

        const pathParts = path.split(".");
        let current: any = this.state.snapshot.data;

        for (const part of pathParts) {
            if (current && typeof current === "object" && part in current) {
                current = current[part];
            } else {
                return undefined;
            }
        }

        return current;
    }

    /**
     * 应用偏好变更（异步提交到文昌服务）
     */
    async applyDelta(delta: PreferenceDelta): Promise<number> {
        if (!this.state.snapshot) {
            throw new Error("[PreferenceMirror] 镜像未初始化");
        }

        // 确保使用当前镜像的版本号
        const deltaWithCurrentRevision = {
            ...delta,
            revision: this.state.snapshot.revision,
        };

        try {
            this.log("[PreferenceMirror] 提交偏好变更", deltaWithCurrentRevision);

            const newRevision = await this.invokeWenchangService(
                "applyDelta",
                deltaWithCurrentRevision,
            );

            this.log("[PreferenceMirror] 偏好变更成功", newRevision);
            return newRevision;
        } catch (error) {
            this.log("[PreferenceMirror] 偏好变更失败", error);
            throw error;
        }
    }

    /**
     * 重置偏好到默认值
     */
    async resetToDefaults(): Promise<PreferenceSnapshot> {
        try {
            this.log("[PreferenceMirror] 重置偏好到默认值");

            const snapshot = await this.invokeWenchangService("resetToDefaults");

            this.log("[PreferenceMirror] 偏好重置成功", snapshot.revision);
            return snapshot;
        } catch (error) {
            this.log("[PreferenceMirror] 偏好重置失败", error);
            throw error;
        }
    }

    /**
     * 导入偏好配置
     */
    async importPreferences(preferences: Partial<UserPreferences>): Promise<PreferenceSnapshot> {
        try {
            this.log("[PreferenceMirror] 导入偏好配置");

            const snapshot = await this.invokeWenchangService("importPreferences", preferences);

            this.log("[PreferenceMirror] 偏好导入成功", snapshot.revision);
            return snapshot;
        } catch (error) {
            this.log("[PreferenceMirror] 偏好导入失败", error);
            throw error;
        }
    }

    /**
     * 获取镜像状态
     */
    getState(): PreferenceMirrorState {
        return { ...this.state };
    }

    /**
     * 销毁镜像，清理资源
     */
    destroy(): void {
        this.log("[PreferenceMirror] 销毁镜像");

        // 清理重试超时
        this.retryTimeouts.forEach((timeout) => clearTimeout(timeout));
        this.retryTimeouts.clear();

        // 移除IPC监听器
        this.removeWenchangListener();

        // 重置状态
        this.state = {
            snapshot: null,
            isLoading: false,
            lastError: null,
        };

        this.removeAllListeners();
    }

    // ========== 私有方法 ==========

    /**
     * 调用文昌服务方法（通过IPC）
     */
    private async invokeWenchangService(method: string, ...args: any[]): Promise<any> {
        // 在实际应用中，这里会通过IPC调用文昌服务
        // 当前为了测试，抛出错误提示需要实际IPC实现
        if (typeof window !== "undefined" && window.electron?.ipcRenderer) {
            return window.electron.ipcRenderer.invoke(`wenchang.${method}`, ...args);
        }

        throw new Error(`[PreferenceMirror] IPC not available for method: ${method}`);
    }

    /**
     * 设置文昌服务变更监听器
     */
    private setupWenchangListener(): void {
        if (typeof window !== "undefined" && window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.on(
                "wenchang.preferenceChanged",
                this.handleWenchangEvent.bind(this),
            );
        }
    }

    /**
     * 移除文昌服务监听器
     */
    private removeWenchangListener(): void {
        if (typeof window !== "undefined" && window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.removeAllListeners("wenchang.preferenceChanged");
        }
    }

    /**
     * 处理文昌服务变更事件
     */
    private handleWenchangEvent(event: PreferenceChangeEvent): void {
        this.log("[PreferenceMirror] 收到文昌服务变更事件", event.type, event.snapshot.revision);

        // 更新镜像状态
        this.state.snapshot = event.snapshot;
        this.state.lastError = null;

        // 向UI转发变更事件
        this.emit("preferenceChanged", event);
    }

    /**
     * 调试日志
     */
    private log(message: string, ...args: any[]): void {
        if (this.config.enableDebugLogging) {
            console.log(message, ...args);
        }
    }
}
