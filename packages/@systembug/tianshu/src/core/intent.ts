import type { UserIntent } from "../types/commands";

/**
 * description
 */
export const IntentToWorkflowMap: Record<UserIntent, string> = {
    scan_folder: "scan/folder_scan",
    scan_file: "scan/file_scan",
    update_config: "preference/preference_management",
    generate_thumbnail: "media/generate_thumbnail",
    process_media: "media/process_media",
    stop_operation: "system/stop_operation",
    get_status: "engine/engine_status_check",
    get_preferences: "get_preferences", // 修正：直接映射到工作流ID
    update_preferences: "update_preferences", // 修正：直接映射到工作流ID
    get_scanning_queue: "scan/get_scanning_queue", // ✅ RFC 0042 Phase 2.3: 获取扫描队列
    add_scan_action: "scan/add_scan_action", // ✅ RFC 0042 Phase 2.4: 添加扫描任务workflow
    remove_scan_action: "scan/remove_scan_action", // ✅ RFC 0042 Phase 2.4: 移除扫描任务workflow
    update_scan_action_status: "scan/update_scan_action_status", // ✅ RFC 0048 v3: 状态机更新workflow
    restore_app_state: "appstate/restore_app_state", // ✅ RFC 0042 Step 2.5: 应用状态管理workflow
    update_folder_tree: "appstate/update_folder_tree", // ✅ RFC 0042 Step 2.5: 文件夹树管理workflow
    switch_current_folder: "appstate/switch_current_folder", // ✅ RFC 0042 Step 2.5: 当前文件夹管理workflow
    "menu.apply": "menu/menu_apply", // ✅ RFC 0058: 菜单应用workflow
    "shell.openExternal": "shell/shell_open_external", // ✅ RFC 0058: 打开外部链接workflow
    "shell.openInFinder": "shell/shell_open_in_finder", // ✅ RFC 0058: 在 Finder 中显示文件workflow
};
