/**
 * 服务工厂映射
 * 定义所有服务的创建工厂函数
 */

import { BrowserWindow, IpcMain, App } from "electron";
import { ServiceFactory, IService } from "../core/service-types";
import { ServiceAdapter } from "../adapters/service-adapter";

// 导入所有服务类
import ThumbnailService from "../../thumbnail/thumbnail-service";
import ConfigService from "../../config/config-service";
import ScanService from "../../scan/scan-service";
import WatchService from "../../watch/watch-service";
import WindowService from "../../window/window-service";
import MenuService from "../../menu/menu-service";
import ShellService from "../../shell/shell-service";
import ImportService from "../../import/import-service";
import LogViewerService from "../../log-viewer/log-viewer-service";
import UpdateService from "../../update/update-service";

/**
 * 服务工厂映射表
 * 将服务名称映射到对应的工厂函数
 */
export const serviceFactories: Record<string, ServiceFactory> = {
    config: (ipcMain: IpcMain, mainWindow: BrowserWindow): IService => {
        const service = new ConfigService(ipcMain, mainWindow);
        return new ServiceAdapter("config", service);
    },

    window: (ipcMain: IpcMain, mainWindow: BrowserWindow, app: App): IService => {
        const service = new WindowService(ipcMain, mainWindow, app);
        return new ServiceAdapter("window", service);
    },

    logViewer: (ipcMain: IpcMain, mainWindow: BrowserWindow): IService => {
        const service = new LogViewerService(ipcMain, mainWindow);
        return new ServiceAdapter("logViewer", service, "activateLogViewer");
    },

    menu: (ipcMain: IpcMain, mainWindow: BrowserWindow): IService => {
        const service = new MenuService(ipcMain, mainWindow);
        return new ServiceAdapter("menu", service);
    },

    shell: (ipcMain: IpcMain, mainWindow: BrowserWindow): IService => {
        const service = new ShellService(ipcMain, mainWindow);
        return new ServiceAdapter("shell", service);
    },

    update: (ipcMain: IpcMain, mainWindow: BrowserWindow): IService => {
        const service = new UpdateService(ipcMain, mainWindow);
        return new ServiceAdapter("update", service);
    },

    thumbnail: (
        ipcMain: IpcMain,
        mainWindow: BrowserWindow,
        app: App,
        dependencies?: Map<string, IService>,
    ): IService => {
        const logViewerAdapter = dependencies?.get("logViewer") as any;
        const logViewerService = logViewerAdapter?.getWrappedService?.() as LogViewerService;
        const service = new ThumbnailService(ipcMain, mainWindow, app, logViewerService);
        return new ServiceAdapter("thumbnail", service);
    },

    scan: (
        ipcMain: IpcMain,
        mainWindow: BrowserWindow,
        app: App,
        dependencies?: Map<string, IService>,
    ): IService => {
        const logViewerAdapter = dependencies?.get("logViewer") as any;
        const logViewerService = logViewerAdapter?.getWrappedService?.() as LogViewerService;
        const service = new ScanService(ipcMain, mainWindow, app, logViewerService);
        return new ServiceAdapter("scan", service);
    },

    watch: (ipcMain: IpcMain, mainWindow: BrowserWindow): IService => {
        const service = new WatchService(ipcMain, mainWindow);
        return new ServiceAdapter("watch", service, undefined, "close");
    },

    import: (ipcMain: IpcMain, mainWindow: BrowserWindow): IService => {
        const service = new ImportService(ipcMain, mainWindow);
        return new ServiceAdapter("import", service);
    },
};

/**
 * 获取服务工厂
 */
export function getServiceFactory(serviceName: string): ServiceFactory | undefined {
    return serviceFactories[serviceName];
}

/**
 * 注册自定义服务工厂
 */
export function registerServiceFactory(serviceName: string, factory: ServiceFactory): void {
    serviceFactories[serviceName] = factory;
}

/**
 * 获取所有注册的服务名称
 */
export function getRegisteredServiceNames(): string[] {
    return Object.keys(serviceFactories);
}
