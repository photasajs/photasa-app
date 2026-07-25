/** ImageList 悬停操作栏动作 ID */
export const IMAGE_HOVER_ACTION = {
    DETAIL: "detail",
    REBUILD: "rebuild",
    OPEN_IN_FINDER: "openInFinder",
} as const;

export type ImageHoverActionId = (typeof IMAGE_HOVER_ACTION)[keyof typeof IMAGE_HOVER_ACTION];

/** 悬停操作栏 i18n 键 */
export const IMAGE_HOVER_I18N_KEY: Record<ImageHoverActionId, string> = {
    [IMAGE_HOVER_ACTION.DETAIL]: "menu.getInfo",
    [IMAGE_HOVER_ACTION.REBUILD]: "menu.rebuildThumbnail",
    [IMAGE_HOVER_ACTION.OPEN_IN_FINDER]: "menu.open",
};

/** 悬停操作栏测试 ID */
export const IMAGE_HOVER_TEST_ID: Record<ImageHoverActionId, string> = {
    [IMAGE_HOVER_ACTION.DETAIL]: "image-hover-detail-button",
    [IMAGE_HOVER_ACTION.REBUILD]: "rebuild-thumbnail-button",
    [IMAGE_HOVER_ACTION.OPEN_IN_FINDER]: "image-hover-open-button",
};
