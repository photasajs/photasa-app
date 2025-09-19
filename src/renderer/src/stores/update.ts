import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useNotificationStore } from "./notification";
import type { UpdateInfo } from "electron-updater";

export const useUpdateStore = defineStore("update", () => {
    // 状态
    const updateInfo = ref<UpdateInfo | null>(null);
    const isChecking = ref(false);
    const isDownloading = ref(false);
    const downloadProgress = ref(0);
    const isReadyToInstall = ref(false);
    const updateError = ref<string | null>(null);

    // 通知store和i18n
    const notificationStore = useNotificationStore();
    const { t } = useI18n();

    // 计算属性
    const hasUpdate = computed(() => updateInfo.value !== null);
    const canInstall = computed(() => isReadyToInstall.value);
    const canDownload = computed(
        () => hasUpdate.value && !isDownloading.value && !isReadyToInstall.value,
    );

    // 显示更新通知
    const showUpdateNotification = (info: UpdateInfo) => {
        updateInfo.value = info;

        const notificationId = `update-${Date.now()}`;

        notificationStore.add({
            title: t("update.notification.title"),
            message: t("update.notification.message", { version: info.version }),
            duration: 0, // 不自动关闭
            className: "update-notification",
            actions: [], // 使用自定义内容
            key: notificationId,
        });
    };

    // 隐藏更新通知
    const hideUpdateNotification = () => {
        updateInfo.value = null;
        // 移除所有更新通知
        const updateNotifications = notificationStore.notifications.filter((n) =>
            n.className?.includes("update-notification"),
        );
        updateNotifications.forEach((n) => notificationStore.remove(n.id));
    };

    // 开始下载
    const startDownload = () => {
        isDownloading.value = true;
        downloadProgress.value = 0;
        updateError.value = null;
    };

    // 更新下载进度
    const updateDownloadProgress = (progress: number) => {
        downloadProgress.value = progress;
    };

    // 完成下载
    const completeDownload = () => {
        isDownloading.value = false;
        isReadyToInstall.value = true;
        downloadProgress.value = 100;
    };

    // 取消下载
    const cancelDownload = () => {
        isDownloading.value = false;
        downloadProgress.value = 0;
        isReadyToInstall.value = false;
    };

    // 重置状态
    const reset = () => {
        updateInfo.value = null;
        isChecking.value = false;
        isDownloading.value = false;
        downloadProgress.value = 0;
        isReadyToInstall.value = false;
        updateError.value = null;
    };

    // 设置错误
    const setError = (error: string) => {
        updateError.value = error;
        isChecking.value = false;
        isDownloading.value = false;
    };

    return {
        // 状态
        updateInfo,
        isChecking,
        isDownloading,
        downloadProgress,
        isReadyToInstall,
        updateError,

        // 计算属性
        hasUpdate,
        canInstall,
        canDownload,

        // 方法
        showUpdateNotification,
        hideUpdateNotification,
        startDownload,
        updateDownloadProgress,
        completeDownload,
        cancelDownload,
        reset,
        setError,
    };
});
