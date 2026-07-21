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
