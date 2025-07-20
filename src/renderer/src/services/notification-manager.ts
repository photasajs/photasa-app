import { useNotificationStore } from "@renderer/stores/notification";
import type { NotificationConfig } from "@renderer/types/notification";

/**
 * 获取通知存储实例
 */
function getNotificationStore() {
    return useNotificationStore();
}

/**
 * 显示成功通知
 */
function success(config: string | Omit<NotificationConfig, "type">): string {
    const normalizedConfig = typeof config === "string" ? { message: config } : config;
    return getNotificationStore().success(normalizedConfig);
}

/**
 * 显示错误通知
 */
function error(config: string | Omit<NotificationConfig, "type">): string {
    const normalizedConfig = typeof config === "string" ? { message: config } : config;
    return getNotificationStore().error(normalizedConfig);
}

/**
 * 显示警告通知
 */
function warning(config: string | Omit<NotificationConfig, "type">): string {
    const normalizedConfig = typeof config === "string" ? { message: config } : config;
    return getNotificationStore().warning(normalizedConfig);
}

/**
 * 显示信息通知
 */
function info(config: string | Omit<NotificationConfig, "type">): string {
    const normalizedConfig = typeof config === "string" ? { message: config } : config;
    return getNotificationStore().info(normalizedConfig);
}

/**
 * 移除指定通知
 */
function remove(id: string): void {
    getNotificationStore().remove(id);
}

/**
 * 清空所有通知
 */
function clear(): void {
    getNotificationStore().clear();
}

// 导出通知对象
export const notification = {
    success,
    error,
    warning,
    info,
    remove,
    clear,
};
