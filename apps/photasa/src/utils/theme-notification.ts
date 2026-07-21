import { notification } from "@renderer/services/notification-manager";
import type { NotificationConfig } from "@renderer/types/notification";

/**
 * 获取当前主题的颜色变量
 * @returns 包含主题颜色的对象
 */
export function getThemeColors() {
    const root = document.documentElement;
    const style = getComputedStyle(root);

    return {
        primary: style.getPropertyValue("--color-primary").trim(),
        text: style.getPropertyValue("--color-text").trim(),
        background: style.getPropertyValue("--color-card-bg").trim(),
        border: style.getPropertyValue("--color-card-border").trim(),
        success: style.getPropertyValue("--color-success").trim(),
        warning: style.getPropertyValue("--color-warning").trim(),
        danger: style.getPropertyValue("--color-danger").trim(),
        info: style.getPropertyValue("--color-info").trim(),
    };
}

/**
 * 显示主题兼容的通知
 * 这个工具函数确保通知样式与当前主题保持一致
 */
export function showThemeNotification(
    type: "success" | "info" | "warning" | "error",
    message: string,
    title?: string,
) {
    // 使用我们的自定义通知系统
    // 通知会自动适应当前主题的 CSS 变量
    notification[type]({
        message,
        title,
        duration: 4500,
    });
}

/**
 * 主题化的通知工具
 */
export const themeNotification = {
    /**
     * 显示成功通知
     * @param config 通知配置或消息字符串
     */
    success(config: NotificationConfig | string) {
        const normalizedConfig = typeof config === "string" ? { message: config } : config;
        notification.success(normalizedConfig);
    },

    /**
     * 显示错误通知
     * @param config 通知配置或消息字符串
     */
    error(config: NotificationConfig | string) {
        const normalizedConfig = typeof config === "string" ? { message: config } : config;
        notification.error(normalizedConfig);
    },

    /**
     * 显示警告通知
     * @param config 通知配置或消息字符串
     */
    warning(config: NotificationConfig | string) {
        const normalizedConfig = typeof config === "string" ? { message: config } : config;
        notification.warning(normalizedConfig);
    },

    /**
     * 显示信息通知
     * @param config 通知配置或消息字符串
     */
    info(config: NotificationConfig | string) {
        const normalizedConfig = typeof config === "string" ? { message: config } : config;
        notification.info(normalizedConfig);
    },
};
