<template>
    <div>
        <a-card :title="t('advancedSettings.title')">
            <a-alert
                type="error"
                show-icon
                :message="t('advancedSettings.resetFoldersTitle')"
                :description="t('advancedSettings.resetFoldersDesc')"
                style="margin-bottom: 16px; color: red"
            />
            <a-button type="danger" @click="onResetFolders">{{
                t("advancedSettings.resetFoldersBtn")
            }}</a-button>
        </a-card>
    </div>
</template>

<script setup lang="ts">
import { usePreferenceStore } from "@renderer/stores/preference";
import { notification } from "ant-design-vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

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

<!--
单元测试建议：
- mock preferenceStore.resetAllFolders，断言被正确调用
- mock notification.success，断言提示内容
-->
