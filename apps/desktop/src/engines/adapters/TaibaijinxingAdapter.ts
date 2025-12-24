/**
 * 太白金星菜单适配器
 * RFC 0058: 统一菜单管理到 qizou 流程
 *
 * 职责：
 * 1. 直接实现菜单逻辑（不依赖 MenuService）
 * 2. 处理平台差异（仅 macOS 处理系统菜单）
 * 3. 转换菜单数据并设置系统菜单
 * 4. 处理菜单点击事件，发送 IPC 到渲染进程
 * 5. ✅ 合并 ShellService 功能（打开外部链接、在 Finder 中显示文件）
 *
 * 历史背景：
 * 太白金星，中国神话中广为人知的神祇，玉皇大帝的顾问，负责沟通与协调，作为天庭的"门面"代表。
 * 在架构中负责菜单界面管理，菜单是应用的门面，太白金星作为天庭顾问，负责协调与展示，与菜单适配器的职责高度契合。
 *
 * 注意：天界（Main进程）使用神话人物命名，人界（Renderer进程）使用历史人物命名（长孙无忌）
 */

import { Menu, shell } from "electron";
import type { IpcMain, BrowserWindow } from "electron";
import { Adapter, AdapterPriority, IAdapter } from "../taiyi/core/adapter-decorators";
import { loggers } from "@common/logger";
import type { MenuItemData } from "@common/menu-types";

const logger = loggers.window;

/**
 * 太白金星菜单适配器
 * 使用@Adapter装饰器注册到太乙注册中心
 */
@Adapter({
    name: "taibaijinxing",
    displayName: "太白金星菜单适配器",
    priority: AdapterPriority.High,
    description: "管理应用程序菜单的适配器，负责菜单的构建、设置和事件处理",
    engineType: "menu",
    dependencies: [], // 菜单适配器不依赖其他引擎
    retryOnFailure: false,
    maxRetries: 0,
})
export class TaibaijinxingAdapter implements IAdapter {
    readonly name = "taibaijinxing";
    private ipcMain?: IpcMain;
    private mainWindow?: BrowserWindow;

    /**
     * 构造函数
     * 接收 IpcMain 和 BrowserWindow 依赖
     *
     * @param ipcMain Electron IPC 主进程接口（可选，通过 adapterArgs 传递）
     * @param mainWindow Electron 主窗口（可选，通过 adapterArgs 传递）
     */
    constructor(ipcMain?: IpcMain, mainWindow?: BrowserWindow) {
        this.ipcMain = ipcMain;
        this.mainWindow = mainWindow;
    }

    /**
     * 初始化适配器
     */
    async initialize(): Promise<void> {
        logger.info("✨ 太白金星就位，菜单规范已备，可处理天界菜单事务");

        // 如果缺少依赖，记录警告但不抛出错误（允许延迟初始化）
        if (!this.ipcMain) {
            logger.warn("✨ 太白金星：IpcMain 未提供，部分功能将受限");
            return;
        }

        // 设置 Shell IPC 监听（所有平台都需要）
        this.setupShellIpcHandlers();

        // 仅 macOS 下处理系统菜单
        if (process.platform !== "darwin") {
            logger.info("✨ 非 macOS 平台，跳过系统菜单初始化");
            return;
        }

        if (!this.mainWindow) {
            logger.warn("✨ 太白金星：BrowserWindow 未提供，菜单功能将受限");
            return;
        }

        logger.info("✨ 太白金星菜单适配器初始化完成");
    }

    /**
     * 设置 Shell IPC 处理器
     * 合并原 ShellService 的功能
     *
     * @private
     */
    private setupShellIpcHandlers(): void {
        if (!this.ipcMain) {
            return;
        }

        // Open in finder - 在 Finder 中显示文件
        this.ipcMain.on("picasa:open-in-finder", (_event, args: { path: string }) => {
            logger.info(`✨ 太白金星：奉旨于 Finder 中显示文件 ${args.path}`);
            shell.showItemInFolder(args.path);
        });

        // Open external - 打开外部链接
        this.ipcMain.handle("shell:openExternal", (_event, url: string) => {
            logger.info(`✨ 太白金星：奉旨打开外部链接 ${url}`);
            shell.openExternal(url);
        });

        logger.info("✨ 太白金星：Shell IPC 处理器已就绪，可处理外部链接和文件显示");
    }

    /**
     * 关闭适配器
     */
    async shutdown(): Promise<void> {
        if (this.ipcMain) {
            // 清理 IPC 监听器
            this.ipcMain.removeAllListeners("menu:applySystemMenu");
            this.ipcMain.removeAllListeners("picasa:open-in-finder");
            this.ipcMain.removeHandler("shell:openExternal");
        }
        logger.info("✨ 太白金星菜单适配器已关闭");
    }

    /**
     * 设置系统菜单
     * 由天枢引擎工作流调用
     *
     * @param menus 菜单数据
     */
    applySystemMenu(menus: MenuItemData[]): void {
        // 平台检查：仅 macOS 处理系统菜单
        if (process.platform !== "darwin") {
            logger.debug("✨ 非 macOS 平台，跳过系统菜单设置");
            return;
        }

        if (!this.mainWindow) {
            logger.warn("✨ 太白金星：BrowserWindow 未提供，无法设置系统菜单");
            return;
        }

        try {
            logger.info(`✨ 太白金星：设置系统菜单，菜单项数量: ${menus.length}`);
            const menu = Menu.buildFromTemplate(this.transformMenus(menus));
            Menu.setApplicationMenu(menu);
            logger.info("✨ 太白金星：系统菜单设置完成");
        } catch (error) {
            logger.error("✨ 太白金星：设置系统菜单失败", error);
            throw error;
        }
    }

    /**
     * 打开外部链接
     * 由天枢引擎工作流调用
     * 支持两种调用方式：
     * 1. 直接传递字符串：openExternal("https://...")
     * 2. 通过工作流传递对象：openExternal({ url: "https://..." })
     *
     * @param urlOrParams 外部链接 URL（字符串）或包含 url 的对象
     */
    async openExternal(
        urlOrParams: string | { url: string },
    ): Promise<{ success: boolean; message?: string }> {
        // 从对象参数中提取 url，或直接使用字符串参数
        const url = typeof urlOrParams === "string" ? urlOrParams : urlOrParams.url;
        logger.info(`✨ 太白金星：奉旨打开外部链接 ${url}`);
        try {
            await shell.openExternal(url);
            logger.info(`✨ 太白金星：外部链接已打开 ${url}`);
            return { success: true, message: `外部链接已打开: ${url}` };
        } catch (error) {
            logger.error(`✨ 太白金星：打开外部链接失败 ${url}`, error);
            throw error;
        }
    }

    /**
     * 在 Finder 中显示文件
     * 由天枢引擎工作流调用
     * 支持两种调用方式：
     * 1. 直接传递字符串：openInFinder("/path/to/file")
     * 2. 通过工作流传递对象：openInFinder({ path: "/path/to/file" })
     *
     * @param pathOrParams 文件路径（字符串）或包含 path 的对象
     */
    openInFinder(pathOrParams: string | { path: string }): { success: boolean; message?: string } {
        // 从对象参数中提取 path，或直接使用字符串参数
        const path = typeof pathOrParams === "string" ? pathOrParams : pathOrParams.path;
        logger.info(`✨ 太白金星：奉旨于 Finder 中显示文件 ${path}`);
        try {
            shell.showItemInFolder(path);
            logger.info(`✨ 太白金星：文件已在 Finder 中显示 ${path}`);
            return { success: true, message: `文件已在 Finder 中显示: ${path}` };
        } catch (error) {
            logger.error(`✨ 太白金星：在 Finder 中显示文件失败 ${path}`, error);
            throw error;
        }
    }

    /**
     * 递归转换 MenuItemData 为 Electron.MenuItemConstructorOptions
     * 处理分隔符、平台专属项和子菜单
     *
     * @param menus 菜单数据
     * @returns Electron 菜单项构造选项数组
     */
    private transformMenus(menus: MenuItemData[]): Electron.MenuItemConstructorOptions[] {
        return menus
            .map((item) => {
                // 分隔符特殊处理
                if (item.type === "separator") {
                    return { type: "separator" };
                }

                // 平台专属菜单过滤
                if (item.isMacOnly && process.platform !== "darwin") {
                    return null;
                }

                const menuItem: Electron.MenuItemConstructorOptions = {
                    label: item.label,
                    enabled: !item.disabled,
                    accelerator: item.shortcut,
                    role: item.role as Electron.MenuItemConstructorOptions["role"],
                    click: () => {
                        // 菜单点击事件转发到渲染进程
                        if (this.mainWindow) {
                            this.mainWindow.webContents.send("menu:action", {
                                key: item.key,
                                label: item.label,
                                shortcut: item.shortcut,
                                role: item.role,
                                url: item.url,
                            });
                        } else {
                            logger.warn("✨ 太白金星：BrowserWindow 未提供，无法发送菜单点击事件");
                        }
                    },
                };

                // 递归处理子菜单
                if (item.items && item.items.length > 0) {
                    menuItem.submenu = this.transformMenus(item.items).filter(
                        Boolean,
                    ) as Electron.MenuItemConstructorOptions[];
                }

                return menuItem;
            })
            .filter(Boolean) as Electron.MenuItemConstructorOptions[];
    }
}
