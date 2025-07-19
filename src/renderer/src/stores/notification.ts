import { defineStore } from "pinia";
import { ref } from "vue";
import type { NotificationConfig, NotificationItem } from "@renderer/types/notification";

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
        return `notification-${++notificationIdCounter}-${Date.now()}`;
    };

    /**
     * 添加通知
     */
    const add = (config: NotificationConfig): string => {
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
        };

        notifications.value.push(notification);

        return id;
    };

    /**
     * 移除通知
     */
    const remove = (id: string): void => {
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
        return add({ ...config, type: "success" });
    };

    /**
     * 显示错误通知
     */
    const error = (config: Omit<NotificationConfig, "type">): string => {
        return add({ ...config, type: "error" });
    };

    /**
     * 显示警告通知
     */
    const warning = (config: Omit<NotificationConfig, "type">): string => {
        return add({ ...config, type: "warning" });
    };

    /**
     * 显示信息通知
     */
    const info = (config: Omit<NotificationConfig, "type">): string => {
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
