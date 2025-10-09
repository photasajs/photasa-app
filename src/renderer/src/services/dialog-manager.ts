/**
 * 对话框管理器服务
 * 统一管理所有对话框的打开/关闭状态
 * 避免直接调用对话框组件，提供统一的API
 */

import { reactive } from "vue";
import { loggers } from "@common/logger";

const logger = loggers.lishiming;

/**
 * 对话框状态接口
 */
interface DialogState {
    id: string;
    open: boolean;
    data?: any;
}

/**
 * 对话框管理器类
 */
class DialogManager {
    private dialogs = reactive<Record<string, DialogState>>({});
    private listeners = new Map<string, Set<() => void>>();

    /**
     * 注册对话框
     * @param id 对话框唯一标识
     * @param initialState 初始状态
     */
    register(id: string, initialState: Partial<DialogState> = {}) {
        this.dialogs[id] = {
            id,
            open: false,
            ...initialState,
        };
        logger.debug(`[DialogManager] 注册对话框: ${id}`);
    }

    /**
     * 打开对话框
     * @param id 对话框标识
     * @param data 传递的数据
     */
    open(id: string, data?: any) {
        if (!this.dialogs[id]) {
            logger.warn(`[DialogManager] 对话框未注册: ${id}`);
            this.register(id);
        }

        this.dialogs[id].open = true;
        if (data !== undefined) {
            this.dialogs[id].data = data;
        }

        logger.debug(`[DialogManager] 打开对话框: ${id}`, data);
        this.notifyListeners(id);
    }

    /**
     * 关闭对话框
     * @param id 对话框标识
     */
    close(id: string) {
        if (this.dialogs[id]) {
            this.dialogs[id].open = false;
            this.dialogs[id].data = undefined;
            logger.debug(`[DialogManager] 关闭对话框: ${id}`);
            this.notifyListeners(id);
        }
    }

    /**
     * 切换对话框状态
     * @param id 对话框标识
     * @param data 传递的数据
     */
    toggle(id: string, data?: any) {
        if (this.isOpen(id)) {
            this.close(id);
        } else {
            this.open(id, data);
        }
    }

    /**
     * 检查对话框是否打开
     * @param id 对话框标识
     */
    isOpen(id: string): boolean {
        return this.dialogs[id]?.open || false;
    }

    /**
     * 获取对话框数据
     * @param id 对话框标识
     */
    getData(id: string): any {
        return this.dialogs[id]?.data;
    }

    /**
     * 关闭所有对话框
     */
    closeAll() {
        Object.keys(this.dialogs).forEach((id) => {
            this.close(id);
        });
        logger.debug("[DialogManager] 关闭所有对话框");
    }

    /**
     * 获取对话框状态
     * @param id 对话框标识
     */
    getState(id: string): DialogState | undefined {
        return this.dialogs[id];
    }

    /**
     * 监听对话框状态变化
     * @param id 对话框标识
     * @param callback 回调函数
     */
    onStateChange(id: string, callback: () => void) {
        if (!this.listeners.has(id)) {
            this.listeners.set(id, new Set());
        }
        const callbacks = this.listeners.get(id);
        if (callbacks) {
            callbacks.add(callback);
        }
    }

    /**
     * 移除状态变化监听
     * @param id 对话框标识
     * @param callback 回调函数
     */
    offStateChange(id: string, callback: () => void) {
        this.listeners.get(id)?.delete(callback);
    }

    /**
     * 通知监听器
     * @param id 对话框标识
     */
    private notifyListeners(id: string) {
        this.listeners.get(id)?.forEach((callback) => {
            try {
                callback();
            } catch (error) {
                logger.error(`[DialogManager] 监听器执行失败: ${id}`, error);
            }
        });
    }

    /**
     * 销毁管理器
     */
    destroy() {
        this.closeAll();
        this.listeners.clear();
        logger.debug("[DialogManager] 管理器已销毁");
    }
}

// 创建全局实例
export const dialogManager = new DialogManager();

// 预定义对话框ID常量
export const DIALOG_IDS = {
    PREFERENCE: "preference",
    IMPORT_PHOTOS: "import-photos",
    SCAN_QUEUE: "scan-queue",
    QUEUE_DASHBOARD: "queue-dashboard",
    UPDATE_NOTIFICATION: "update-notification",
} as const;

// 导出类型
export type DialogId = keyof typeof DIALOG_IDS;
export type { DialogState };
