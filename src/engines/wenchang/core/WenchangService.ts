/**
 * 文昌服务 - 独立的偏好管理服务
 * 完全独立于司簿，专门处理用户偏好的持久化、镜像和同步
 */

import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import { EventEmitter } from "events";
import type { BrowserWindow, IpcMain } from "electron";
import { Service } from "../../../main/tianting/decorators/service-decorators";
import { ServicePriority } from "../../../main/tianting/core/service-types";
import type { IService } from "../../../main/tianting/core/service-types";
import type {
    UserPreferences,
    PreferenceSnapshot,
    PreferenceDelta,
    PreferenceHistory,
    WenchangConfig,
    PreferenceChangeEvent,
} from "../types";

@Service({
    name: "wenchang",
    displayName: "文昌偏好管理服务",
    priority: ServicePriority.Critical,
    description: "RFC 0032: 独立偏好管理服务，负责用户偏好的持久化、镜像和同步",
    dependencies: [],
    retryOnFailure: true,
    maxRetries: 3,
})
export class WenchangService extends EventEmitter implements IService {
    readonly name = "wenchang";
    private config: WenchangConfig;
    private currentSnapshot: PreferenceSnapshot | null = null;
    private history: PreferenceHistory[] = [];
    private readonly storagePath: string;

    constructor(
        private _ipcMain: IpcMain,
        private _mainWindow: BrowserWindow,
        config: WenchangConfig = { enableHistory: true, maxHistorySize: 100 },
    ) {
        super();
        // 这些参数在构造函数中声明但可能未使用，保留用于未来扩展
        // 使用 void 操作符来避免未使用变量警告
        void this._ipcMain;
        void this._mainWindow;
        this.config = config;
        // RFC 0032: 文昌存储在 ~/.photasa/preferences/
        this.storagePath = join(homedir(), ".photasa", "preferences");
    }

    /**
     * 初始化文昌服务
     */
    async initialize(): Promise<void> {
        await this.ensureStorageDirectory();
        await this.loadPreferences();
    }

    /**
     * 获取当前偏好快照
     */
    getCurrentSnapshot(): PreferenceSnapshot {
        if (!this.currentSnapshot) {
            throw new Error("[WenchangService] Preferences not initialized");
        }
        return { ...this.currentSnapshot };
    }

    /**
     * 应用偏好增量变更
     */
    async applyDelta(delta: PreferenceDelta): Promise<number> {
        if (!this.currentSnapshot) {
            throw new Error("[WenchangService] Preferences not initialized");
        }

        // 版本检查
        if (delta.revision !== this.currentSnapshot.revision) {
            throw new Error(
                `[WenchangService] Version conflict: expected ${this.currentSnapshot.revision}, got ${delta.revision}`,
            );
        }

        // 应用变更
        const newData = this.applyDeltaToData(this.currentSnapshot.data, delta);
        const newRevision = this.currentSnapshot.revision + 1;

        const newSnapshot: PreferenceSnapshot = {
            revision: newRevision,
            data: newData,
            timestamp: Date.now(),
        };

        // 持久化
        await this.saveSnapshot(newSnapshot);

        // 更新内存状态
        this.currentSnapshot = newSnapshot;

        // 记录历史
        if (this.config.enableHistory) {
            this.addToHistory({
                revision: newRevision,
                delta,
                timestamp: Date.now(),
                source: "user",
            });
        }

        // 发出变更事件
        this.emit("preferenceChanged", {
            type: "updated",
            snapshot: newSnapshot,
            delta,
        } as PreferenceChangeEvent);

        return newRevision;
    }

    /**
     * 获取偏好历史
     */
    getHistory(limit?: number): PreferenceHistory[] {
        const history = [...this.history].reverse(); // 最新的在前
        return limit ? history.slice(0, limit) : history;
    }

    /**
     * 重置偏好到默认值
     */
    async resetToDefaults(): Promise<PreferenceSnapshot> {
        const defaultPrefs = this.createDefaultPreferences();
        const newRevision = this.currentSnapshot ? this.currentSnapshot.revision + 1 : 1;

        const snapshot: PreferenceSnapshot = {
            revision: newRevision,
            data: defaultPrefs,
            timestamp: Date.now(),
        };

        await this.saveSnapshot(snapshot);
        this.currentSnapshot = snapshot;

        this.emit("preferenceChanged", {
            type: "reset",
            snapshot,
        } as PreferenceChangeEvent);

        return snapshot;
    }

    /**
     * 导入偏好配置
     */
    async importPreferences(preferences: Partial<UserPreferences>): Promise<PreferenceSnapshot> {
        const merged = this.mergePreferences(
            this.currentSnapshot?.data || this.createDefaultPreferences(),
            preferences,
        );

        const newRevision = this.currentSnapshot ? this.currentSnapshot.revision + 1 : 1;
        const snapshot: PreferenceSnapshot = {
            revision: newRevision,
            data: merged,
            timestamp: Date.now(),
        };

        await this.saveSnapshot(snapshot);
        this.currentSnapshot = snapshot;

        this.emit("preferenceChanged", {
            type: "imported",
            snapshot,
        } as PreferenceChangeEvent);

        return snapshot;
    }

    /**
     * 关闭文昌服务
     */
    async shutdown(): Promise<void> {
        this.removeAllListeners();
    }

    // ========== 私有方法 ==========

    private async ensureStorageDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.storagePath, { recursive: true });
        } catch (error) {
            throw new Error(`[WenchangService] Failed to create storage directory: ${error}`);
        }
    }

    private async loadPreferences(): Promise<void> {
        const preferencesFile = join(this.storagePath, "preferences.json");
        const historyFile = join(this.storagePath, "history.json");

        try {
            // 加载偏好数据
            const data = await fs.readFile(preferencesFile, "utf-8");
            this.currentSnapshot = JSON.parse(data);
        } catch (error) {
            // 文件不存在，创建默认偏好
            console.log("[WenchangService] No existing preferences, creating defaults");
            this.currentSnapshot = {
                revision: 1,
                data: this.createDefaultPreferences(),
                timestamp: Date.now(),
            };
            await this.saveSnapshot(this.currentSnapshot);
        }

        // 加载历史记录
        if (this.config.enableHistory) {
            try {
                const historyData = await fs.readFile(historyFile, "utf-8");
                this.history = JSON.parse(historyData);
            } catch (error) {
                // 历史文件不存在，从空数组开始
                this.history = [];
            }
        }
    }

    private async saveSnapshot(snapshot: PreferenceSnapshot): Promise<void> {
        const preferencesFile = join(this.storagePath, "preferences.json");

        try {
            await fs.writeFile(preferencesFile, JSON.stringify(snapshot, null, 2), "utf-8");
        } catch (error) {
            throw new Error(`[WenchangService] Failed to save preferences: ${error}`);
        }
    }

    private async saveHistory(): Promise<void> {
        if (!this.config.enableHistory) return;

        const historyFile = join(this.storagePath, "history.json");

        try {
            await fs.writeFile(historyFile, JSON.stringify(this.history, null, 2), "utf-8");
        } catch (error) {
            console.error("[WenchangService] Failed to save history:", error);
        }
    }

    private createDefaultPreferences(): UserPreferences {
        return {
            revision: 1,
            ui: {
                theme: "dark", // 与preference store保持一致
                layout: "grid",
                language: "zh-CN",
                sidebarWidth: 280,
                zoomLevel: 1.0,
            },
            display: {
                thumbnailSize: 150, // 与preference store保持一致
                sortOrder: "date",
                groupBy: "date",
                showHidden: false,
                showMetadata: true,
            },
            scanning: {
                autoScan: true,
                excludePatterns: [".DS_Store", "Thumbs.db", "*.tmp"],
                concurrency: 4,
                watchEnabled: true,
            },
            performance: {
                maxCacheSize: 500,
                preloadCount: 20,
                enableGpuAcceleration: true,
            },
            lastModified: Date.now(),
        };
    }

    private applyDeltaToData(data: UserPreferences, delta: PreferenceDelta): UserPreferences {
        const newData = JSON.parse(JSON.stringify(data)); // 深拷贝

        // 解析路径并设置值
        const pathParts = delta.path.split(".");
        let current = newData;

        for (let i = 0; i < pathParts.length - 1; i++) {
            current = current[pathParts[i]];
        }

        current[pathParts[pathParts.length - 1]] = delta.value;
        newData.lastModified = Date.now();

        return newData;
    }

    private mergePreferences(
        base: UserPreferences,
        partial: Partial<UserPreferences>,
    ): UserPreferences {
        return {
            ...base,
            ...partial,
            ui: { ...base.ui, ...(partial.ui || {}) },
            display: { ...base.display, ...(partial.display || {}) },
            scanning: { ...base.scanning, ...(partial.scanning || {}) },
            performance: { ...base.performance, ...(partial.performance || {}) },
            lastModified: Date.now(),
        };
    }

    private addToHistory(historyEntry: PreferenceHistory): void {
        this.history.push(historyEntry);

        // 限制历史记录大小
        if (this.history.length > this.config.maxHistorySize) {
            this.history = this.history.slice(-this.config.maxHistorySize);
        }

        // 异步保存历史
        this.saveHistory().catch((error) => {
            console.error("[WenchangService] Failed to save history:", error);
        });
    }
}
