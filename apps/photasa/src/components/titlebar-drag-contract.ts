/**
 * RFC 0152 — macOS 自定义标题栏拖拽契约
 *
 * macOS：菜单在系统菜单栏（apply_system_menu），标题栏仅拖拽 + 快捷按钮。
 * Win/Linux：TitlebarMenuBar 在 TitlebarWinLinux 内，遵守下方 pointer-events 规则。
 */
export const TITLEBAR_DRAG_REGION_ATTR = "data-tauri-drag-region" as const;

export const TITLEBAR_TEST_ID = {
    DRAG_HANDLE: "titlebar-drag-handle",
    MENU_BAR: "titlebar-menu-bar",
    MENU_ITEM: "titlebar-menu-item",
    SETTING_HEADER: "titlebar-setting-header",
} as const;
