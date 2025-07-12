<template>
    <div>
        <BaseCard :title="t('advancedSettings.title')">
            <BaseAlert
                type="error"
                :show-icon="true"
                :message="t('advancedSettings.resetFoldersTitle')"
                :description="t('advancedSettings.resetFoldersDesc')"
                class="mb-4"
            />
            <BaseButton variant="danger" @click="onResetFolders">{{
                t("advancedSettings.resetFoldersBtn")
            }}</BaseButton>
        </BaseCard>
    </div>
</template>

<script setup lang="ts">
import { usePreferenceStore } from "@renderer/stores/preference";
import { notification } from "ant-design-vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { BaseButton, BaseCard, BaseAlert } from "@renderer/components/ui";

// 获取多语言方法
const { t } = useI18n();

// 获取 Pinia store
const preferenceStore = usePreferenceStore();
const paths = computed(() => preferenceStore.paths);

/**
 * 重置所有目录存储
 * 1. 清空 paths、folderTree、scanningFolder
 * 2. 遍历当前已添加目录，逐一重建缓存
 * 3. 操作完成后弹窗提示
 */
async function onResetFolders() {
    await preferenceStore.resetAllFolders([...paths.value]);
    notification.success({
        message: t("notification.resetFolders.title") || "重置完成",
        description: t("notification.resetFolders.message") || "所有目录缓存已重建。",
    });
}
</script>
