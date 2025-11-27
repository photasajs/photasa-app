import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";

// 符箓意图到天枢UserIntent的映射（使用ZOUZHE_MATTERS常量值）
export const IntentToFuluMapping: Record<string, string> = {
    [ZOUZHE_MATTERS.THEME_CHANGE]: "update_preferences", // 修正：使用天枢实际工作流
    [ZOUZHE_MATTERS.LANGUAGE_CHANGE]: "update_preferences", // 修正：使用天枢实际工作流
    [ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE]: "update_preferences", // 缩略图大小变更
    [ZOUZHE_MATTERS.ADD_PATH]: "update_preferences", // 添加路径操作
    [ZOUZHE_MATTERS.REMOVE_PATH]: "update_preferences", // 移除路径操作
    [ZOUZHE_MATTERS.ADD_SCAN_FOLDER]: "update_preferences", // 添加扫描文件夹操作
    [ZOUZHE_MATTERS.NOTIFICATION_SHOW]: "get_status",
    [ZOUZHE_MATTERS.PHOTO_SWITCH]: "scan_folder",
    [ZOUZHE_MATTERS.GET_PREFERENCES]: "get_preferences", // 使用天枢实际工作流
    [ZOUZHE_MATTERS.SCAN_FOLDER]: "scan_folder",
    [ZOUZHE_MATTERS.UPDATE_PREFERENCES]: "update_preferences", // 添加直接映射
    [ZOUZHE_MATTERS.GET_STATUS]: "get_status",
    // ✅ RFC 0042 Phase 2.4: 扫描队列管理映射
    [ZOUZHE_MATTERS.GET_SCANNING_QUEUE]: "get_scanning_queue",
    [ZOUZHE_MATTERS.ADD_SCAN_ACTION]: "add_scan_action",
    [ZOUZHE_MATTERS.REMOVE_SCAN_ACTION]: "remove_scan_action",
    // ✅ RFC 0048 v3 Phase 3: 扫描任务状态更新映射
    [ZOUZHE_MATTERS.UPDATE_SCAN_ACTION_STATUS]: "update_scan_action_status",
    // ✅ RFC 0042 Step 2.5: appState管理映射
    [ZOUZHE_MATTERS.RESTORE_APP_STATE]: "restore_app_state",
    [ZOUZHE_MATTERS.UPDATE_FOLDER_TREE]: "update_folder_tree",
    [ZOUZHE_MATTERS.SWITCH_FOLDER]: "switch_current_folder",
};
