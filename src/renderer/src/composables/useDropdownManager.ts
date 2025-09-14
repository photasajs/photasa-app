import { ref } from "vue";

// 全局下拉管理器状态
const currentOpenDropdown = ref<string | null>(null);

export interface DropdownManager {
    register: (id: string) => void;
    unregister: (id: string) => void;
    open: (id: string) => void;
    close: (id: string) => void;
    isOpen: (id: string) => boolean;
    closeAll: () => void;
}

export function useDropdownManager(): DropdownManager {
    const register = (_id: string) => {
        // 注册下拉菜单，但不需要特殊逻辑
    };

    const unregister = (id: string) => {
        // 如果当前打开的是这个下拉菜单，则关闭
        if (currentOpenDropdown.value === id) {
            currentOpenDropdown.value = null;
        }
    };

    const open = (id: string) => {
        // 关闭当前打开的下拉菜单（如果有）
        if (currentOpenDropdown.value && currentOpenDropdown.value !== id) {
            // 触发关闭事件
            const event = new CustomEvent("dropdown-close", {
                detail: { id: currentOpenDropdown.value },
            });
            document.dispatchEvent(event);
        }
        // 设置新的打开下拉菜单
        currentOpenDropdown.value = id;
    };

    const close = (id: string) => {
        if (currentOpenDropdown.value === id) {
            currentOpenDropdown.value = null;
        }
    };

    const isOpen = (id: string) => {
        return currentOpenDropdown.value === id;
    };

    const closeAll = () => {
        if (currentOpenDropdown.value) {
            const event = new CustomEvent("dropdown-close", {
                detail: { id: currentOpenDropdown.value },
            });
            document.dispatchEvent(event);
            currentOpenDropdown.value = null;
        }
    };

    return {
        register,
        unregister,
        open,
        close,
        isOpen,
        closeAll,
    };
}
