/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import UpdateService from "../update-service";
import type { AutoUpdateConfig } from "@photasa/common";
import { autoUpdater } from "electron-updater";

// Mock electron-updater
vi.mock("electron-updater", () => ({
    autoUpdater: Object.assign(new EventEmitter(), {
        setFeedURL: vi.fn(),
        checkForUpdatesAndNotify: vi.fn().mockResolvedValue(null),
        downloadUpdate: vi.fn().mockResolvedValue([]),
        quitAndInstall: vi.fn(),
        currentVersion: { version: "1.6.0" },
        autoDownload: false,
        autoInstallOnAppQuit: false,
        allowPrerelease: false,
    }),
}));

// Mock logger
vi.mock("@photasa/common", () => ({
    loggers: {
        update: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
        },
    },
}));

// Mock IpcMain and BrowserWindow
const mockIpcMain = {
    handle: vi.fn(),
};

const mockMainWindow = {
    webContents: {
        send: vi.fn(),
    },
};

describe("UpdateService", () => {
    let updateService: UpdateService | null = null;
    let mockConfig: AutoUpdateConfig;

    beforeEach(() => {
        vi.clearAllMocks();

        // 清理autoUpdater的事件监听器以避免内存泄漏警告
        (autoUpdater as any).removeAllListeners();
        // 重置EventEmitter的最大监听器数量
        (autoUpdater as any).setMaxListeners(10);

        mockConfig = {
            enabled: true,
            checkInterval: 24,
            allowPrerelease: false,
            autoInstall: false,
        };

        updateService = new UpdateService(mockIpcMain as any, mockMainWindow as any);
    });

    afterEach(() => {
        // 清理UpdateService实例
        if (updateService) {
            // 清理定时器
            if (updateService["checkTimer"]) {
                clearInterval(updateService["checkTimer"]);
                updateService!["checkTimer"] = null;
            }
            // 停止定时检查
            updateService!["stopPeriodicCheck"]();
            // 清理事件监听器
            (autoUpdater as any).removeAllListeners();
            // 释放引用
            updateService = null;
        }
        // 强制垃圾回收提示
        if (global.gc) {
            global.gc();
        }
    });

    describe("构造函数和初始化", () => {
        it("应该正确初始化服务", () => {
            // UpdateService现在使用配置文件驱动，不再调用setFeedURL
            // expect(autoUpdater.setFeedURL).toHaveBeenCalledWith({
            //     provider: "generic",
            //     url: "https://photasa.me/api/updates/releases",
            // });
            expect(autoUpdater.autoDownload).toBe(false);
            expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
        });

        it("应该注册IPC处理器", () => {
            const expectedHandlers = [
                "picasa:check-for-updates",
                "picasa:download-update",
                "picasa:install-update",
                "picasa:get-update-status",
                "picasa:get-app-version",
                "picasa:update-auto-update-config",
            ];

            expectedHandlers.forEach((handler) => {
                expect(mockIpcMain.handle).toHaveBeenCalledWith(handler, expect.any(Function));
            });
        });
    });

    describe("配置管理", () => {
        it("应该正确初始化配置", async () => {
            await updateService!.initializeWithConfig(mockConfig);

            expect(autoUpdater.allowPrerelease).toBe(false);
            expect(updateService!["config"]).toEqual(mockConfig);
        });

        it("应该正确更新配置", async () => {
            await updateService!.initializeWithConfig(mockConfig);

            const newConfig = { enabled: false, allowPrerelease: true };
            updateService!.updateConfig(newConfig);

            expect(updateService!["config"]).toEqual({
                ...mockConfig,
                ...newConfig,
            });
            expect(autoUpdater.allowPrerelease).toBe(true);
        });

        it("应该在启用状态变化时重启定时检查", async () => {
            await updateService!.initializeWithConfig(mockConfig);
            const startSpy = vi.spyOn(updateService as any, "startPeriodicCheck");
            const stopSpy = vi.spyOn(updateService as any, "stopPeriodicCheck");

            // 从enabled变为disabled应该停止定时检查
            updateService!.updateConfig({ enabled: false });
            expect(stopSpy).toHaveBeenCalled();

            // 从disabled变为enabled应该启动定时检查
            updateService!.updateConfig({ enabled: true });
            expect(startSpy).toHaveBeenCalledTimes(1); // updateConfig时的调用

            // 清理spy避免内存泄漏
            startSpy.mockRestore();
            stopSpy.mockRestore();
        });

        it("应该在检查间隔变化时重启定时检查", async () => {
            await updateService!.initializeWithConfig(mockConfig);
            const restartSpy = vi.spyOn(updateService as any, "restartPeriodicCheck");

            // 改变检查间隔应该重启定时检查
            updateService!.updateConfig({ checkInterval: 12 });
            expect(restartSpy).toHaveBeenCalled();

            // 清理spy避免内存泄漏
            restartSpy.mockRestore();
        });
    });

    describe("更新检查", () => {
        beforeEach(async () => {
            await updateService!.initializeWithConfig(mockConfig);
        });

        it("应该成功检查更新并发现新版本", async () => {
            const updateInfo = {
                version: "1.7.0",
                files: [],
                releaseNotes: "Bug fixes",
            };

            vi.mocked(autoUpdater.checkForUpdatesAndNotify).mockResolvedValueOnce({
                updateInfo: updateInfo as any,
            } as any);

            const result = await updateService!.checkForUpdates();

            expect(result.hasUpdate).toBe(true);
            expect(result.version).toBe("1.7.0");
            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
                "picasa:update-available",
                { version: "1.7.0", info: updateInfo },
            );
        });

        it("应该检测当前版本已是最新", async () => {
            const updateInfo = {
                version: "1.6.0", // 与currentVersion相同
                files: [],
                releaseNotes: "Current version",
            };

            vi.mocked(autoUpdater.checkForUpdatesAndNotify).mockResolvedValueOnce({
                updateInfo: updateInfo as any,
            } as any);

            const result = await updateService!.checkForUpdates();

            expect(result.hasUpdate).toBe(false);
            expect(updateService!.getUpdateStatus().status).toBe("upToDate");
        });

        it("应该处理检查更新时的网络错误", async () => {
            const networkError = new Error("net::ERR_NETWORK_CHANGED");
            vi.mocked(autoUpdater.checkForUpdatesAndNotify).mockRejectedValueOnce(networkError);

            await expect(updateService!.checkForUpdates()).rejects.toThrow(
                "网络连接错误，请检查网络连接",
            );
            expect(updateService!.getUpdateStatus().status).toBe("error");
            expect(updateService!.getUpdateStatus().error).toBe("网络连接错误，请检查网络连接");
        });

        it("应该防止重复检查", async () => {
            // 设置状态为检查中
            updateService!["currentStatus"] = "checking";

            const result = await updateService!.checkForUpdates();

            expect(result.hasUpdate).toBe(false);
            expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
        });
    });

    describe("更新下载", () => {
        beforeEach(async () => {
            await updateService!.initializeWithConfig(mockConfig);
            updateService!["latestUpdateInfo"] = {
                version: "1.7.0",
                files: [],
                releaseNotes: "New version",
            } as any;
        });

        it("应该成功下载更新", async () => {
            vi.mocked(autoUpdater.downloadUpdate).mockResolvedValueOnce([]);

            await updateService!.downloadUpdate();

            expect(autoUpdater.downloadUpdate).toHaveBeenCalled();
            expect(updateService!.getUpdateStatus().status).toBe("downloading");
        });

        it("应该在没有更新信息时抛出错误", async () => {
            updateService!["latestUpdateInfo"] = null;

            await expect(updateService!.downloadUpdate()).rejects.toThrow("没有可用的更新信息");
        });

        it("应该防止重复下载", async () => {
            updateService!["currentStatus"] = "downloading";

            await updateService!.downloadUpdate();

            expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
        });

        it("应该处理下载错误", async () => {
            const error = new Error("ENOSPC: no space left on device");
            vi.mocked(autoUpdater.downloadUpdate).mockRejectedValueOnce(error);

            await expect(updateService!.downloadUpdate()).rejects.toThrow(
                "磁盘空间不足，请清理磁盘空间",
            );
            expect(updateService!.getUpdateStatus().status).toBe("error");
        });
    });

    describe("更新安装", () => {
        it("应该成功安装更新", () => {
            updateService!["currentStatus"] = "downloaded";

            updateService!.quitAndInstall();

            expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
        });

        it("应该在没有下载更新时抛出错误", () => {
            updateService!["currentStatus"] = "idle";

            expect(() => updateService!.quitAndInstall()).toThrow("没有已下载的更新可以安装");
        });
    });

    describe("定时检查", () => {
        it("应该启动定时检查", async () => {
            const spy = vi.spyOn(global, "setInterval");

            await updateService!.initializeWithConfig(mockConfig);

            expect(spy).toHaveBeenCalledWith(expect.any(Function), 24 * 60 * 60 * 1000);

            // 清理spy
            spy.mockRestore();
        });

        it("应该在禁用时不启动定时检查", async () => {
            const spy = vi.spyOn(global, "setInterval");
            mockConfig.enabled = false;

            await updateService!.initializeWithConfig(mockConfig);

            expect(spy).not.toHaveBeenCalled();

            // 清理spy
            spy.mockRestore();
        });

        it("应该在停止时清理定时器", async () => {
            await updateService!.initializeWithConfig(mockConfig);
            const spy = vi.spyOn(global, "clearInterval");

            updateService!["stopPeriodicCheck"]();

            expect(spy).toHaveBeenCalled();

            // 清理spy
            spy.mockRestore();
        });
    });

    describe("错误处理", () => {
        it("应该正确分类网络错误", () => {
            const error = new Error("net::ERR_CONNECTION_REFUSED");
            const result = updateService!["handleError"](error);

            expect(result).toBe("网络连接错误，请检查网络连接");
        });

        it("应该正确分类证书错误", () => {
            const error = new Error("certificate verify failed");
            const result = updateService!["handleError"](error);

            expect(result).toBe("证书验证错误，请检查系统时间设置");
        });

        it("应该正确分类磁盘空间错误", () => {
            const error = new Error("ENOSPC: no space left");
            const result = updateService!["handleError"](error);

            expect(result).toBe("磁盘空间不足，请清理磁盘空间");
        });

        it("应该正确分类权限错误", () => {
            const error = new Error("EACCES: permission denied");
            const result = updateService!["handleError"](error);

            expect(result).toBe("权限不足，请以管理员身份运行");
        });

        it("应该处理未知错误", () => {
            const error = new Error("unknown error");
            const result = updateService!["handleError"](error);

            expect(result).toBe("更新失败: unknown error");
        });
    });

    describe("状态管理", () => {
        it("应该正确获取当前状态", () => {
            updateService!["currentStatus"] = "downloading";
            updateService!["downloadProgress"] = 50;
            updateService!["lastError"] = "测试错误";

            const status = updateService!.getUpdateStatus();

            expect(status.status).toBe("downloading");
            expect(status.progress).toBe(50);
            expect(status.error).toBe("测试错误");
        });

        it("应该在设置状态时通知渲染进程", () => {
            updateService!["setStatus"]("downloading");

            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
                "picasa:update-status-changed",
                expect.objectContaining({
                    status: "downloading",
                }),
            );
        });
    });

    describe("electron-updater 事件处理", () => {
        beforeEach(async () => {
            await updateService!.initializeWithConfig(mockConfig);
        });

        afterEach(() => {
            // 清理所有事件监听器
            (autoUpdater as any).removeAllListeners();
        });

        it("应该处理下载进度事件", () => {
            const progressData = {
                percent: 75,
                total: 100,
                delta: 25,
                transferred: 75,
                bytesPerSecond: 1024,
            } as any;

            autoUpdater.emit("download-progress", progressData);

            expect(updateService!["downloadProgress"]).toBe(75);
            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
                "picasa:update-progress",
                75,
            );
        });

        it("应该处理更新下载完成事件", () => {
            const updateInfo = {
                version: "1.7.0",
                downloadedFile: "update.zip",
                files: [],
                path: "/path/to/update.zip",
                sha512: "abc123",
                releaseDate: new Date(),
            } as any;

            autoUpdater.emit("update-downloaded", updateInfo);

            expect(updateService!.getUpdateStatus().status).toBe("downloaded");
            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
                "picasa:update-downloaded",
                updateInfo,
            );
        });

        it("应该处理错误事件", () => {
            const error = new Error("Test error");

            autoUpdater.emit("error", error);

            expect(updateService!.getUpdateStatus().status).toBe("error");
            expect(updateService!.getUpdateStatus().error).toBe("更新失败: Test error");
        });
    });

    describe("获取应用版本", () => {
        it("应该返回当前应用版本", () => {
            const version = updateService!.getAppVersion();

            expect(version).toBe("1.6.0");
        });
    });
});
