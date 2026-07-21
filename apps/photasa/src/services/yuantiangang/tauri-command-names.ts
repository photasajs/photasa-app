/**
 * Tauri command 名称（功能命名，非神名；仅袁天罡 executeZhaoling 使用）
 */
export const FOLDER_TREE_COMMANDS = {
    UPDATE: "folder_tree_update",
    RESTORE_APP_STATE: "app_state_restore",
} as const;

export const SCAN_QUEUE_COMMANDS = {
    GET: "scan_queue_get",
    ADD: "scan_queue_add_actions",
    REMOVE: "scan_queue_remove_action",
    UPDATE: "scan_queue_update_action_status",
} as const;

export const PREFERENCES_COMMANDS = {
    GET: "preferences_get",
    UPDATE: "preferences_update",
} as const;

/** RFC 0149/0150: shell + menu 直连（不经 zouwu） */
export const SHELL_COMMANDS = {
    OPEN_EXTERNAL: "open_external",
    SHOW_IN_FOLDER: "show_in_folder",
} as const;

export const MENU_COMMANDS = {
    APPLY: "apply_system_menu",
} as const;

/** RFC 0137：文件监视合并批次事件（Rust photasa-watch → 前端） */
export const WATCH_EVENTS = {
    SCAN_QUEUE_ADD: "picasa:add-to-scan-queue",
} as const;
