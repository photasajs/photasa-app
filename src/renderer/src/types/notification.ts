/**
 * 通知类型
 */
export type NotificationType = "success" | "error" | "warning" | "info";

/**
 * 通知动作按钮
 */
export interface NotificationAction {
    /** 按钮文本 */
    text: string;
    /** 按钮类型 */
    type?: "primary" | "secondary" | "danger";
    /** 点击回调 */
    onClick: () => void;
}

/**
 * 通知配置
 */
export interface NotificationConfig {
    /** 通知标题 */
    title?: string;
    /** 通知消息 */
    message: string;
    /** 通知类型 */
    type?: NotificationType;
    /** 自动关闭时间（毫秒），0表示不自动关闭 */
    duration?: number;
    /** 是否显示关闭按钮 */
    closable?: boolean;
    /** 动作按钮列表 */
    actions?: NotificationAction[];
    /** 自定义样式类名 */
    className?: string;
    /** 通知唯一标识，用于防重复 */
    key?: string;
}

/**
 * 通知项
 */
export interface NotificationItem extends Required<NotificationConfig> {
    /** 通知ID */
    id: string;
    /** 创建时间戳 */
    timestamp: number;
    /** 是否可见 */
    visible: boolean;
}
