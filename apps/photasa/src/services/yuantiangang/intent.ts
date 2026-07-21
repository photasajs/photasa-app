import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";

// 符箓意图到天枢UserIntent的映射（使用ZOUZHE_MATTERS常量值）
export const IntentToFuluMapping: Record<string, string> = {
    [ZOUZHE_MATTERS.NOTIFICATION_SHOW]: "get_status",
    [ZOUZHE_MATTERS.PHOTO_SWITCH]: "scan_folder",
    [ZOUZHE_MATTERS.SCAN_FOLDER]: "scan_folder",
    [ZOUZHE_MATTERS.GET_STATUS]: "get_status",
    // RFC 0147: preference matters 由袁天罡 executeZhaoling 直连，不在此映射
    // RFC 0145: UPDATE_FOLDER_TREE / RESTORE_APP_STATE 由袁天罡 executeZhaoling 直连，不在此映射
    // ✅ RFC 0042 Phase 2.4: 扫描队列管理映射
    [ZOUZHE_MATTERS.GET_SCANNING_QUEUE]: "get_scanning_queue",
    [ZOUZHE_MATTERS.ADD_SCAN_ACTION]: "add_scan_action",
    [ZOUZHE_MATTERS.REMOVE_SCAN_ACTION]: "remove_scan_action",
    // ✅ RFC 0048 v3 Phase 3: 扫描任务状态更新映射
    [ZOUZHE_MATTERS.UPDATE_SCAN_ACTION_STATUS]: "update_scan_action_status",
    // RFC 0145: UPDATE_FOLDER_TREE / RESTORE_APP_STATE 由袁天罡 executeZhaoling 直连，不在此映射
    [ZOUZHE_MATTERS.SWITCH_FOLDER]: "switch_current_folder",
    // ✅ RFC 0058: 菜单更新映射
    [ZOUZHE_MATTERS.UPDATE_MENU]: "menu_apply",
    // ✅ RFC 0058: Shell 操作映射
    [ZOUZHE_MATTERS.OPEN_EXTERNAL]: "shell_openExternal",
    [ZOUZHE_MATTERS.OPEN_IN_FINDER]: "shell_openInFinder",
};
