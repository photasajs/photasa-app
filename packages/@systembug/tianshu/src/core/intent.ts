import type { UserIntent } from "../types/commands";

/**
 * description
 */
export const IntentToWorkflowMap: Record<UserIntent, string> = {
    scan_folder: "folder_scan",
    scan_file: "file_scan",
    update_config: "preference_management",
    generate_thumbnail: "generate_thumbnail",
    process_media: "process_media",
    stop_operation: "stop_operation",
    get_status: "engine_status_check",
    get_preferences: "get_preferences",
    update_preferences: "update_preferences",
    get_scanning_queue: "get_scanning_queue", // ✅ RFC 0042 Phase 2.3: 获取扫描队列
    add_scan_action: "add_scan_action", // ✅ RFC 0042 Phase 2.4: 添加扫描任务workflow
    remove_scan_action: "remove_scan_action", // ✅ RFC 0042 Phase 2.4: 移除扫描任务workflow
    update_scan_action_status: "update_scan_action_status", // ✅ RFC 0048 v3: 状态机更新workflow
    restore_app_state: "restore_app_state", // ✅ RFC 0042 Step 2.5: 应用状态管理workflow
    update_folder_tree: "update_folder_tree", // ✅ RFC 0042 Step 2.5: 文件夹树管理workflow
    switch_current_folder: "switch_current_folder", // ✅ RFC 0042 Step 2.5: 当前文件夹管理workflow
    "menu.apply": "menu_apply", // ✅ RFC 0058: 菜单应用workflow
    "shell.openExternal": "shell.openExternal", // ✅ RFC 0058: 打开外部链接workflow
    "shell.openInFinder": "shell.openInFinder", // ✅ RFC 0058: 在 Finder 中显示文件workflow
};
