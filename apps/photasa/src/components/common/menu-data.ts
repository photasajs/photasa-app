import type { MenuItemData } from "@photasa/common";
import {
    MENU_KEY_APP_PREFERENCES,
    MENU_KEY_FILE_ADD_FOLDER,
    MENU_KEY_FILE_IMPORT,
    MENU_KEY_FILE_SCAN_QUEUE,
    MENU_KEY_HELP_ABOUT,
    MENU_KEY_HELP_EXPLORE,
    MENU_KEY_HELP_GETTING_STARTED,
    MENU_KEY_HELP_REPORT_ISSUE,
    MENU_KEY_VIEW_FORCE_RELOAD,
    MENU_KEY_VIEW_RELOAD,
    MENU_KEY_WINDOW_CLOSE,
    MENU_KEY_WINDOW_MAXIMIZE,
} from "../../constants/menu-keys";
import { PHOTASA_ME_DOCS_URL, PHOTASA_ME_HOMEPAGE_URL } from "../../constants/photasa-me-api";

export const SystemMenus: readonly MenuItemData[] = Object.freeze([
    // macOS 专属 appMenu（RFC 0169: 增加 Preferences）
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
            {
                key: MENU_KEY_APP_PREFERENCES,
                label: "menu.app.preferences",
                shortcut: "CmdOrCtrl+,",
            },
            {
                key: "app.separator-prefs",
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
    // File 菜单（RFC 0169: Photasa 领域操作）
    {
        key: "file",
        label: "menu.file.menu",
        items: [
            {
                key: MENU_KEY_FILE_IMPORT,
                label: "menu.file.import",
                shortcut: "CmdOrCtrl+I",
            },
            {
                key: MENU_KEY_FILE_ADD_FOLDER,
                label: "menu.file.addFolder",
                shortcut: "CmdOrCtrl+Shift+O",
            },
            {
                key: "file-separator-1",
                label: "menu.separator",
                role: "separator",
                type: "separator",
            },
            {
                key: MENU_KEY_FILE_SCAN_QUEUE,
                label: "menu.file.scanQueue",
            },
        ],
    },
    // Edit 菜单（RFC 0169: 标准 role，激活 role_to_predefined）
    {
        key: "edit",
        label: "menu.edit.menu",
        items: [
            { key: "edit-undo", label: "menu.edit.undo", role: "undo", shortcut: "CmdOrCtrl+Z" },
            {
                key: "edit-redo",
                label: "menu.edit.redo",
                role: "redo",
                shortcut: "CmdOrCtrl+Shift+Z",
            },
            {
                key: "edit-separator-1",
                label: "menu.separator",
                role: "separator",
                type: "separator",
            },
            { key: "edit-cut", label: "menu.edit.cut", role: "cut", shortcut: "CmdOrCtrl+X" },
            { key: "edit-copy", label: "menu.edit.copy", role: "copy", shortcut: "CmdOrCtrl+C" },
            { key: "edit-paste", label: "menu.edit.paste", role: "paste", shortcut: "CmdOrCtrl+V" },
            {
                key: "edit-separator-2",
                label: "menu.separator",
                role: "separator",
                type: "separator",
            },
            {
                key: "edit-select-all",
                label: "menu.edit.selectAll",
                role: "selectAll",
                shortcut: "CmdOrCtrl+A",
            },
        ],
    },
    // View 菜单
    {
        key: "view",
        label: "menu.view.menu",
        items: [
            {
                key: MENU_KEY_VIEW_RELOAD,
                label: "menu.view.reload",
                role: "reload",
                shortcut: "Ctrl+R",
            },
            {
                key: MENU_KEY_VIEW_FORCE_RELOAD,
                label: "menu.view.forceReload",
                role: "forceReload",
            },
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
    // Window 菜单（RFC 0169: maximize/close 无 role，走 handleMenuAction）
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
            {
                key: MENU_KEY_WINDOW_MAXIMIZE,
                label: "menu.window.maximize",
                shortcut: "Ctrl+Shift+M",
            },
            {
                key: MENU_KEY_WINDOW_CLOSE,
                label: "menu.window.close",
                shortcut: "Ctrl+W",
                // macOS AppKit 会在 File 菜单注入 Close Window；Window 内保留会重复
                excludeOnMac: true,
            },
        ],
    },
    // Help 菜单（RFC 0171：Report Issue → Explore → Getting Started → About）
    {
        key: "help",
        label: "menu.help.menu",
        items: [
            {
                key: MENU_KEY_HELP_REPORT_ISSUE,
                label: "menu.help.reportIssue",
            },
            {
                key: "help-separator-1",
                label: "menu.separator",
                role: "separator",
                type: "separator",
            },
            {
                key: MENU_KEY_HELP_EXPLORE,
                label: "menu.help.explorePhotasa",
                url: PHOTASA_ME_HOMEPAGE_URL,
            },
            {
                key: MENU_KEY_HELP_GETTING_STARTED,
                label: "menu.help.gettingStarted",
                url: PHOTASA_ME_DOCS_URL,
            },
            {
                key: "help-separator-2",
                label: "menu.separator",
                role: "separator",
                type: "separator",
            },
            { key: MENU_KEY_HELP_ABOUT, label: "menu.help.about", shortcut: "F1" },
        ],
    },
]);
