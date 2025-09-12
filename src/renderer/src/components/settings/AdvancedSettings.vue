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

        <!-- 通知系统测试 -->
        <BaseCard title="通知系统测试" class="mt-4">
            <div class="flex gap-2 flex-wrap">
                <BaseButton variant="primary" @click="testSuccessNotification">
                    测试成功通知
                </BaseButton>
                <BaseButton variant="secondary" @click="testInfoNotification">
                    测试信息通知
                </BaseButton>
                <BaseButton variant="secondary" @click="testWarningNotification">
                    测试警告通知
                </BaseButton>
                <BaseButton variant="danger" @click="testErrorNotification">
                    测试错误通知
                </BaseButton>
            </div>
        </BaseCard>
    </div>
</template>

<script setup lang="ts">
import { usePreferenceStore } from "@renderer/stores/preference";
import { themeNotification } from "@renderer/utils/theme-notification";
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

    // 使用主题化通知工具
    themeNotification.success({
        title: t("notification.resetFolders.title") || "重置完成",
        message: t("notification.resetFolders.message") || "所有目录缓存已重建。",
    });
}

/**
 * 测试成功通知
 */
function testSuccessNotification() {
    themeNotification.success({
        title: "操作成功",
        message: "这是一个成功通知的示例，用于测试通知系统是否正常工作。",
        duration: 4000,
    });
}

/**
 * 测试信息通知
 */
function testInfoNotification() {
    themeNotification.info({
        title: "信息提示",
        message: "这是一个信息通知的示例，通常用于显示一般性的提示信息。",
        duration: 4000,
    });
}

/**
 * 测试警告通知
 */
function testWarningNotification() {
    themeNotification.warning({
        title: "警告提示",
        message: "这是一个警告通知的示例，用于提醒用户注意某些重要事项。",
        duration: 5000,
    });
}

/**
 * 测试错误通知
 */
function testErrorNotification() {
    themeNotification.error({
        title: "错误提示",
        message: "这是一个错误通知的示例，用于显示操作失败或系统错误信息。",
        duration: 6000,
    });
}
</script>
