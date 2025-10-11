# RFC 0019: Auto-Update System - Client Implementation

- **Start Date**: 2025-09-14
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)

## Summary

专注于Photasa桌面应用的客户端自动更新系统实现。采用标准的electron-updater方案，通过服务端URL重写代理解决UploadThing CDN兼容性问题。遵循现有Service架构模式，提供安全的preload集成、完整的UI组件，以及与现有系统的无缝集成。服务器端实现将在RFC 0020中详细说明。

**技术架构**：客户端使用标准electron-updater配置文件驱动，服务端负责URL重写和文件代理，确保文件名安全性和下载兼容性。这种架构保持了客户端的简洁性，同时在服务端统一解决技术问题。

## Motivation

### Why are we doing this?

1. **用户体验优化**：自动更新减少用户手动下载安装的繁琐步骤，提升用户体验
2. **安全性保障**：及时推送安全补丁和bug修复，保障用户数据安全
3. **功能迭代速度**：快速推送新功能和改进，提升产品竞争力
4. **维护成本降低**：减少因版本碎片化导致的技术支持成本
5. **行业标准实践**：现代桌面应用的标准功能，用户期望具备

### Why Server-Side URL Rewrite Approach?

#### 技术问题根源

**问题描述**：UploadThing CDN生成的文件URL包含冒号字符（`https://utfs.io/f/xxx`），导致electron-updater下载时创建包含冒号的临时文件路径，在Windows和macOS系统中被禁止。

**具体错误**：

```
ENOENT: no such file or directory, open '/Users/user/Library/Caches/photasa-updater/pending/temp-https:/utfs.io/f/4CQT2JNmMDi7rIPLymJ7eFcKahD59BWAr2PpX3f4NuI6jUYH'
```

#### 服务端代理方案的优势

**为什么选择服务端解决**：

1. **客户端零修改**：electron-updater使用标准流程，无需自定义下载逻辑
2. **架构简洁**：问题在服务端统一解决，客户端保持简单
3. **向后兼容**：未来可以轻松切换到其他CDN服务
4. **统计友好**：所有下载都经过服务端，便于统计分析
5. **缓存控制**：可以添加CDN缓存策略和访问控制

#### electron-updater 标准用法保持

**保留所有electron-updater优势**：

1. **成熟的版本比较逻辑**：支持语义化版本比较（semver）、预发布版本处理
2. **完整的更新检查机制**：自动平台检测、latest.yml格式解析、内置重试机制
3. **标准的UpdateInfo结构**：行业标准数据格式、SHA512校验、灰度发布支持
4. **完整的事件系统**：生命周期事件、与现有代码高度集成

### Use cases it supports:

- **静默更新**：用户可选择自动下载并安装更新
- **提醒更新**：检测到新版本时提醒用户，由用户决定是否更新
- **强制更新**：针对关键安全补丁的强制更新机制
- **增量更新**：支持差量更新以减少下载时间和带宽消耗
- **回滚机制**：更新失败时的安全回滚
- **更新历史**：记录更新历史和版本变更记录

### Expected outcome:

- 95% 的用户能够在新版本发布后 7 天内自动更新到最新版本
- 更新过程用户感知度低，不影响正常使用流程
- 支持 Windows 和 macOS 平台的原生更新体验
- 更新失败率控制在 1% 以下

## Detailed Design

### Architecture Overview (Following Existing Pattern)

```
┌─────────────────────────────────────────────────────────────────────┐
│                PHOTASA STANDARD ELECTRON-UPDATER ARCHITECTURE       │
├─────────────────────────────────────────────────────────────────────┤
│  Main Process (Node.js)                                             │
│  ┌─────────────────┐    ┌──────────────────┐                       │
│  │ UpdateService   │    │ IPC Handlers     │                       │
│  │ - electron-     │    │ - picasa:check-  │                       │
│  │   updater 标准  │◄───┤   for-updates    │                       │
│  │ - 标准检查       │    │ - picasa:download│                       │
│  │ - 标准下载安装   │    │ - picasa:install │                       │
│  └─────────────────┘    └──────────────────┘                       │
│                                   ↕                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Preload Script (src/preload/index.ts)                              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ import { electronAPI } from "@electron-toolkit/preload";        │ │
│  │                                                                 │ │
│  │ const api = {                                                   │ │
│  │   // ... 现有 API ...                                           │ │
│  │   checkForUpdates: () => electronAPI.ipcRenderer.invoke(...),   │ │
│  │   onUpdateAvailable: (cb) => electronAPI.ipcRenderer.on(...),   │ │
│  │   removeUpdateListeners: () => electronAPI.ipcRenderer.remove   │ │
│  │ };                                                              │ │
│  │                                                                 │ │
│  │ contextBridge.exposeInMainWorld("api", api);                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                   ↕                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Renderer Process (Vue 3 + TypeScript)                              │
│  ┌─────────────────┐    ┌──────────────────┐                       │
│  │ Vue Components  │    │ Pinia Store      │                       │
│  │ - UpdateDialog  │◄───┤ - useUpdateStore │                       │
│  │ - ProgressBar   │    │ - window.api.*   │                       │
│  │ - Settings      │    │ - reactive state │                       │
│  └─────────────────┘    └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
                                   ↕
┌─────────────────────────────────────────────────────────────────────┐
│  External Update Server (photasa.me)                                │
│  ┌─────────────────┐    ┌──────────────────┐                       │
│  │ Next.js API     │    │ Update Assets    │                       │
│  │ - latest.yml    │    │ - .zip files     │                       │
│  │ - URL rewrite   │    │ - checksums      │                       │
│  │ - Supabase logs │    │ - file storage   │                       │
│  └─────────────────┘    └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

**现有模式特点**:

- ✅ 使用 `@electron-toolkit/preload` 库
- ✅ 统一的 `window.api.*` 调用方式
- ✅ 返回清理函数的事件监听模式
- ✅ `removeXxxListeners()` 批量清理方法

### UpdateInfo 数据结构说明

在标准electron-updater方案中，UpdateInfo是核心的数据结构，包含了版本检查和下载所需的所有信息。服务端通过URL重写确保客户端接收到安全的文件路径。

#### UpdateInfo 结构解析

```typescript
interface UpdateInfo {
    version: string; // 新版本号，如 "1.6.0-alpha"
    files: Array<{
        // 文件信息数组，通常包含不同平台的文件
        url: string; // 下载URL（原始，可能包含冒号问题）
        sha512: string; // SHA512校验值
        size: number; // 文件大小（字节）
        ext?: string; // 文件扩展名
    }>;
    releaseDate: string; // 发布时间
    stagingPercentage?: number; // 灰度发布百分比
    releaseName?: string; // 发布名称
    releaseNotes?: string; // 发布说明
}
```

#### 关键字段说明

1. **version**: 新版本的版本号
    - 格式：遵循语义化版本（semver），如 "1.6.0", "1.6.0-alpha", "1.6.0-beta.1"
    - 用途：版本比较判断是否需要更新

2. **files**: 下载文件信息数组
    - 通常第一个文件是主要的安装包
    - **服务端处理**：`url` 字段由服务端生成，使用安全的文件名如 `"Photasa-1.6.0-win.zip"`
    - **路径安全**：避免冒号等特殊字符，确保跨平台兼容性

3. **sha512**: 文件完整性校验
    - 格式：SHA512哈希值的十六进制字符串
    - 用途：确保下载文件未被篡改

4. **size**: 文件大小
    - 单位：字节
    - 用途：显示下载进度、检查磁盘空间

#### 技术实现策略

**URL重写流程**：

```
1. 服务端生成latest.yml，使用安全文件名：
   url: "Photasa-1.6.0-win.zip"  // 而非 UploadThing URL

2. electron-updater请求：
   GET /api/updates/releases/Photasa-1.6.0-win.zip

3. 服务端代理重定向到实际 UploadThing URL
   ↓
4. electron-updater 标准流程：下载、校验、安装
```

**关键优势**：

- 客户端看到的始终是安全的文件名
- 服务端负责URL映射和代理
- 保持electron-updater的标准行为

### Update Server Integration

客户端UpdateService通过配置的更新服务器URL获取版本信息和下载文件。服务器端的详细实现和架构选择将在RFC 0020中详细说明。

#### 更新服务器接口约定

客户端UpdateService需要与更新服务器进行交互，主要接口包括：

**版本检查接口**：

- 端点：`/api/updates/releases/latest.yml` (Windows) 或 `/api/updates/releases/latest-mac.yml` (macOS)
- 返回：符合electron-updater格式的YAML配置
- 包含：版本号、下载URL、文件哈希、发布日期等

**文件下载接口**：

- 支持直接下载或统计重定向
- 自动平台检测和文件选择
- 下载进度支持

**配置示例**：

```yaml
# electron-updater 配置 (dev-app-update.yml 开发环境)
provider: generic
url: https://photasa.me/api/updates/releases
updaterCacheDirName: photasa-updater
# 生产环境配置由 electron-builder.yml 中的 publish 配置自动生成
```

> **注意**：服务器端的详细实现架构、API设计、数据库结构等将在RFC 0020中完整定义。

### Core Components

#### 1. UpdateService (Following Service Pattern)

```typescript
// src/main/update/update-service.ts
import { BrowserWindow, app, shell, type IpcMain } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import { createHash } from "crypto";
import { createWriteStream } from "fs";
import { mkdir, unlink, access, readFile } from "fs/promises";
import { join } from "path";
import { loggers } from "@common/logger";
import type { AutoUpdateConfig } from "@common/update-types";

const logger = loggers.update;

/**
 * 标准更新服务
 * 使用electron-updater标准流程，配合服务端URL重写代理
 * 解决UploadThing CDN兼容性问题
 */
export default class UpdateService {
    private config: AutoUpdateConfig | null = null;

    constructor(
        private ipcMain: IpcMain,
        private mainWindow: BrowserWindow,
    ) {
        this.initElectronUpdater();
        this.registerIpcHandlers();
        logger.info("[UpdateService] 标准更新服务已初始化");
    }

    private initElectronUpdater() {
        // 配置electron-updater - 使用配置文件驱动，不调用setFeedURL
        // 开发环境：自动读取 dev-app-update.yml
        // 生产环境：自动读取内嵌的 app-update.yml (由 electron-builder.yml 生成)

        // 配置行为选项
        autoUpdater.autoDownload = false;  // 可选：禁用自动下载
        autoUpdater.autoInstallOnAppQuit = false;  // 可选：禁用退出时自动安装

        // 监听electron-updater事件
        this.setupElectronUpdaterEvents();
    }

    private setupElectronUpdaterEvents() {
        autoUpdater.on("checking-for-update", () => {
            logger.info("正在检查更新...");
            this.sendToRenderer("picasa:update-checking");
        });

        autoUpdater.on("update-available", (info: UpdateInfo) => {
            logger.info("发现新版本:", info.version);
            this.sendToRenderer("picasa:update-available", {
                version: info.version,
                info: info,
            });
        });

        autoUpdater.on("update-not-available", () => {
            logger.info("当前已是最新版本");
            this.sendToRenderer("picasa:update-not-available");
        });

        autoUpdater.on("error", (error) => {
            logger.error("更新检查错误:", String(error));
            this.sendToRenderer("picasa:update-error", `检查更新失败: ${String(error)}`);
        });
    }

    private registerIpcHandlers() {
        this.ipcMain.handle("picasa:check-for-updates", () => this.checkForUpdates());
        this.ipcMain.handle("picasa:download-update", () => this.downloadUpdate());
        this.ipcMain.handle("picasa:install-update", () => this.installUpdate());
        this.ipcMain.handle("picasa:get-app-version", () => app.getVersion());
        this.ipcMain.handle("picasa:update-auto-update-config", (_, config) =>
            this.updateAutoUpdateConfig(config),
        );
    }

    async checkForUpdates(): Promise<{
        hasUpdate: boolean;
        version?: string;
        info?: UpdateInfo;
    }> {
        try {
            logger.info("开始检查更新...");
            const result = await autoUpdater.checkForUpdates();

            if (result && result.updateInfo) {
                return {
                    hasUpdate: true,
                    version: result.updateInfo.version,
                    info: result.updateInfo,
                };
            } else {
                return { hasUpdate: false };
            }
        } catch (error) {
            logger.error("检查更新失败:", String(error));
            throw error;
        }
    }

    async downloadUpdate(): Promise<void> {
        try {
            logger.info("开始下载更新...");
            await autoUpdater.downloadUpdate();
            logger.info("更新下载完成");
        } catch (error) {
            logger.error("下载更新失败:", String(error));
            this.sendToRenderer("picasa:update-error", `下载失败: ${String(error)}`);
            throw error;
        }
    }

    async installUpdate(): Promise<void> {
        try {
            logger.info("开始安装更新并重启应用");
            autoUpdater.quitAndInstall();
        } catch (error) {
            logger.error("安装更新失败:", String(error));
            this.sendToRenderer("picasa:update-error", `安装失败: ${String(error)}`);
            throw error;
        }
    }

    private sendToRenderer(channel: string, data?: any) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }
        });

        // 获取更新配置
        this.ipc.handle("photasa:get-update-config", async () => {
            return await this.getConfig();
        });

        // 设置更新配置
        this.ipc.handle("photasa:set-update-config", async (_, config) => {
            return await this.setConfig(config);
        });

        // 跳过特定版本
        this.ipc.handle("photasa:skip-version", async (_, version) => {
            return await this.skipVersion(version);
        });

        // 获取当前应用版本
        this.ipc.handle("photasa:get-app-version", async () => {
            return process.env.npm_package_version || "unknown";
        });

        // 网络连接检查
        this.ipc.handle("photasa:check-network", async () => {
            return await this.checkNetworkConnectivity();
        });

        // 磁盘空间检查
        this.ipc.handle("photasa:check-disk-space", async () => {
            return await this.checkDiskSpace();
        });

        // 带重试的更新检查
        this.ipc.handle("photasa:check-for-updates-retry", async (_, maxRetries, retryDelay) => {
            return await this.checkForUpdatesWithRetry(maxRetries, retryDelay);
        });

        // 带重试的更新下载
        this.ipc.handle("photasa:download-update-retry", async (_, maxRetries, retryDelay) => {
            return await this.downloadUpdateWithRetry(maxRetries, retryDelay);
        });
    }

    /**
     * 向渲染进程发送消息
     */
    private sendToRenderer(channel: string, data?: any): void {
        this.mainWindow?.webContents.send(channel, data);
    }

    async initialize(): Promise<void> {
        // 从配置获取更新偏好设置
        const updateConfig = await this.getConfig();

        if (updateConfig.autoCheck) {
            await this.checkForUpdates();

            // 设置定期检查
            if (updateConfig.checkInterval > 0) {
                this.scheduleUpdateCheck(updateConfig.checkInterval);
            }
        }
    }

    async checkForUpdates(): Promise<UpdateInfo | null> {
        try {
            this.logger.info("开始检查更新...");
            const result = await this.updater.checkForUpdates();
            this.logger.info("更新检查完成");
            return result;
        } catch (error) {
            const errorInfo = this.handleUpdateError(error, "check");
            this.sendToRenderer("photasa:update-error", errorInfo);
            throw errorInfo;
        }
    }

    async downloadUpdate(): Promise<void> {
        try {
            this.logger.info("开始下载更新...");
            await this.updater.downloadUpdate();
            this.logger.info("更新下载完成");
        } catch (error) {
            const errorInfo = this.handleUpdateError(error, "download");
            this.sendToRenderer("photasa:update-error", errorInfo);
            throw errorInfo;
        }
    }

    async installUpdate(): Promise<void> {
        // 提示用户即将重启应用
        const response = await dialog.showMessageBox(this.mainWindow!, {
            type: "info",
            title: "安装更新",
            message: "更新将在应用重启后生效，是否立即重启？",
            buttons: ["立即重启", "稍后重启"],
            defaultId: 0,
        });

        if (response.response === 0) {
            this.updater.quitAndInstall();
        }
    }

    private scheduleUpdateCheck(intervalHours: number): void {
        const intervalMs = intervalHours * 60 * 60 * 1000;

        this.checkInterval = setInterval(() => {
            this.checkForUpdates().catch((error) => {
                logger.error("定期更新检查失败:", error);
            });
        }, intervalMs);
    }

    private sendToRenderer(channel: string, ...args: any[]): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, ...args);
        }
    }

    setAutoUpdateEnabled(enabled: boolean): void {
        this.updater.autoDownload = enabled;
    }

    /**
     * 获取更新配置 - 通过IPC从渲染进程获取
     * 注意：这个方法会通过IPC调用渲染进程的preference store
     */
    async getConfig(): Promise<UpdateConfig> {
        // 发送IPC请求到渲染进程获取配置
        // 渲染进程会从preference store返回配置
        return {
            autoCheck: true,
            checkInterval: 24,
            channel: "stable",
            autoDownload: false,
            installOnQuit: true,
            skippedVersions: [],
            lastCheckTime: undefined,
        };
    }

    /**
     * 设置更新配置 - 通过IPC保存到渲染进程
     * 注意：这个方法会通过IPC调用渲染进程的preference store
     */
    async setConfig(config: UpdateConfig): Promise<void> {
        // 发送IPC请求到渲染进程保存配置
        // 配置会保存到preference store并持久化

        // 重新配置更新行为
        this.updater.autoDownload = config.autoDownload || false;
        this.updater.autoInstallOnAppQuit = config.installOnQuit || true;

        // 重新设置检查间隔
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        if (config.autoCheck && config.checkInterval > 0) {
            this.scheduleUpdateCheck(config.checkInterval);
        }
    }

    /**
     * 跳过特定版本更新
     */
    async skipVersion(version: string): Promise<void> {
        const config = await this.getConfig();
        config.skippedVersions = config.skippedVersions || [];
        if (!config.skippedVersions.includes(version)) {
            config.skippedVersions.push(version);
            await this.setConfig(config);
        }
    }

    destroy(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }

    /**
     * 统一的错误处理方法
     */
    private handleUpdateError(
        error: any,
        operation: "check" | "download" | "install",
    ): UpdateError {
        this.logger.error(`更新${operation}操作失败:`, error);

        let errorType: UpdateErrorType;
        let userMessage: string;
        let recoverable = false;
        let retryable = false;

        // 根据错误类型进行分类处理
        if (error.code) {
            switch (error.code) {
                case "ENOTFOUND":
                case "ECONNREFUSED":
                case "ETIMEDOUT":
                    errorType = UpdateErrorType.NETWORK_ERROR;
                    userMessage = "网络连接失败，请检查网络设置";
                    retryable = true;
                    break;

                case "CERT_HAS_EXPIRED":
                case "CERT_UNTRUSTED":
                    errorType = UpdateErrorType.CERTIFICATE_ERROR;
                    userMessage = "服务器证书验证失败，请联系技术支持";
                    retryable = false;
                    break;

                case "ENOSPC":
                    errorType = UpdateErrorType.DISK_SPACE_ERROR;
                    userMessage = "磁盘空间不足，请清理磁盘空间后重试";
                    retryable = true;
                    break;

                case "EACCES":
                case "EPERM":
                    errorType = UpdateErrorType.PERMISSION_ERROR;
                    userMessage = "权限不足，请以管理员身份运行";
                    retryable = false;
                    break;

                case "ERR_UPDATER_INVALID_RELEASE_FEED":
                    errorType = UpdateErrorType.INVALID_RESPONSE;
                    userMessage = "服务器返回数据格式错误";
                    retryable = true;
                    break;

                case "ERR_UPDATER_ZIP_FILE_NOT_FOUND":
                case "ERR_UPDATER_CANNOT_FIND_CHANNEL_FILE":
                    errorType = UpdateErrorType.FILE_NOT_FOUND;
                    userMessage = "更新文件不存在或已被删除";
                    retryable = true;
                    break;

                case "ERR_UPDATER_SHA2_VALIDATION_FAILED":
                    errorType = UpdateErrorType.CHECKSUM_MISMATCH;
                    userMessage = "文件完整性校验失败，可能文件已损坏";
                    retryable = true;
                    break;

                default:
                    errorType = UpdateErrorType.UNKNOWN_ERROR;
                    userMessage = `更新失败: ${error.message || "未知错误"}`;
                    retryable = true;
            }
        } else if (error.message) {
            // 处理一般错误消息
            if (error.message.includes("network") || error.message.includes("timeout")) {
                errorType = UpdateErrorType.NETWORK_ERROR;
                userMessage = "网络连接超时，请稍后重试";
                retryable = true;
            } else if (error.message.includes("space")) {
                errorType = UpdateErrorType.DISK_SPACE_ERROR;
                userMessage = "磁盘空间不足";
                retryable = true;
            } else {
                errorType = UpdateErrorType.UNKNOWN_ERROR;
                userMessage = error.message;
                retryable = true;
            }
        } else {
            errorType = UpdateErrorType.UNKNOWN_ERROR;
            userMessage = "更新过程中发生未知错误";
            retryable = true;
        }

        // 确定是否可恢复
        recoverable =
            retryable &&
            ![UpdateErrorType.PERMISSION_ERROR, UpdateErrorType.CERTIFICATE_ERROR].includes(
                errorType,
            );

        return {
            type: errorType,
            message: userMessage,
            originalError: error,
            operation,
            timestamp: new Date(),
            recoverable,
            retryable,
        };
    }

    /**
     * 带重试机制的更新检查
     */
    async checkForUpdatesWithRetry(maxRetries = 3, retryDelay = 5000): Promise<UpdateInfo | null> {
        let lastError: UpdateError | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.info(`更新检查尝试 ${attempt}/${maxRetries}`);
                return await this.checkForUpdates();
            } catch (error) {
                lastError = error as UpdateError;

                if (!lastError.retryable || attempt === maxRetries) {
                    throw lastError;
                }

                this.logger.warn(
                    `更新检查失败，${retryDelay}ms后重试 (${attempt}/${maxRetries}):`,
                    lastError.message,
                );
                this.sendToRenderer("photasa:update-retry", {
                    attempt,
                    maxRetries,
                    delay: retryDelay,
                    error: lastError,
                });

                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                retryDelay *= 1.5; // 指数退避
            }
        }

        throw lastError;
    }

    /**
     * 带重试机制的文件下载
     */
    async downloadUpdateWithRetry(maxRetries = 3, retryDelay = 10000): Promise<void> {
        let lastError: UpdateError | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.info(`更新下载尝试 ${attempt}/${maxRetries}`);
                await this.downloadUpdate();
                return;
            } catch (error) {
                lastError = error as UpdateError;

                if (!lastError.retryable || attempt === maxRetries) {
                    throw lastError;
                }

                this.logger.warn(
                    `更新下载失败，${retryDelay}ms后重试 (${attempt}/${maxRetries}):`,
                    lastError.message,
                );
                this.sendToRenderer("photasa:update-retry", {
                    attempt,
                    maxRetries,
                    delay: retryDelay,
                    error: lastError,
                });

                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                retryDelay *= 1.5; // 指数退避
            }
        }

        throw lastError;
    }

    /**
     * 网络连接检查
     */
    async checkNetworkConnectivity(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch("https://photasa.me/api/health", {
                method: "HEAD",
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            this.logger.warn("网络连接检查失败:", error);
            return false;
        }
    }

    /**
     * 获取磁盘可用空间 (简化实现，实际需要调用系统API)
     */
    async checkDiskSpace(): Promise<{ available: number; required: number; sufficient: boolean }> {
        // 这里需要调用系统API获取实际磁盘空间
        // 为了演示，返回模拟数据
        const available = 1024 * 1024 * 1024 * 2; // 2GB
        const required = 1024 * 1024 * 500; // 500MB

        return {
            available,
            required,
            sufficient: available > required,
        };
    }
}
```

### Error Handling Architecture

#### 错误处理流程图

```
更新操作开始
     ↓
  执行操作
     ↓
   成功？ ──是──→ 发送成功事件
     ↓否
  分析错误类型
     ↓
  可重试？ ──是──→ 执行重试逻辑 ──→ 重试次数用完？ ──否──→ 返回执行操作
     ↓否                                ↓是
  发送错误事件                          发送最终错误事件
     ↓                                 ↓
  显示错误UI                           显示错误UI（含重试选项）
     ↓
  用户选择处理方式
     ↓
  忽略/重试/稍后提醒
```

#### 错误处理策略

1. **网络错误**: 自动重试3次，指数退避延迟
2. **文件损坏**: 重新下载，最多重试2次
3. **磁盘空间不足**: 提示清理空间，暂停下载
4. **权限错误**: 提示以管理员身份重新启动
5. **证书错误**: 记录详细日志，联系技术支持

#### 2. Update Error Dialog Component

```vue
<!-- src/renderer/src/components/dialogs/UpdateErrorDialog.vue -->
<template>
    <BaseDialog
        v-model:open="isOpen"
        :title="$t('update.error.title')"
        :closable="!isCriticalError"
        max-width="500px"
    >
        <div class="space-y-4">
            <!-- 错误图标和类型 -->
            <div class="flex items-center space-x-3">
                <div class="flex-shrink-0">
                    <component
                        :is="getErrorIcon(error?.type)"
                        class="w-10 h-10"
                        :class="getErrorIconClass(error?.type)"
                    />
                </div>
                <div>
                    <h3 class="text-lg font-medium text-[var(--color-text)]">
                        {{ getErrorTitle(error?.type) }}
                    </h3>
                    <p class="text-sm text-[var(--color-text-secondary)]">
                        {{ formatTimestamp(error?.timestamp) }}
                    </p>
                </div>
            </div>

            <!-- 错误描述 -->
            <div class="bg-[var(--color-card)] rounded-lg p-4">
                <p class="text-[var(--color-text)]">
                    {{ error?.message }}
                </p>

                <!-- 重试信息 -->
                <div v-if="retryInfo" class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-blue-700 dark:text-blue-300">
                            {{
                                $t("update.retry.inProgress", {
                                    attempt: retryInfo.attempt,
                                    max: retryInfo.maxRetries,
                                })
                            }}
                        </span>
                        <div class="flex items-center space-x-2">
                            <div
                                class="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
                            ></div>
                            <span class="text-xs text-blue-600 dark:text-blue-400">
                                {{
                                    $t("update.retry.nextAttempt", {
                                        seconds: Math.ceil(retryCountdown / 1000),
                                    })
                                }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 解决建议 -->
            <div v-if="getSolutions(error?.type).length > 0">
                <h4 class="font-medium mb-2 text-[var(--color-text)]">
                    {{ $t("update.error.solutions") }}
                </h4>
                <ul class="space-y-1 text-sm text-[var(--color-text-secondary)]">
                    <li
                        v-for="solution in getSolutions(error?.type)"
                        :key="solution"
                        class="flex items-start space-x-2"
                    >
                        <span class="text-blue-500 mt-0.5">•</span>
                        <span>{{ solution }}</span>
                    </li>
                </ul>
            </div>

            <!-- 技术详情 (可展开) -->
            <details v-if="showTechnicalDetails" class="text-xs">
                <summary
                    class="cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                    {{ $t("update.error.technicalDetails") }}
                </summary>
                <div class="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto">
                    <pre class="whitespace-pre-wrap">{{
                        JSON.stringify(error?.originalError, null, 2)
                    }}</pre>
                </div>
            </details>
        </div>

        <template #footer>
            <div class="flex justify-between items-center">
                <!-- 左侧选项 -->
                <div class="flex space-x-2">
                    <BaseButton
                        v-if="error?.retryable && !retryInfo"
                        @click="retryOperation"
                        variant="outline"
                        size="sm"
                    >
                        {{ $t("update.error.retry") }}
                    </BaseButton>

                    <BaseButton
                        v-if="canCheckConnectivity"
                        @click="checkConnectivity"
                        variant="ghost"
                        size="sm"
                        :loading="isCheckingConnectivity"
                    >
                        {{ $t("update.error.checkNetwork") }}
                    </BaseButton>
                </div>

                <!-- 右侧主要操作 -->
                <div class="flex space-x-2">
                    <BaseButton v-if="!isCriticalError" @click="skipForNow" variant="ghost">
                        {{ $t("update.error.skipForNow") }}
                    </BaseButton>

                    <BaseButton v-if="canReportError" @click="reportError" variant="outline">
                        {{ $t("update.error.reportIssue") }}
                    </BaseButton>

                    <BaseButton
                        @click="closeDialog"
                        :variant="isCriticalError ? 'primary' : 'ghost'"
                    >
                        {{ $t(isCriticalError ? "common.ok" : "common.close") }}
                    </BaseButton>
                </div>
            </div>
        </template>
    </BaseDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { PhWifiX, PhWarning, PhX, PhShield, PhHardDrives, PhNetwork } from "@phosphor-icons/vue";

interface UpdateError {
    type: string;
    message: string;
    originalError: any;
    operation: "check" | "download" | "install";
    timestamp: Date;
    recoverable: boolean;
    retryable: boolean;
}

interface RetryInfo {
    attempt: number;
    maxRetries: number;
    delay: number;
    error: UpdateError;
}

const props = defineProps<{
    error: UpdateError | null;
    retryInfo?: RetryInfo | null;
    showTechnicalDetails?: boolean;
}>();

const emit = defineEmits<{
    retry: [];
    skip: [];
    report: [error: UpdateError];
    close: [];
}>();

const { t } = useI18n();

const isOpen = computed(() => !!props.error);
const retryCountdown = ref(0);
const isCheckingConnectivity = ref(false);
let countdownTimer: NodeJS.Timeout | null = null;

// 错误类型图标映射
const getErrorIcon = (type: string) => {
    switch (type) {
        case "NETWORK_ERROR":
        case "TIMEOUT_ERROR":
            return PhWifiX;
        case "CERTIFICATE_ERROR":
            return PhShield;
        case "DISK_SPACE_ERROR":
            return PhHardDrives;
        case "PERMISSION_ERROR":
            return PhWarning;
        default:
            return PhX;
    }
};

const getErrorIconClass = (type: string) => {
    switch (type) {
        case "NETWORK_ERROR":
        case "TIMEOUT_ERROR":
            return "text-orange-500";
        case "CERTIFICATE_ERROR":
        case "PERMISSION_ERROR":
            return "text-red-500";
        case "DISK_SPACE_ERROR":
            return "text-yellow-500";
        default:
            return "text-gray-500";
    }
};

// 获取错误标题
const getErrorTitle = (type: string) => {
    return t(`update.error.types.${type}`, t("update.error.types.UNKNOWN_ERROR"));
};

// 获取解决方案
const getSolutions = (type: string): string[] => {
    const solutions: Record<string, string[]> = {
        NETWORK_ERROR: [
            t("update.error.solutions.checkConnection"),
            t("update.error.solutions.checkFirewall"),
            t("update.error.solutions.tryLater"),
        ],
        DISK_SPACE_ERROR: [
            t("update.error.solutions.freeSpace"),
            t("update.error.solutions.changeLocation"),
        ],
        PERMISSION_ERROR: [
            t("update.error.solutions.runAsAdmin"),
            t("update.error.solutions.checkPermissions"),
        ],
        CERTIFICATE_ERROR: [
            t("update.error.solutions.contactSupport"),
            t("update.error.solutions.checkSystemTime"),
        ],
    };

    return solutions[type] || [];
};

// 是否为关键错误（不能忽略）
const isCriticalError = computed(() => {
    return props.error?.type === "CERTIFICATE_ERROR" || props.error?.type === "PERMISSION_ERROR";
});

// 是否可以检查网络连接
const canCheckConnectivity = computed(() => {
    return props.error?.type === "NETWORK_ERROR" || props.error?.type === "TIMEOUT_ERROR";
});

// 是否可以报告错误
const canReportError = computed(() => {
    return !["NETWORK_ERROR", "DISK_SPACE_ERROR"].includes(props.error?.type || "");
});

// 格式化时间戳
const formatTimestamp = (timestamp: Date | undefined) => {
    if (!timestamp) return "";
    return new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(timestamp);
};

// 重试倒计时
watch(
    () => props.retryInfo,
    (newRetryInfo) => {
        if (countdownTimer) {
            clearInterval(countdownTimer);
        }

        if (newRetryInfo) {
            retryCountdown.value = newRetryInfo.delay;
            countdownTimer = setInterval(() => {
                retryCountdown.value -= 1000;
                if (retryCountdown.value <= 0 && countdownTimer) {
                    clearInterval(countdownTimer);
                    countdownTimer = null;
                }
            }, 1000);
        }
    },
    { immediate: true },
);

// 操作方法
const retryOperation = () => {
    emit("retry");
};

const skipForNow = () => {
    emit("skip");
};

const reportError = () => {
    if (props.error) {
        emit("report", props.error);
    }
};

const closeDialog = () => {
    emit("close");
};

const checkConnectivity = async () => {
    isCheckingConnectivity.value = true;
    try {
        const isConnected = await window.api.checkNetworkConnectivity();
        if (isConnected) {
            // 网络正常，建议重试
            retryOperation();
        } else {
            // 网络异常，显示网络故障提示
            console.log("网络连接异常");
        }
    } finally {
        isCheckingConnectivity.value = false;
    }
};

onUnmounted(() => {
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }
});
</script>
```

#### 3. Update Notification Dialog (Enhanced with Error Handling)

```vue
<!-- src/renderer/src/components/dialogs/UpdateNotificationDialog.vue -->
<template>
    <BaseDialog
        v-model:open="isOpen"
        :title="$t('update.newVersionAvailable')"
        :closable="!isForced"
    >
        <div class="space-y-4">
            <div class="flex items-center space-x-3">
                <div class="flex-shrink-0">
                    <PhDownload class="w-8 h-8 text-[var(--color-primary)]" />
                </div>
                <div>
                    <h3 class="text-lg font-medium text-[var(--color-text)]">
                        {{ $t("update.version") }} {{ updateInfo.version }}
                    </h3>
                    <p class="text-sm text-[var(--color-text-secondary)]">
                        {{ formatDate(updateInfo.releaseDate) }}
                    </p>
                </div>
            </div>

            <div class="bg-[var(--color-card)] rounded-lg p-4">
                <h4 class="font-medium mb-2 text-[var(--color-text)]">
                    {{ $t("update.whatsNew") }}
                </h4>
                <div class="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {{ updateInfo.releaseNotes || $t("update.noReleaseNotes") }}
                </div>
            </div>

            <div class="flex items-center space-x-2 text-sm text-[var(--color-text-secondary)]">
                <PhInfo class="w-4 h-4" />
                <span>{{
                    $t("update.downloadSize", { size: formatFileSize(updateInfo.size) })
                }}</span>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-between items-center">
                <BaseCheckbox
                    v-if="!isForced"
                    v-model="rememberChoice"
                    :label="$t('update.rememberChoice')"
                />
                <div class="flex space-x-2">
                    <BaseButton v-if="!isForced" @click="skipUpdate" variant="ghost">
                        {{ $t("update.skipVersion") }}
                    </BaseButton>
                    <BaseButton @click="downloadUpdate" variant="primary" :loading="isDownloading">
                        {{
                            isDownloading
                                ? $t("update.downloading")
                                : $t("update.downloadAndInstall")
                        }}
                    </BaseButton>
                </div>
            </div>
        </template>
    </BaseDialog>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { PhDownload, PhInfo } from "@phosphor-icons/vue";
import { useUpdateStore } from "@/stores/update";
import { useI18n } from "vue-i18n";
import { formatDate, formatFileSize } from "@/utils/format";

interface UpdateInfo {
    version: string;
    releaseDate: string;
    releaseNotes?: string;
    size: number;
    downloadUrl: string;
}

const props = defineProps<{
    updateInfo: UpdateInfo;
    isForced?: boolean;
}>();

const { t } = useI18n();
const updateStore = useUpdateStore();

const isOpen = ref(true);
const rememberChoice = ref(false);
const isDownloading = computed(() => updateStore.isDownloading);

const downloadUpdate = async () => {
    try {
        await updateStore.downloadUpdate();
    } catch (error) {
        console.error("下载更新失败:", error);
    }
};

const skipUpdate = () => {
    if (rememberChoice.value) {
        updateStore.skipVersion(props.updateInfo.version);
    }
    isOpen.value = false;
};
</script>
```

```vue
<!-- src/renderer/src/components/dialogs/UpdateProgressDialog.vue -->
<template>
    <BaseDialog v-model:open="isOpen" :title="$t('update.downloading')" :closable="false">
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <span class="text-sm text-[var(--color-text-secondary)]">
                    {{ $t("update.downloadingVersion", { version: version }) }}
                </span>
                <span class="text-sm font-medium text-[var(--color-text)]">
                    {{ Math.round(progress.percent) }}%
                </span>
            </div>

            <BaseProgressBar :value="progress.percent" />

            <div class="flex justify-between text-xs text-[var(--color-text-secondary)]">
                <span
                    >{{ formatFileSize(progress.transferred) }} /
                    {{ formatFileSize(progress.total) }}</span
                >
                <span>{{ formatSpeed(progress.bytesPerSecond) }}</span>
            </div>

            <div class="text-center">
                <p class="text-sm text-[var(--color-text-secondary)]">
                    {{ $t("update.downloadDescription") }}
                </p>
            </div>
        </div>
    </BaseDialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatFileSize } from "@/utils/format";

interface DownloadProgress {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
}

const props = defineProps<{
    version: string;
    progress: DownloadProgress;
}>();

const { t } = useI18n();
const isOpen = ref(true);

const formatSpeed = (bytesPerSecond: number): string => {
    return formatFileSize(bytesPerSecond) + "/s";
};
</script>
```

```vue
<!-- src/renderer/src/components/settings/UpdateSettingsPanel.vue -->
<template>
    <SettingsSection :title="$t('settings.autoUpdate')">
        <div class="space-y-6">
            <!-- 自动更新开关 -->
            <div class="flex items-center justify-between">
                <div>
                    <h4 class="font-medium text-[var(--color-text)]">
                        {{ $t("settings.enableAutoUpdate") }}
                    </h4>
                    <p class="text-sm text-[var(--color-text-secondary)]">
                        {{ $t("settings.autoUpdateDescription") }}
                    </p>
                </div>
                <BaseSwitch v-model="config.autoCheck" @change="saveConfig" />
            </div>

            <!-- 更新频率 -->
            <div v-if="config.autoCheck">
                <label class="block text-sm font-medium text-[var(--color-text)] mb-2">
                    {{ $t("settings.updateFrequency") }}
                </label>
                <BaseSelect
                    v-model="config.checkInterval"
                    :options="intervalOptions"
                    @change="saveConfig"
                />
            </div>

            <!-- 更新通道 -->
            <div>
                <label class="block text-sm font-medium text-[var(--color-text)] mb-2">
                    {{ $t("settings.updateChannel") }}
                </label>
                <BaseRadioGroup
                    v-model="config.channel"
                    :options="channelOptions"
                    @change="saveConfig"
                />
            </div>

            <!-- 下载设置 -->
            <div class="space-y-3">
                <BaseCheckbox
                    v-model="config.autoDownload"
                    :label="$t('settings.autoDownload')"
                    :description="$t('settings.autoDownloadDescription')"
                    @change="saveConfig"
                />
                <BaseCheckbox
                    v-model="config.installOnQuit"
                    :label="$t('settings.installOnQuit')"
                    :description="$t('settings.installOnQuitDescription')"
                    @change="saveConfig"
                />
            </div>

            <!-- 手动检查按钮 -->
            <div class="pt-4 border-t border-[var(--color-border)]">
                <BaseButton @click="checkForUpdates" :loading="isChecking" variant="outline">
                    {{ $t("settings.checkNow") }}
                </BaseButton>
                <p v-if="lastCheckTime" class="mt-2 text-xs text-[var(--color-text-secondary)]">
                    {{ $t("settings.lastChecked", { time: formatDate(lastCheckTime) }) }}
                </p>
            </div>
        </div>
    </SettingsSection>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useUpdateStore } from "@/stores/update";
import { formatDate } from "@/utils/format";

const { t } = useI18n();
const updateStore = useUpdateStore();

const config = ref({
    autoCheck: true,
    checkInterval: 24, // 小时
    channel: "stable",
    autoDownload: false,
    installOnQuit: true,
});

const isChecking = ref(false);
const lastCheckTime = ref<string | null>(null);

const intervalOptions = [
    { value: 1, label: t("settings.everyHour") },
    { value: 6, label: t("settings.every6Hours") },
    { value: 12, label: t("settings.every12Hours") },
    { value: 24, label: t("settings.daily") },
    { value: 168, label: t("settings.weekly") },
];

const channelOptions = [
    { value: "stable", label: t("settings.stable"), description: t("settings.stableDescription") },
    { value: "beta", label: t("settings.beta"), description: t("settings.betaDescription") },
];

const saveConfig = async () => {
    await updateStore.saveUpdateConfig(config.value);
};

const checkForUpdates = async () => {
    isChecking.value = true;
    try {
        await updateStore.checkForUpdates();
        lastCheckTime.value = new Date().toISOString();
    } catch (error) {
        console.error("检查更新失败:", error);
    } finally {
        isChecking.value = false;
    }
};

onMounted(async () => {
    const savedConfig = await updateStore.getUpdateConfig();
    config.value = { ...config.value, ...savedConfig };
    lastCheckTime.value = await updateStore.getLastCheckTime();
});
</script>
```

#### 3. Preload Layer Extension (Following Current Pattern)

````typescript
// src/preload/index.ts 中添加更新相关 API
import { electronAPI } from "@electron-toolkit/preload";

// 在现有 api 对象中添加更新功能
const api = {
  // ... 现有 API ...

  // ========== 更新系统 API ==========
  /**
   * 检查应用更新
   */
  checkForUpdates: () => electronAPI.ipcRenderer.invoke('update:check'),

  /**
   * 下载应用更新
   */
  downloadUpdate: () => electronAPI.ipcRenderer.invoke('update:download'),

  /**
   * 安装应用更新（会重启应用）
   */
  installUpdate: () => electronAPI.ipcRenderer.invoke('update:install'),

  /**
   * 跳过指定版本
   */
  skipVersion: (version: string) => electronAPI.ipcRenderer.invoke('update:skip-version', version),

  /**
   * 获取更新配置
   */
  getUpdateConfig: () => electronAPI.ipcRenderer.invoke('update:get-config'),

  /**
   * 设置更新配置
   */
  setUpdateConfig: (config: any) => electronAPI.ipcRenderer.invoke('update:set-config', config),

  /**
   * 监听更新检查开始事件
   */
  onUpdateChecking: (callback: () => void) => {
    const handler = () => callback();
    electronAPI.ipcRenderer.on('update:checking', handler);
    return () => electronAPI.ipcRenderer.removeListener('update:checking', handler);
  },

  /**
   * 监听更新可用事件
   */
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_: any, info: any) => callback(info);
    electronAPI.ipcRenderer.on('update:available', handler);
    return () => electronAPI.ipcRenderer.removeListener('update:available', handler);
  },

  /**
   * 监听无更新事件
   */
  onUpdateNotAvailable: (callback: () => void) => {
    const handler = () => callback();
    electronAPI.ipcRenderer.on('update:not-available', handler);
    return () => electronAPI.ipcRenderer.removeListener('update:not-available', handler);
  },

  /**
   * 监听下载进度事件
   */
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress);
    electronAPI.ipcRenderer.on('update:download-progress', handler);
    return () => electronAPI.ipcRenderer.removeListener('update:download-progress', handler);
  },

  /**
   * 监听更新下载完成事件
   */
  onUpdateDownloaded: (callback: () => void) => {
    const handler = () => callback();
    electronAPI.ipcRenderer.on('update:downloaded', handler);
    return () => electronAPI.ipcRenderer.removeListener('update:downloaded', handler);
  },

  /**
   * 监听更新错误事件
   */
  onUpdateError: (callback: (error: string) => void) => {
    const handler = (_: any, error: string) => callback(error);
    electronAPI.ipcRenderer.on('update:error', handler);
    return () => electronAPI.ipcRenderer.removeListener('update:error', handler);
  },

  /**
   * 移除所有更新相关的事件监听器
   */
  removeUpdateListeners: () => {
    electronAPI.ipcRenderer.removeAllListeners('update:checking');
    electronAPI.ipcRenderer.removeAllListeners('update:available');
    electronAPI.ipcRenderer.removeAllListeners('update:not-available');
    electronAPI.ipcRenderer.removeAllListeners('update:download-progress');
    electronAPI.ipcRenderer.removeAllListeners('update:downloaded');
    electronAPI.ipcRenderer.removeAllListeners('update:error');
  },
};

#### 4. IPC Handlers (Main Process)

```typescript
// src/main/ipc/update-handlers.ts
import { ipcMain } from 'electron';
import { UpdateManager } from '../services/UpdateManager';

export function registerUpdateHandlers(updateManager: UpdateManager) {
  ipcMain.handle('update:check', async () => {
    return await updateManager.checkForUpdates();
  });

  ipcMain.handle('update:download', async () => {
    return await updateManager.downloadUpdate();
  });

  ipcMain.handle('update:install', async () => {
    return await updateManager.installUpdate();
  });

  ipcMain.handle('update:get-config', async () => {
    return await updateManager.getConfig();
  });

  ipcMain.handle('update:set-config', async (_, config) => {
    return await updateManager.setConfig(config);
  });

  ipcMain.handle('update:skip-version', async (_, version) => {
    return await updateManager.skipVersion(version);
  });
}
````

#### 5. Pinia Store (Renderer Process)

```typescript
// src/renderer/src/stores/update.ts
import { defineStore } from "pinia";
import { ref, computed, onUnmounted } from "vue";

interface UpdateInfo {
    version: string;
    releaseDate: string;
    releaseNotes?: string;
    size: number;
    downloadUrl: string;
}

interface DownloadProgress {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
}

interface UpdateConfig {
    autoCheck: boolean;
    checkInterval: number;
    channel: "stable" | "beta";
    autoDownload: boolean;
    installOnQuit: boolean;
}

export const useUpdateStore = defineStore("update", () => {
    // 状态
    const isChecking = ref(false);
    const isDownloading = ref(false);
    const isUpdateAvailable = ref(false);
    const updateInfo = ref<UpdateInfo | null>(null);
    const downloadProgress = ref<DownloadProgress | null>(null);
    const lastError = ref<string | null>(null);
    const skippedVersions = ref<string[]>([]);

    // 事件清理函数存储
    const eventCleanupFunctions: (() => void)[] = [];

    // 计算属性
    const canUpdate = computed(
        () =>
            isUpdateAvailable.value &&
            updateInfo.value &&
            !skippedVersions.value.includes(updateInfo.value.version),
    );

    // 初始化事件监听（按现有模式通过 window.api）
    const setupEventListeners = () => {
        if (!window.api) {
            console.error("API not available. Make sure preload script is loaded.");
            return;
        }

        // 监听更新状态变化
        eventCleanupFunctions.push(
            window.api.onUpdateChecking(() => {
                isChecking.value = true;
                lastError.value = null;
            }),
        );

        eventCleanupFunctions.push(
            window.api.onUpdateAvailable((info: UpdateInfo) => {
                isChecking.value = false;
                isUpdateAvailable.value = true;
                updateInfo.value = info;
            }),
        );

        eventCleanupFunctions.push(
            window.api.onUpdateNotAvailable(() => {
                isChecking.value = false;
                isUpdateAvailable.value = false;
                updateInfo.value = null;
            }),
        );

        eventCleanupFunctions.push(
            window.api.onUpdateDownloadProgress((progress: DownloadProgress) => {
                downloadProgress.value = progress;
            }),
        );

        eventCleanupFunctions.push(
            window.api.onUpdateDownloaded(() => {
                isDownloading.value = false;
                downloadProgress.value = null;
            }),
        );

        eventCleanupFunctions.push(
            window.api.onUpdateError((error: string) => {
                isChecking.value = false;
                isDownloading.value = false;
                lastError.value = error;
            }),
        );
    };

    // 操作方法（按现有模式通过 window.api）
    const checkForUpdates = async () => {
        try {
            isChecking.value = true;
            const result = await window.api.checkForUpdates();
            return result;
        } catch (error) {
            lastError.value = error instanceof Error ? error.message : String(error);
            throw error;
        }
    };

    const downloadUpdate = async () => {
        try {
            isDownloading.value = true;
            await window.api.downloadUpdate();
        } catch (error) {
            isDownloading.value = false;
            lastError.value = error instanceof Error ? error.message : String(error);
            throw error;
        }
    };

    const installUpdate = async () => {
        try {
            await window.api.installUpdate();
        } catch (error) {
            lastError.value = error instanceof Error ? error.message : String(error);
            throw error;
        }
    };

    const skipVersion = async (version: string) => {
        try {
            await window.api.skipVersion(version);
            skippedVersions.value.push(version);
            isUpdateAvailable.value = false;
            updateInfo.value = null;
        } catch (error) {
            lastError.value = error instanceof Error ? error.message : String(error);
            throw error;
        }
    };

    const getUpdateConfig = async (): Promise<UpdateConfig> => {
        return await window.api.getUpdateConfig();
    };

    const saveUpdateConfig = async (config: UpdateConfig) => {
        await window.api.setUpdateConfig(config);
    };

    const getLastCheckTime = async (): Promise<string | null> => {
        // 从本地存储获取（渲染进程安全）
        return localStorage.getItem("update:lastCheckTime");
    };

    // 清理事件监听
    const cleanup = () => {
        eventCleanupFunctions.forEach((cleanup) => cleanup());
        eventCleanupFunctions.length = 0;
    };

    // 初始化
    setupEventListeners();

    // 组件卸载时清理
    onUnmounted(cleanup);

    return {
        // 状态
        isChecking,
        isDownloading,
        isUpdateAvailable,
        updateInfo,
        downloadProgress,
        lastError,
        skippedVersions,

        // 计算属性
        canUpdate,

        // 方法
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        skipVersion,
        getUpdateConfig,
        saveUpdateConfig,
        getLastCheckTime,
        cleanup, // 手动清理方法
    };
});
```

#### 5. Configuration System

```typescript
// src/main/services/PreferenceManager.ts (扩展更新配置)
interface UpdateConfig {
    autoCheck: boolean;
    checkInterval: number; // 小时
    channel: "stable" | "beta";
    autoDownload: boolean;
    installOnQuit: boolean;
    skippedVersions: string[];
}

export class PreferenceManager {
    // ... 现有方法

    async getUpdateConfig(): Promise<UpdateConfig> {
        return this.preferences.get("update", {
            autoCheck: true,
            checkInterval: 24,
            channel: "stable",
            autoDownload: false,
            installOnQuit: true,
            skippedVersions: [],
        });
    }

    async setUpdateConfig(config: Partial<UpdateConfig>): Promise<void> {
        const current = await this.getUpdateConfig();
        await this.preferences.set("update", { ...current, ...config });
    }
}
```

### Electron 端实施计划

#### Phase 1: 主进程基础设施 (Week 1)

1. **安装和配置 electron-updater**

    ```bash
    npm install electron-updater
    npm install -D @types/node
    ```

2. **UpdateManager 核心实现**
    - 完整的 UpdateManager 类（已在上面详细定义）
    - electron-updater 事件处理
    - 定期更新检查调度

3. **IPC 通信层建立**
    - 更新相关的 IPC 通道定义
    - 主进程 IPC 处理器注册
    - 错误处理和日志记录

4. **PreferenceManager 扩展**
    - 添加更新配置存储
    - 跳过版本管理
    - 配置迁移支持

#### Phase 2: 渲染进程集成 (Week 1-2) - ✅ 偏好设置集成已完成

1. **Pinia Store 实现** - ✅ 集成现有偏好设置系统
    - ✅ 扩展 PreferenceState 添加 AutoUpdateConfig
    - ✅ 实现 updateAutoUpdateConfig 等管理方法
    - ✅ 响应式状态管理和持久化存储

2. **基础 UI 组件开发** - ✅ 已完成
    - ✅ BaseSwitch 组件（已存在，用于开关配置）
    - ✅ BaseCard 组件用于版本信息展示
    - ✅ BaseButton 组件用于操作按钮

3. **更新对话框组件**
    - UpdateNotificationDialog（已详细定义）
    - UpdateProgressDialog（已详细定义）
    - 国际化文本集成

#### Phase 3: 设置界面集成 (Week 2)

1. **设置面板开发**
    - UpdateSettingsPanel（已详细定义）
    - 集成到现有设置页面
    - 实时配置保存

2. **主应用初始化（遵循现有Service模式）**

    ```typescript
    // src/main/index.ts - 按照现有代码模式集成UpdateService
    import UpdateService from "./update/update-service";

    function createWindow(): void {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        // 创建窗口
        mainWindow = new BrowserWindow({
            width,
            height,
            show: false,
            title: "Photasa",
            autoHideMenuBar: true,
            icon: icon,
            webPreferences: {
                preload: path.join(__dirname, "../preload/index.js"),
                sandbox: false,
                webSecurity: !isDev,
                nodeIntegration: false,
                contextIsolation: true,
            },
            ...(isMac() ? { titleBarStyle: "hiddenInset" } : { frame: false }),
        });

        // ... 现有窗口事件处理代码 ...

        // 按照现有Service模式初始化所有服务
        // Setup Log Viewer Service (create early so other services can register workers)
        const logViewerService = new LogViewerService(ipcMain, mainWindow);
        // Setup Thumbnail Service
        new ThumbnailService(ipcMain, mainWindow, app, logViewerService);
        // Setup Config Service
        new ConfigService(ipcMain, mainWindow);
        // Setup Scan Service
        new ScanService(ipcMain, mainWindow, app, logViewerService);
        // Setup File Watch Service
        watchService = new WatchService(ipcMain, mainWindow);
        // Setup Window Service
        new WindowService(ipcMain, mainWindow, app);
        // Setup Menu Service
        new MenuService(ipcMain, mainWindow);
        // Setup Shell Service
        new ShellService(ipcMain, mainWindow);
        // Setup Import Service
        new ImportService(ipcMain, mainWindow);

        // Setup Update Service - 遵循现有Service模式
        const updateService = new UpdateService(ipcMain, mainWindow);
        // 可选：自动初始化更新检查（根据用户配置）
        updateService.initialize().catch((error) => {
            logger.error("UpdateService initialization failed:", error);
        });
    }
    ```

    ```typescript
    // src/preload/index.ts - 按照现有API模式扩展
    // 在现有的api对象中添加更新相关API

    const api = {
        // ... 现有API ...
        startWatching,
        stopWatching,
        importPhotos,
        // ... 其他现有API ...

        // ========== 新增自动更新 API ==========
        /**
         * 检查应用更新
         */
        checkForUpdates: () => electronAPI.ipcRenderer.invoke("photasa:check-for-updates"),

        /**
         * 下载更新
         */
        downloadUpdate: () => electronAPI.ipcRenderer.invoke("photasa:download-update"),

        /**
         * 安装更新并重启应用
         */
        installUpdate: () => electronAPI.ipcRenderer.invoke("photasa:install-update"),

        /**
         * 获取当前应用版本
         */
        getAppVersion: () => electronAPI.ipcRenderer.invoke("photasa:get-app-version"),

        /**
         * 获取更新配置
         */
        getUpdateConfig: () => electronAPI.ipcRenderer.invoke("photasa:get-update-config"),

        /**
         * 设置更新配置
         */
        setUpdateConfig: (config: any) =>
            electronAPI.ipcRenderer.invoke("photasa:set-update-config", config),

        /**
         * 跳过特定版本更新
         */
        skipVersion: (version: string) =>
            electronAPI.ipcRenderer.invoke("photasa:skip-version", version),

        // ========== 更新事件监听器 ==========
        /**
         * 监听更新检查状态
         */
        onUpdateChecking: (callback: () => void) => {
            const handler = () => callback();
            electronAPI.ipcRenderer.on("photasa:update-checking", handler);
            return () => electronAPI.ipcRenderer.removeListener("photasa:update-checking", handler);
        },

        /**
         * 监听发现可用更新事件
         */
        onUpdateAvailable: (callback: (info: any) => void) => {
            const handler = (_: any, info: any) => callback(info);
            electronAPI.ipcRenderer.on("photasa:update-available", handler);
            return () =>
                electronAPI.ipcRenderer.removeListener("photasa:update-available", handler);
        },

        /**
         * 监听无可用更新事件
         */
        onUpdateNotAvailable: (callback: () => void) => {
            const handler = () => callback();
            electronAPI.ipcRenderer.on("photasa:update-not-available", handler);
            return () =>
                electronAPI.ipcRenderer.removeListener("photasa:update-not-available", handler);
        },

        /**
         * 监听下载进度
         */
        onDownloadProgress: (callback: (progress: any) => void) => {
            const handler = (_: any, progress: any) => callback(progress);
            electronAPI.ipcRenderer.on("photasa:update-download-progress", handler);
            return () =>
                electronAPI.ipcRenderer.removeListener("photasa:update-download-progress", handler);
        },

        /**
         * 监听下载完成事件
         */
        onUpdateDownloaded: (callback: () => void) => {
            const handler = () => callback();
            electronAPI.ipcRenderer.on("photasa:update-downloaded", handler);
            return () =>
                electronAPI.ipcRenderer.removeListener("photasa:update-downloaded", handler);
        },

        /**
         * 监听更新错误事件
         */
        onUpdateError: (callback: (error: any) => void) => {
            const handler = (_: any, error: any) => callback(error);
            electronAPI.ipcRenderer.on("photasa:update-error", handler);
            return () => electronAPI.ipcRenderer.removeListener("photasa:update-error", handler);
        },

        /**
         * 监听重试事件
         */
        onUpdateRetry: (callback: (retryInfo: any) => void) => {
            const handler = (_: any, retryInfo: any) => callback(retryInfo);
            electronAPI.ipcRenderer.on("photasa:update-retry", handler);
            return () => electronAPI.ipcRenderer.removeListener("photasa:update-retry", handler);
        },

        /**
         * 检查网络连接
         */
        checkNetworkConnectivity: () => electronAPI.ipcRenderer.invoke("photasa:check-network"),

        /**
         * 检查磁盘空间
         */
        checkDiskSpace: () => electronAPI.ipcRenderer.invoke("photasa:check-disk-space"),

        /**
         * 带重试机制的更新检查
         */
        checkForUpdatesWithRetry: (maxRetries?: number, retryDelay?: number) =>
            electronAPI.ipcRenderer.invoke(
                "photasa:check-for-updates-retry",
                maxRetries,
                retryDelay,
            ),

        /**
         * 带重试机制的更新下载
         */
        downloadUpdateWithRetry: (maxRetries?: number, retryDelay?: number) =>
            electronAPI.ipcRenderer.invoke("photasa:download-update-retry", maxRetries, retryDelay),
    };

    // 使用contextBridge暴露API - 遵循现有模式
    if (process.contextIsolated) {
        try {
            contextBridge.exposeInMainWorld("electron", electronAPI);
            contextBridge.exposeInMainWorld("api", api);
        } catch (error) {
            console.error(error);
        }
    } else {
        window.electron = electronAPI;
        window.api = api;
    }
    ```

#### Phase 4: 安全性验证和测试

1. **安全性检查清单**
    - ✅ 渲染进程无直接访问 Node.js API
    - ✅ 使用 contextBridge 安全暴露 API
    - ✅ 启用 contextIsolation
    - ✅ 禁用 nodeIntegration
    - ✅ 所有 IPC 通信经过 preload 层

2. **测试用例**
    - 更新检查功能测试
    - 下载进度测试
    - 错误处理测试
    - 配置保存和加载测试
    - 事件监听器内存泄漏测试

#### Phase 2: UI Components (Week 2-3)

1. **Update Notification Dialog**

    ```vue
    <!-- src/renderer/src/components/dialogs/UpdateNotificationDialog.vue -->
    <template>
        <BaseDialog v-model:open="isOpen" :title="$t('update.newVersionAvailable')">
            <UpdateDetails :version="updateInfo.version" :notes="updateInfo.notes" />
            <template #footer>
                <BaseButton @click="skipUpdate">{{ $t("update.skip") }}</BaseButton>
                <BaseButton @click="downloadUpdate" variant="primary">
                    {{ $t("update.download") }}
                </BaseButton>
            </template>
        </BaseDialog>
    </template>
    ```

2. **Settings Integration** - 现已完成实现，集成现有偏好设置系统

    **已实现的 UpdateSettings.vue 组件**:

    ```vue
    <!-- src/renderer/src/components/settings/UpdateSettings.vue -->
    <script setup lang="ts">
    import { computed, ref, onMounted } from "vue";
    import { storeToRefs } from "pinia";
    import { useI18n } from "vue-i18n";
    import { usePreferenceStore } from "@renderer/stores/preference";
    import { BaseButton, BaseSpace, BaseCard, BaseSwitch } from "@renderer/components/ui";

    const { t } = useI18n();
    const preferenceStore = usePreferenceStore();
    const { autoUpdate } = storeToRefs(preferenceStore);

    // 处理配置更新
    async function updateConfig(key, value) {
        await window.api?.updateAutoUpdateConfig?.({ [key]: value });
        preferenceStore.updateAutoUpdateConfig({ [key]: value });
    }
    </script>

    <template>
        <div class="settings-content">
            <!-- 自动更新开关 -->
            <div class="setting-section">
                <BaseSwitch
                    :modelValue="autoUpdate.enabled"
                    @update:modelValue="(value) => updateConfig('enabled', value)"
                />
            </div>

            <!-- 检查间隔配置 -->
            <div class="setting-section">
                <select
                    :value="autoUpdate.checkInterval"
                    @change="(e) => updateConfig('checkInterval', Number(e.target.value))"
                >
                    <option value="1">每小时</option>
                    <option value="6">每6小时</option>
                    <option value="24">每天</option>
                    <option value="168">每周</option>
                </select>
            </div>

            <!-- 版本信息和更新状态显示 -->
            <!-- 手动检查、下载、安装按钮 -->
        </div>
    </template>
    ```

    **已扩展的 preference.ts store**:

    ```typescript
    // src/renderer/src/stores/preference.ts
    export interface AutoUpdateConfig {
      enabled: boolean;
      checkInterval: number; // 检查间隔（小时）
      allowPrerelease: boolean;
      autoInstall: boolean;
      lastCheck?: string;
    }

    export type PreferenceState = {
      // ... 现有字段 ...
      autoUpdate: AutoUpdateConfig; // 新增自动更新配置
    };

    // 新增的 actions:
    actions: {
      // ... 现有方法 ...
      updateAutoUpdateConfig(config: Partial<AutoUpdateConfig>) {
        this.autoUpdate = { ...this.autoUpdate, ...config };
      },
      setAutoUpdateLastCheck(timestamp: string | number) {
        const dateStr = typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString();
        this.autoUpdate.lastCheck = dateStr;
      },
      resetAutoUpdateConfig() {
        this.autoUpdate = {
          enabled: true,
          checkInterval: 24,
          allowPrerelease: false,
          autoInstall: false,
        };
      }
    }
    ```

    **设置界面集成状态** - ✅ 已完成:
    - ✅ UpdateSettings.vue 组件已创建并完全实现
    - ✅ 已集成到 UserPreference.vue 主设置页面的自动更新标签页
    - ✅ 完整的中文国际化支持（zh-CN.json 已扩展）
    - ✅ 支持自动更新开关、检查间隔、预发布版本等配置
    - ✅ 版本信息显示和更新状态监控
    - ✅ 手动检查、下载、安装操作按钮

#### Phase 3: Advanced Features (Week 3-4)

1. **Update Scheduling**
    - 智能更新时机选择（应用空闲时）
    - 用户自定义更新时间窗口
    - 基于网络状况的更新策略

2. **Security & Validation**
    - 代码签名验证
    - 更新包完整性校验
    - 安全更新强制机制

3. **Error Handling & Recovery**
    - 更新失败重试机制
    - 回滚到前一版本
    - 离线更新支持

### Configuration Structure

```typescript
interface UpdateConfig {
    // Basic settings
    autoUpdate: boolean;
    checkInterval: number; // milliseconds
    updateChannel: "stable" | "beta" | "alpha";

    // Advanced settings
    allowPrerelease: boolean;
    autoDownload: boolean;
    autoInstallOnAppQuit: boolean;

    // Network settings
    proxy?: {
        host: string;
        port: number;
        username?: string;
        password?: string;
    };

    // UI settings
    showNotification: boolean;
    minimizeToTray: boolean;
    silentInstall: boolean;
}
```

### Update Flow

```
1. App Startup → Check for Updates (if enabled)
2. Update Available → Notify User
3. User Action → Download Update / Skip
4. Download Complete → Install Prompt / Auto Install
5. Installation → Restart App / Install on Quit
6. Post-Update → Verify Version / Show Changelog
```

### Error Scenarios

1. **Network Connectivity Issues**
    - 离线检测和延迟重试
    - 用户友好的网络错误提示

2. **Download Failures**
    - 断点续传支持
    - 多次重试机制
    - fallback 下载源

3. **Installation Failures**
    - 权限问题检测和解决
    - 安全软件冲突处理
    - 磁盘空间不足警告

## Drawbacks

### Technical Drawbacks

1. **应用包大小增加**：electron-updater 及相关依赖会增加约 2-3MB 应用体积
2. **启动时间延长**：启动时的更新检查可能增加 100-500ms 启动时间
3. **内存消耗**：更新管理器常驻内存，增加约 10-20MB 内存使用

### User Experience Drawbacks

1. **网络消耗**：自动更新检查和下载会消耗用户网络流量
2. **中断风险**：更新过程中可能中断用户正在进行的操作
3. **学习成本**：用户需要了解新的更新设置和行为

### Security & Privacy Concerns

1. **隐私问题**：更新检查会向服务器发送版本信息和可能的系统信息
2. **安全风险**：自动更新机制可能成为恶意攻击的入口点
3. **依赖风险**：依赖第三方更新服务的可用性和安全性

## Alternatives

### Alternative 1: Manual Update Only

**优点**：

- 用户完全控制更新时机
- 无隐私和安全担忧
- 实现简单

**缺点**：

- 用户体验差，更新率低
- 安全补丸推送困难
- 版本碎片化严重

### Alternative 2: Web-based Update Notification

**优点**：

- 实现简单
- 无需额外权限
- 跨平台兼容性好

**缺点**：

- 依赖网络连接
- 无法实现自动安装
- 用户操作步骤多

### Alternative 3: Custom Update System

**优点**：

- 完全自主控制
- 可定制化程度高
- 无第三方依赖

**缺点**：

- 开发成本高
- 安全风险大
- 维护复杂

### Impact of Not Implementing

1. **竞争劣势**：缺少现代桌面应用标准功能
2. **安全隐患**：无法及时推送安全补丁
3. **用户流失**：手动更新复杂度可能导致用户流失
4. **支持成本**：版本碎片化增加技术支持成本

## Resolved Decisions

### Technical Decisions

1. **更新服务器选择**：✅ **已决定使用 photasa.me (Next.js + Supabase)**
    - 主要更新通道：photasa.me/api/updates/releases
    - 备用通道：GitHub Releases
    - 统计分析：Supabase PostgreSQL + 实时订阅

2. **数据库方案**：✅ **已选择 Supabase**
    - 下载统计：Supabase PostgreSQL
    - 实时分析：Supabase 实时订阅
    - 文件存储：Vercel Blob Storage

### Unresolved Questions

#### Technical Questions

1. **差量更新实现**：electron-updater 是否支持增量更新？如何优化下载大小？
2. **平台差异处理**：Windows 和 macOS 的更新机制差异如何统一？
3. **开发环境配置**：如何在开发环境中测试更新功能？

### Business Questions

1. **更新频率策略**：多久检查一次更新？如何平衡及时性和资源消耗？
2. **用户通知策略**：何时显示更新通知？如何避免打扰用户？
3. **强制更新策略**：什么情况下需要强制更新？如何实现用户友好的强制更新？

### Security Questions

1. **签名证书管理**：如何安全地管理代码签名证书？
2. **更新验证机制**：除了签名验证，还需要哪些安全检查？
3. **恶意更新防护**：如何防止恶意更新包的安装？

### Implementation Questions

1. **Migration Strategy**：现有用户如何平滑升级到支持自动更新的版本？
2. **Testing Strategy**：如何全面测试各种更新场景和边缘情况？
3. **Rollback Mechanism**：更新失败时如何实现安全回滚？
4. **Monitoring & Analytics**：如何监控更新成功率和用户行为？

## Success Criteria

### Technical Metrics

- [ ] 更新检查成功率 > 99%
- [ ] 更新下载成功率 > 95%
- [ ] 更新安装成功率 > 98%
- [ ] 更新检查响应时间 < 3秒
- [ ] 支持 Windows 10+ 和 macOS 10.14+

### User Experience Metrics

- [ ] 用户更新接受率 > 80%
- [ ] 用户投诉率 < 1%
- [ ] 平均更新时间 < 2分钟
- [ ] 用户设置满意度 > 4.0/5.0

### Business Metrics

- [ ] 7天内更新率 > 95%
- [ ] 30天内更新率 > 99%
- [ ] 技术支持工单减少 > 30%
- [ ] 用户留存率提升 > 5%

## Implementation Timeline

### Week 1: Foundation Setup

- [ ] Supabase 项目创建和数据库表结构设计
- [ ] photasa.me 中集成 Supabase 客户端
- [ ] 项目配置和 electron-updater 集成
- [ ] 基础 UpdateManager 实现
- [ ] IPC 通信机制建立

### Week 2: Core Features

- [ ] photasa.me 更新 API 端点开发 (latest.yml, latest-mac.yml)
- [ ] Supabase 下载统计和日志记录功能
- [ ] 更新检查和下载功能
- [ ] 基础 UI 组件实现
- [ ] 用户偏好设置集成

### Week 3: Advanced Features

- [ ] Supabase 实时统计面板和数据分析
- [ ] 更新进度显示和错误处理
- [ ] 安全验证和签名检查
- [ ] 更新历史和回滚机制
- [ ] photasa.me 更新日志页面和用户界面

### Week 4: Polish & Testing

- [ ] 全面测试和 bug 修复
- [ ] 文档编写和用户指南
- [ ] 生产环境部署准备

### Week 5: Documentation & Release

- [ ] 完整的开发文档和 API 参考
- [ ] 用户使用指南和 FAQ
- [ ] 发布候选版本和用户反馈收集

## 部署配置

### Photasa 应用配置

```json
// package.json
{
    "build": {
        "publish": [
            {
                "provider": "generic",
                "url": "https://photasa.me/api/updates/releases",
                "channel": "latest"
            }
        ],
        "win": {
            "publisherName": "Photasa",
            "verifyUpdateCodeSignature": true
        },
        "mac": {
            "category": "public.app-category.photography",
            "hardenedRuntime": true,
            "notarize": true
        }
    }
}
```

### photasa.me 环境变量

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 文件存储
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# 版本管理
GITHUB_TOKEN=your-github-token (可选，用于同步GitHub Releases)
```

### Supabase 数据库初始化

```sql
-- 执行顺序很重要
CREATE TABLE download_stats (
  id SERIAL PRIMARY KEY,
  file_id VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL,
  platform VARCHAR(10) NOT NULL,
  user_agent TEXT,
  ip_address INET,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  country VARCHAR(2)
);

CREATE INDEX idx_download_stats_file_platform ON download_stats(file_id, platform);
CREATE INDEX idx_download_stats_date ON download_stats(downloaded_at);

CREATE TABLE download_counters (
  file_id VARCHAR(50) PRIMARY KEY,
  total_downloads INTEGER DEFAULT 0,
  win_downloads INTEGER DEFAULT 0,
  mac_downloads INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 触发器：自动更新计数器
CREATE OR REPLACE FUNCTION update_download_counters()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO download_counters (file_id, total_downloads, win_downloads, mac_downloads)
  VALUES (
    NEW.file_id,
    1,
    CASE WHEN NEW.platform = 'win' THEN 1 ELSE 0 END,
    CASE WHEN NEW.platform = 'mac' THEN 1 ELSE 0 END
  )
  ON CONFLICT (file_id) DO UPDATE SET
    total_downloads = download_counters.total_downloads + 1,
    win_downloads = download_counters.win_downloads + CASE WHEN NEW.platform = 'win' THEN 1 ELSE 0 END,
    mac_downloads = download_counters.mac_downloads + CASE WHEN NEW.platform = 'mac' THEN 1 ELSE 0 END,
    last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;  -- PostgreSQL procedural language (PL/pgSQL)

CREATE TRIGGER trigger_update_download_counters
  AFTER INSERT ON download_stats
  FOR EACH ROW EXECUTE FUNCTION update_download_counters();
```

## 风险评估与缓解策略

### 高风险项目

1. **自动更新失败导致应用无法启动**
    - 缓解：实现安全回滚机制，保留前一版本备份
    - 监控：实时监控更新失败率，超过阈值自动禁用自动更新

2. **网络中断导致更新文件损坏**
    - 缓解：SHA512 校验，损坏文件自动重新下载
    - 备选：断点续传支持

3. **恶意更新包攻击**
    - 缓解：代码签名强制验证，HTTPS 传输
    - 监控：异常下载行为检测

### 中等风险项目

1. **Supabase 服务中断**
    - 缓解：降级到 GitHub Releases，本地缓存机制
    - 备选：多区域部署

2. **用户隐私问题**
    - 缓解：IP 地址散列化，最小化数据收集
    - 合规：GDPR/California Consumer Privacy Act 数据处理声明

## 迁移策略

### 现有用户升级路径

1. **渐进式推出**
    - Week 1-2: 10% beta 用户
    - Week 3-4: 50% 用户群体
    - Week 5+: 100% 全量用户

2. **向后兼容**
    - 保留手动更新选项
    - 自动更新默认为可选功能
    - 旧版本仍可正常使用

3. **用户教育**
    - 应用内引导教程
    - 更新设置面板说明
    - FAQ 和帮助文档

### 技术债务处理

1. **现有构建流程改造**
    - 集成 electron-builder 自动发布
    - CI/CD 流程更新
    - 签名证书管理

2. **监控和告警系统**
    - Supabase + Vercel Analytics
    - 自定义更新成功率监控
    - 用户反馈收集系统
