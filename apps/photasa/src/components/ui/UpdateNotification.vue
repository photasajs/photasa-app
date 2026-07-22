<template>
    <BaseNotification :notification="notificationData" @close="handleClose">
        <!-- 自定义内容插槽 -->
        <template #content>
            <div class="update-notification-content">
                <!-- 标题 -->
                <div class="update-title">
                    {{ t("update.notification.title") }}
                </div>

                <!-- 消息 -->
                <div class="update-message">
                    {{ t("update.notification.message", { version: updateInfo?.version }) }}
                </div>

                <!-- 进度条 -->
                <div v-if="isDownloading" class="update-progress">
                    <BaseProgress :percent="downloadProgress" :show-text="true" size="small" />
                </div>

                <!-- 操作按钮 -->
                <div class="update-actions">
                    <BaseButton
                        v-if="!isDownloading"
                        variant="secondary"
                        size="sm"
                        @click="handleCancel"
                    >
                        {{ t("update.notification.cancel") }}
                    </BaseButton>

                    <BaseButton
                        v-if="!isDownloading"
                        variant="primary"
                        size="sm"
                        @click="handleInstall"
                    >
                        {{ t("update.notification.install") }}
                    </BaseButton>

                    <BaseButton
                        v-if="isDownloading"
                        variant="secondary"
                        size="sm"
                        @click="handleCancelDownload"
                    >
                        {{ t("update.notification.cancelDownload") }}
                    </BaseButton>

                    <BaseButton
                        v-if="isReadyToInstall"
                        variant="primary"
                        size="sm"
                        @click="handleInstallNow"
                    >
                        {{ t("update.notification.installNow") }}
                    </BaseButton>
                </div>
            </div>
        </template>
    </BaseNotification>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { BaseNotification, BaseButton, BaseProgress } from "@renderer/components/ui";
import type { NotificationItem } from "@renderer/types/notification";
import type { UpdateInfo } from "legacy auto-updater";

interface Props {
    /** 更新信息 */
    updateInfo?: UpdateInfo | null;
    /** 下载进度 */
    downloadProgress?: number;
    /** 是否正在下载 */
    isDownloading?: boolean;
    /** 是否准备安装 */
    isReadyToInstall?: boolean;
    /** 通知ID */
    id: string;
}

interface Emits {
    /** 关闭通知 */
    (e: "close", id: string): void;
    /** 取消更新 */
    (e: "cancel"): void;
    /** 开始安装 */
    (e: "install"): void;
    /** 取消下载 */
    (e: "cancelDownload"): void;
    /** 立即安装 */
    (e: "installNow"): void;
}

const props = withDefaults(defineProps<Props>(), {
    updateInfo: null,
    downloadProgress: 0,
    isDownloading: false,
    isReadyToInstall: false,
});

const emit = defineEmits<Emits>();
const { t } = useI18n();

// 构建通知数据
const notificationData = computed<NotificationItem>(() => ({
    id: props.id,
    type: "info",
    title: t("update.notification.title"),
    message: t("update.notification.message", { version: props.updateInfo?.version }),
    duration: 0, // 不自动关闭
    className: "update-notification",
    actions: [], // 使用自定义内容，不使用默认actions
    timestamp: Date.now(),
    visible: true,
    closable: true,
    key: props.id,
}));

// 处理关闭
const handleClose = (id: string) => {
    emit("close", id);
};

// 处理取消
const handleCancel = () => {
    emit("cancel");
};

// 处理安装
const handleInstall = () => {
    emit("install");
};

// 处理取消下载
const handleCancelDownload = () => {
    emit("cancelDownload");
};

// 处理立即安装
const handleInstallNow = () => {
    emit("installNow");
};
</script>

<style scoped>
.update-notification-content {
    width: 100%;
}

.update-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 8px;
}

.update-message {
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.4;
    margin-bottom: 16px;
}

.update-progress {
    margin-bottom: 16px;
}

.update-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

/* 响应式设计 */
@media (max-width: 480px) {
    .update-actions {
        flex-direction: column;
    }

    .update-actions .base-button {
        width: 100%;
    }
}
</style>
