import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";

/**
 * 符箓意图到天枢 UserIntent 的映射（遗留 zouwu 路径）
 *
 * RFC 0137/0139/0153：贞观各域已迁出 zouwu；未直连 matter 在 executeZhaoling 末尾明确失败。
 */
export const IntentToFuluMapping: Record<string, string> = {
    // 已退场域（直连 invoke，不在此映射）：
    // preference → 0147
    // scan queue → 0136/0143
    // folder tree / app state → 0145
    // shell / menu → 0150
    // switch_folder → 0137
    // folder config / scan_photos → 0142
};

/** 曾走 zouwu、现已直连的 matter（用于测试断言零映射） */
export const RETIRED_ZOUWU_MATTERS = [
    ZOUZHE_MATTERS.NOTIFICATION_SHOW,
    ZOUZHE_MATTERS.PHOTO_SWITCH,
    ZOUZHE_MATTERS.SCAN_FOLDER,
    ZOUZHE_MATTERS.GET_STATUS,
    ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
    ZOUZHE_MATTERS.ADD_SCAN_ACTION,
    ZOUZHE_MATTERS.REMOVE_SCAN_ACTION,
    ZOUZHE_MATTERS.UPDATE_SCAN_ACTION_STATUS,
    ZOUZHE_MATTERS.SWITCH_FOLDER,
    ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
    ZOUZHE_MATTERS.RESTORE_APP_STATE,
    ZOUZHE_MATTERS.UPDATE_MENU,
    ZOUZHE_MATTERS.OPEN_EXTERNAL,
    ZOUZHE_MATTERS.OPEN_IN_FINDER,
] as const;
