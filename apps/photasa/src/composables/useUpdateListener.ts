import { onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useUpdateStore } from "@renderer/stores/update";
import { useNotificationStore } from "@renderer/stores/notification";
import { loggers } from "@photasa/common";
import { useYuanTianGang } from "@renderer/composables/useYuanTianGang";

/**
 * 更新事件监听器
 * 监听来自主进程的更新事件并更新状态
 */
export function useUpdateListener() {
    const { t } = useI18n();
    const updateStore = useUpdateStore();
    const notificationStore = useNotificationStore();
    const logger = loggers.update;
    const updates = useYuanTianGang().updates;

    // 监听更新可用事件
    const handleUpdateAvailable = (data: { version: string; info?: unknown }) => {
        logger.info("[UpdateListener] 收到更新可用事件:", data);

        // 显示更新通知
        updateStore.showUpdateNotification(
            data.info as Parameters<typeof updateStore.showUpdateNotification>[0],
        );

        // 显示系统通知
        notificationStore.add({
            title: t("update.notification.title"),
            message: t("update.notification.message", { version: data.version }),
            duration: 5000,
            actions: [
                {
                    text: t("update.notification.viewDetails"),
                    type: "primary",
                    onClick: () => {
                        // 这里可以打开更新设置页面或显示更新弹窗
                        logger.info("用户点击查看详情");
                    },
                },
            ],
        });
    };

    // 监听下载进度事件
    const handleDownloadProgress = (progress: number) => {
        logger.info("[UpdateListener] 下载进度:", progress);
        updateStore.updateDownloadProgress(progress);
    };

    // 监听下载完成事件
    const handleDownloadComplete = (info: any) => {
        logger.info("[UpdateListener] 下载完成:", info);
        updateStore.completeDownload();
    };

    // 监听状态变化事件
    const handleStatusChanged = (status: any) => {
        logger.info("[UpdateListener] 状态变化:", status);
        // 可以根据需要处理状态变化
    };

    // 存储清理函数
    let cleanupFunctions: (() => void)[] = [];

    // 注册事件监听器
    let active = false;
    const registerListeners = async () => {
        const cleanups = await Promise.all([
            updates.onAvailable(handleUpdateAvailable),
            updates.onProgress(handleDownloadProgress),
            updates.onDownloaded(handleDownloadComplete),
            updates.onStatus(handleStatusChanged),
        ]);
        if (!active) {
            cleanups.forEach((cleanup) => cleanup());
            return;
        }
        cleanupFunctions.push(...cleanups);
    };

    // 移除事件监听器
    const removeListeners = () => {
        cleanupFunctions.forEach((cleanup) => cleanup());
        cleanupFunctions = [];
    };

    onMounted(() => {
        active = true;
        void registerListeners();
    });

    onUnmounted(() => {
        active = false;
        removeListeners();
    });

    return {
        updateStore,
        notificationStore,
    };
}
