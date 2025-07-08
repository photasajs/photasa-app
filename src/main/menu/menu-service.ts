import { Menu } from "electron";
import type { IpcMain, BrowserWindow as TBrowserWindow } from "electron";
import { loggers } from "@common/logger";
import type { MenuItemData } from "@common/menu-types";

/**
 * MenuService 负责主进程菜单的同步、构建与事件转发
 * - 监听 preload 层 menu:applySystemMenu
 * - 动态构建 Electron.Menu
 * - 菜单项点击事件通过 IPC 转发到渲染进程
 */
export default class MenuService {
    ipc: IpcMain;
    mainWindow: TBrowserWindow;
    logger = loggers.window;

    constructor(ipcMain: IpcMain, mainWindow: TBrowserWindow) {
        this.ipc = ipcMain;
        this.mainWindow = mainWindow;
        this.init();
    }

    /**
     * 初始化菜单服务，注册 IPC 监听
     */
    private init(): void {
        // 仅 macOS 下处理系统菜单
        if (process.platform !== "darwin") return;
        // 监听菜单同步请求
        this.ipc.on("menu:applySystemMenu", (_event, menus: MenuItemData[]) => {
            this.logger.info("menu:applySystemMenu", menus);
            try {
                this.applySystemMenu(menus);
            } catch (err) {
                this.logger.error("applySystemMenu error", err);
            }
        });
    }

    /**
     * 构建并设置系统菜单
     * @param menus 菜单数据
     */
    private applySystemMenu(menus: MenuItemData[]): void {
        const menu = Menu.buildFromTemplate(this.transformMenus(menus));
        Menu.setApplicationMenu(menu);
    }

    /**
     * 递归转换 MenuItemData 为 Electron.MenuItemConstructorOptions
     * @param menus 菜单数据
     */
    private transformMenus(menus: MenuItemData[]): Electron.MenuItemConstructorOptions[] {
        return menus
            .map((item) => {
                // 分隔符特殊处理
                if (item.type === "separator") {
                    return { type: "separator" };
                }
                // 平台专属菜单过滤
                if (item.isMacOnly && process.platform !== "darwin") return null;
                const menuItem: Electron.MenuItemConstructorOptions = {
                    label: item.label,
                    enabled: !item.disabled,
                    accelerator: item.shortcut,
                    role: item.role as any,
                    click: (/* _menuItem, _browserWindow, _event */) => {
                        // 菜单点击事件转发到渲染进程
                        this.mainWindow.webContents.send("menu:action", {
                            key: item.key,
                            label: item.label,
                            shortcut: item.shortcut,
                            role: item.role,
                            url: item.url,
                        });
                    },
                };
                if (item.items && item.items.length > 0) {
                    menuItem.submenu = this.transformMenus(item.items).filter(Boolean);
                }
                return menuItem;
            })
            .filter(Boolean) as Electron.MenuItemConstructorOptions[];
    }
}
