import type { MenuItemData } from "@photasa/common";
import { MENU_KEY_VIEW_FORCE_RELOAD, MENU_KEY_VIEW_RELOAD } from "../../constants/menu-keys";

export const SystemMenus: readonly MenuItemData[] = Object.freeze([
    // macOS 专属 appMenu
    {
        key: "app",
        label: "menu.app.menu",
        isMacOnly: true,
        items: [
            { key: "app.about", label: "menu.app.about", role: "about" },
            {
                key: "app.separator-1",
                label: "menu.separator",
                role: "separator",
                type: "separator",
            },
            { key: "app.services", label: "menu.app.services", role: "services" },
            {
                key: "app.separator-2",
                label: "menu.separator",
                role: "separator",
                type: "separator",
            },
            { key: "app.hide", label: "menu.app.hide", role: "hide" },
            { key: "app.hide-others", label: "menu.app.hideOthers", role: "hideOthers" },
            { key: "app.unhide", label: "menu.app.unhide", role: "unhide" },
            {
                key: "app.separator-3",
                label: "menu.separator",
                role: "separator",
                type: "separator",
            },
            { key: "app.quit", label: "menu.app.quit", role: "quit" },
        ],
    },
    // View 菜单
    {
        key: "view",
        label: "menu.view.menu",
        items: [
            { key: MENU_KEY_VIEW_RELOAD, label: "menu.view.reload", role: "reload", shortcut: "Ctrl+R" },
            { key: MENU_KEY_VIEW_FORCE_RELOAD, label: "menu.view.forceReload", role: "forceReload" },
            {
                key: "view-toggle-devtools",
                label: "menu.view.toggleDevTools",
                role: "toggleDevTools",
            },
            {
                key: "view-separator-1",
                label: "menu.separator",
                role: "separator",
                type: "separator",
            },
            { key: "view-reset-zoom", label: "menu.view.resetZoom", role: "resetZoom" },
            { key: "view-zoom-in", label: "menu.view.zoomIn", role: "zoomIn" },
            { key: "view-zoom-out", label: "menu.view.zoomOut", role: "zoomOut" },
            {
                key: "view-separator-2",
                label: "menu.separator",
                role: "separator",
                type: "separator",
            },
            {
                key: "view-toggle-fullscreen",
                label: "menu.view.toggleFullScreen",
                role: "togglefullscreen",
                shortcut: "F11",
            },
        ],
    },
    // Window 菜单
    {
        key: "window",
        label: "menu.window.menu",
        items: [
            {
                key: "window-minimize",
                label: "menu.window.minimize",
                role: "minimize",
                shortcut: "Ctrl+M",
            },
            { key: "window-maximize", label: "menu.window.maximize", shortcut: "Ctrl+Shift+M" },
            { key: "window-close", label: "menu.window.close", shortcut: "Ctrl+W" },
        ],
    },
    // Help 菜单
    {
        key: "help",
        label: "menu.help.menu",
        items: [
            {
                key: "help-learn-more",
                label: "menu.help.learnMore",
                url: "https://photasa.me",
            },
            { key: "help-about", label: "menu.help.about", shortcut: "F1" },
        ],
    },
]);
