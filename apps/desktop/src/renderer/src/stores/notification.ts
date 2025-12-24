import { defineStore } from "pinia";
import { ref } from "vue";
import type { NotificationConfig, NotificationItem } from "@renderer/types/notification";
import { loggers } from "@common/logger";
const logger = loggers.fangxuanling;

/**
 * 通知状态管理
 */
export const useNotificationStore = defineStore("notification", () => {
    // 通知列表
    const notifications = ref<NotificationItem[]>([]);

    // 通知ID计数器
    let notificationIdCounter = 0;

    /**
     * 生成唯一的通知ID
     */
    const generateId = (): string => {
        logger.info("📋 生成通知ID", notificationIdCounter);
        return `notification-${++notificationIdCounter}-${Date.now()}`;
    };

    /**
     * 添加通知
     */
    const add = (config: NotificationConfig): string => {
        logger.info("📋 添加通知", config);
        const id = config.key || generateId();

        // 如果指定了key，先移除已存在的同key通知
        if (config.key) {
            remove(config.key);
        }

        const notification: NotificationItem = {
            id,
            title: config.title || "",
            message: config.message,
            type: config.type || "info",
            duration: config.duration ?? 4000,
            closable: config.closable ?? true,
            actions: config.actions || [],
            className: config.className || "",
            timestamp: Date.now(),
            visible: true,
            key: config.key || id,
        };

        notifications.value.push(notification);

        return id;
    };

    /**
     * 移除通知
     */
    const remove = (id: string): void => {
        logger.info("📋 移除通知", id);
        const index = notifications.value.findIndex((n) => n.id === id);
        if (index > -1) {
            notifications.value.splice(index, 1);
        }
    };

    /**
     * 清空所有通知
     */
    const clear = (): void => {
        notifications.value = [];
    };

    /**
     * 显示成功通知
     */
    const success = (config: Omit<NotificationConfig, "type">): string => {
        logger.info("📋 显示成功通知", config);
        return add({ ...config, type: "success" });
    };

    /**
     * 显示错误通知
     */
    const error = (config: Omit<NotificationConfig, "type">): string => {
        logger.info("📋 显示错误通知", config);
        return add({ ...config, type: "error" });
    };

    /**
     * 显示警告通知
     */
    const warning = (config: Omit<NotificationConfig, "type">): string => {
        logger.info("📋 显示警告通知", config);
        return add({ ...config, type: "warning" });
    };

    /**
     * 显示信息通知
     */
    const info = (config: Omit<NotificationConfig, "type">): string => {
        logger.info("📋 显示信息通知", config);
        return add({ ...config, type: "info" });
    };

    return {
        notifications,
        add,
        remove,
        clear,
        success,
        error,
        warning,
        info,
    };
});
