<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { chooseDirectory } from "@renderer/utils/api";
import { PhFolder as FolderTwoTone, PhX as CloseOutlined } from "@phosphor-icons/vue";
import { notification } from "@renderer/services/notification-manager";
import { BaseButton, BaseSpace } from "@renderer/components/ui";
import { useChuSuiLiang } from "@renderer/composables/useChuSuiLiang";
import {
    validateAndNormalizePath,
    checkPathDuplication,
    isPathSafe,
    detectPathType,
} from "@renderer/services/chusuiliang/path-utils";
import { loggers } from "@common/logger";

const logger = loggers.lishimin;

/**
 * 通用设置组件 - 褚遂良中书令
 * 为人界界面提供通用设置功能，实现依赖注入模式
 *
 * 神话背景：
 * 褚遂良，唐朝著名书法家、政治家
 * 在Photasa系统中，褚遂良化身人界界面通用设置管理员
 * 通过民间Vue技术，为人界界面提供通用设置功能
 * 与房玄龄宰相协作，确保界面设置与用户偏好保持一致
 */
const chuSuiLiang = useChuSuiLiang();

/**
 * 通用设置组件
 */
defineOptions({
    name: "GeneralSettings",
});

const { t } = useI18n();

// 使用统一的褚遂良服务管理路径
const paths = computed(() => chuSuiLiang.paths);

// 使用computed创建双向绑定的getter/setter
const thumbnailSize = computed({
    get: () => chuSuiLiang.thumbnailSize,
    set: (value: number) => {
        chuSuiLiang.thumbnailSize = value;
    },
});

const label = computed(() => {
    return {
        chooseDirectory: t("preference.chooseDirectory"),
        thumbnailSize: t("preference.thumbnailSize"),
        folderList: t("preference.folderList"),
        folderListUsage: t("preference.folderListUsage"),
        folderListDesc: t("preference.folderListDesc"),
        language: t("preference.language"),
    };
});

function isDuplicate(path: string): boolean {
    // 使用统一路径处理检查重复
    const duplicationResult = checkPathDuplication(path, paths.value);
    return duplicationResult.isDuplicate;
}

async function onChoose(): Promise<void> {
    try {
        const { filePaths } = await chooseDirectory();
        if (!filePaths || filePaths.length === 0) {
            notification.info({
                title: t("notification.emptyPath.title"),
                message: t("notification.emptyPath.message"),
            });
            return;
        }
        const path = filePaths[0];

        // 使用统一路径验证和规范化
        const validationResult = validateAndNormalizePath(path);
        if (!validationResult.isValid) {
            notification.error({
                title: t("notification.invalidPath.title"),
                message: t("notification.invalidPath.message", {
                    folder: path,
                    error: validationResult.error,
                }),
            });
            return;
        }

        // 检查路径安全性
        if (!isPathSafe(validationResult.normalizedPath)) {
            notification.error({
                title: t("notification.unsafePath.title"),
                message: t("notification.unsafePath.message", { folder: path }),
            });
            return;
        }

        // 检查路径重复（使用规范化路径）
        if (isDuplicate(path)) {
            notification.warning({
                title: t("notification.duplicatePath.title"),
                message: t("notification.duplicatePath.message", {
                    folder: validationResult.normalizedPath,
                }),
            });
            return;
        }

        // 显示路径类型信息
        const pathType = detectPathType(path);
        logger.debug("📝 选择的路径类型信息", {
            original: path,
            normalized: validationResult.normalizedPath,
            type: pathType.type,
            platform: pathType.platform,
            hasUrlEncoding: pathType.hasUrlEncoding,
        });

        // ✅ RFC 0042: 使用ChuSuiLiang服务添加路径
        // 添加到 watched folder list 后，李世民路由会自动触发尉迟恭添加扫描任务
        // UI层不再负责子文件夹扫描和批量添加扫描任务（后端职责）
        await chuSuiLiang.addPath(path);
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : t("notification.unknownError");
        notification.error({
            title: t("notification.error"),
            message: errorMessage,
        });
    }
}

async function handleRemove(item: string): Promise<void> {
    await chuSuiLiang.removePath(item);
}
</script>

<template>
    <div class="settings-content settings-container">
        <div class="setting-section">
            <label class="setting-label">{{ t("preference.watchFolderList") }}</label>
            <BaseSpace direction="vertical">
                <div class="import-message-list">
                    <div class="list-header">
                        <div class="list-header-title">{{ label.folderList }}</div>
                        <div class="list-header-description">
                            <span class="list-header-label">{{ label.folderListUsage }}:</span>
                            <span class="list-header-content">{{ label.folderListDesc }}</span>
                        </div>
                    </div>
                    <div class="list-content">
                        <div v-for="item in paths" :key="item" class="list-item">
                            <div class="list-item-avatar">
                                <folder-two-tone />
                            </div>
                            <div class="list-item-title">
                                {{ item }}
                            </div>
                            <div class="list-item-actions">
                                <BaseButton @click="handleRemove(item)"
                                    ><close-outlined
                                /></BaseButton>
                            </div>
                        </div>
                    </div>
                </div>
                <BaseButton type="primary" @click="onChoose">{{
                    label.chooseDirectory
                }}</BaseButton>
            </BaseSpace>
        </div>
        <div class="setting-section">
            <label class="setting-label">{{ `${label.thumbnailSize} : ${thumbnailSize}px` }}</label>
            <div class="custom-slider-container">
                <input
                    type="range"
                    v-model="thumbnailSize"
                    :min="150"
                    :max="400"
                    class="custom-slider"
                />
            </div>
        </div>
    </div>
</template>

<style scoped lang="less">
.settings-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.setting-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.setting-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, rgba(0, 0, 0, 0.85));
    margin-bottom: 8px;
}

.import-message-list {
    border: 1px solid var(--color-list-border, var(--color-border, #d9d9d9));
    border-radius: 6px;
    background: var(--color-list-bg, var(--color-bg, #ffffff));
    height: 300px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.list-header {
    padding: 16px 24px;
    border-bottom: 1px solid var(--color-list-split, var(--color-border, #f0f0f0));
    background: var(--color-list-header-bg, var(--color-bg-secondary, #fafafa));
}

.list-header-title {
    font-size: 16px;
    font-weight: 500;
    color: var(--color-descriptions-title, var(--color-text, rgba(0, 0, 0, 0.85)));
    margin-bottom: 8px;
}

.list-header-description {
    font-size: 14px;
    color: var(--color-text-secondary, rgba(0, 0, 0, 0.65));
    line-height: 1.5715;
}

.list-header-label {
    font-weight: 500;
    margin-right: 4px;
}

.list-header-content {
    color: var(--color-text-secondary, rgba(0, 0, 0, 0.45));
}

.list-content {
    flex: 1;
    overflow-y: auto;
}

.list-item {
    padding: 12px 24px;
    border-bottom: 1px solid var(--color-list-split, var(--color-border, #f0f0f0));
    display: flex;
    align-items: center;
    min-height: 48px;
    transition: background-color 0.3s;
    background: var(--color-list-item-bg, var(--color-bg, #ffffff));
}

.list-item:last-child {
    border-bottom: none;
}

.list-item:hover {
    background-color: var(--color-list-item-hover-bg, var(--color-bg-secondary, #fafafa));
}

.list-item-avatar {
    color: var(--color-primary, #1890ff);
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin-right: 12px;
    flex-shrink: 0;
}

.list-item-title {
    flex: 1;
    font-size: 14px;
    color: var(--color-list-item-meta-title, var(--color-text, rgba(0, 0, 0, 0.85)));
    line-height: 1.5715;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.list-item-actions {
    display: flex;
    align-items: center;
    margin-left: 12px;
    flex-shrink: 0;
}

.list-item-actions .base-button {
    padding: 4px;
    height: 24px;
    width: 24px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(
        --color-list-item-meta-description,
        var(--color-text-secondary, rgba(0, 0, 0, 0.45))
    );
    transition: all 0.3s;
}

.list-item-actions .base-button:hover {
    background-color: var(
        --color-list-item-hover-bg,
        var(--color-fill-quaternary, rgba(0, 0, 0, 0.06))
    );
    color: var(--color-list-item-meta-title, var(--color-text, rgba(0, 0, 0, 0.85)));
}

.custom-slider-container {
    padding: 8px 0;
}

.custom-slider {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: var(--color-border, #f0f0f0);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
}

.custom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-primary, #1890ff);
    cursor: pointer;
    border: 2px solid var(--color-bg, #fff);
    box-shadow: 0 2px 4px var(--color-shadow, rgba(0, 0, 0, 0.2));
}

.custom-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-primary, #1890ff);
    cursor: pointer;
    border: 2px solid var(--color-bg, #fff);
    box-shadow: 0 2px 4px var(--color-shadow, rgba(0, 0, 0, 0.2));
}

.custom-slider::-webkit-slider-track {
    height: 4px;
    border-radius: 2px;
    background: var(--color-border, #f0f0f0);
}

.custom-slider::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: var(--color-border, #f0f0f0);
}
</style>
