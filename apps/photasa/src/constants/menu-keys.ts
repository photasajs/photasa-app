/**
 * 与 `components/common/menu-data.ts` 中项的 `key` 一致，供菜单分发等处引用，避免魔法字符串分叉。
 */
export const MENU_KEY_VIEW_RELOAD = "view-reload" as const;
export const MENU_KEY_VIEW_FORCE_RELOAD = "view-force-reload" as const;
export const MENU_KEY_HELP_REPORT_ISSUE = "help-report-issue" as const;
export const MENU_KEY_HELP_EXPLORE = "help-explore-photasa" as const;
export const MENU_KEY_HELP_GETTING_STARTED = "help-getting-started" as const;
export const MENU_KEY_HELP_ABOUT = "help-about" as const;

/** RFC 0169: App 菜单 */
export const MENU_KEY_APP_PREFERENCES = "app.preferences" as const;

/** RFC 0169: File 菜单（Photasa 领域操作） */
export const MENU_KEY_FILE_IMPORT = "file-import" as const;
export const MENU_KEY_FILE_ADD_FOLDER = "file-add-folder" as const;
export const MENU_KEY_FILE_SCAN_QUEUE = "file-scan-queue" as const;

/** RFC 0169: Window 菜单（自定义处理，无 role） */
export const MENU_KEY_WINDOW_MAXIMIZE = "window-maximize" as const;
export const MENU_KEY_WINDOW_CLOSE = "window-close" as const;
