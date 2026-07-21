/**
 * 奏折 context → preference delta 纯函数（无 invoke，仅袁天罡调用前转换）
 */
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";

export function buildPreferencesDelta(
    command: string,
    context: Record<string, unknown>,
): Record<string, unknown> {
    if (command === ZOUZHE_MATTERS.THEME_CHANGE && context.themeId) {
        return { ui: { theme: context.themeId } };
    }
    if (command === ZOUZHE_MATTERS.LANGUAGE_CHANGE && context.locale) {
        return { ui: { language: context.locale } };
    }
    if (command === ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE && context.size !== undefined) {
        return { display: { thumbnailSize: context.size } };
    }
    if (
        command === ZOUZHE_MATTERS.ADD_PATH ||
        command === ZOUZHE_MATTERS.REMOVE_PATH ||
        command === ZOUZHE_MATTERS.ADD_SCAN_FOLDER ||
        command === ZOUZHE_MATTERS.UPDATE_PREFERENCES
    ) {
        const { path: _path, ...delta } = context;
        if (delta.scanning) {
            return { scanning: delta.scanning };
        }
        return delta;
    }
    return context;
}

/** 贞观 preference matter 集合（袁天罡 executeZhaoling 直连，不经 zouwu） */
export const PREFERENCE_ZHAOLING_MATTERS = new Set<string>([
    ZOUZHE_MATTERS.THEME_CHANGE,
    ZOUZHE_MATTERS.LANGUAGE_CHANGE,
    ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE,
    ZOUZHE_MATTERS.ADD_PATH,
    ZOUZHE_MATTERS.REMOVE_PATH,
    ZOUZHE_MATTERS.ADD_SCAN_FOLDER,
    ZOUZHE_MATTERS.UPDATE_PREFERENCES,
    ZOUZHE_MATTERS.GET_PREFERENCES,
]);
