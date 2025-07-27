<template>
    <Teleport to="body">
        <div
            v-if="open"
            class="fixed inset-0 z-50 flex items-center justify-center p-4"
            @click="handleBackdropClick"
            @keydown.esc="handleEscape"
            tabindex="-1"
            ref="modalRef"
        >
            <!-- 背景遮罩 -->
            <div class="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

            <!-- Modal内容 -->
            <div
                @click.stop
                :class="[
                    'relative transform overflow-hidden rounded-lg shadow-xl transition-all',
                    'bg-[var(--color-card-bg)] border border-[var(--color-border)]',
                    'max-h-[90vh] flex flex-col',
                    sizeClasses,
                ]"
                :style="customSizeStyle"
                role="dialog"
                :aria-labelledby="title ? 'modal-title' : undefined"
                aria-modal="true"
            >
                <!-- 标题区域 -->
                <div
                    v-if="title || $slots.title"
                    class="px-6 py-4 border-b border-[var(--color-border)]"
                >
                    <h2 id="modal-title" class="text-lg font-medium text-[var(--color-text)]">
                        <slot name="title">{{ title }}</slot>
                    </h2>
                </div>

                <!-- 内容区域 -->
                <div class="px-6 py-4">
                    <slot />
                </div>

                <!-- 底部操作区域 -->
                <div
                    v-if="$slots.footer"
                    class="px-6 py-4 border-t border-[var(--color-border)] flex justify-end gap-3"
                >
                    <slot name="footer" />
                </div>

                <!-- 默认底部按钮 -->
                <div
                    v-else-if="showDefaultFooter"
                    class="px-6 py-4 border-t border-[var(--color-border)] flex justify-end gap-3"
                >
                    <BaseButton variant="secondary" @click="emit('cancel')">
                        {{ cancelText }}
                    </BaseButton>
                    <BaseButton variant="primary" @click="emit('confirm')">
                        {{ confirmText }}
                    </BaseButton>
                </div>

                <!-- 关闭按钮 -->
                <button
                    v-if="closable"
                    @click="emit('close')"
                    class="absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                >
                    <XMarkIcon class="h-5 w-5" />
                </button>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import BaseButton from "./BaseButton.vue";

const modalRef = ref<HTMLElement>();
const previousActiveElement = ref<HTMLElement | null>(null);

interface Props {
    open: boolean;
    title?: string;
    size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full" | "custom";
    closable?: boolean;
    showDefaultFooter?: boolean;
    confirmText?: string;
    cancelText?: string;
    persistent?: boolean; // Prevents closing on click outside
}

const props = withDefaults(defineProps<Props>(), {
    size: "md",
    closable: true,
    showDefaultFooter: false,
    confirmText: "Confirm",
    cancelText: "Cancel",
    persistent: false,
});

const emit = defineEmits<{
    close: [];
    confirm: [];
    cancel: [];
}>();

const handleClose = () => {
    if (!props.persistent) {
        emit("close");
    }
};

const handleBackdropClick = (event: MouseEvent) => {
    // 只有点击背景时才关闭
    if (event.target === modalRef.value) {
        handleClose();
    }
};

const handleEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
        handleClose();
    }
};

// 焦点管理
const manageFocus = () => {
    if (props.open) {
        // 保存当前焦点元素
        previousActiveElement.value = document.activeElement as HTMLElement;

        nextTick(() => {
            // 将焦点移到modal
            if (modalRef.value) {
                modalRef.value.focus();
            }
        });
    } else {
        // 恢复之前的焦点
        if (previousActiveElement.value) {
            previousActiveElement.value.focus();
            previousActiveElement.value = null;
        }
    }
};

// 监听open状态变化
watch(() => props.open, manageFocus);

// 防止页面滚动
watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
    },
);

// 清理
onBeforeUnmount(() => {
    document.body.style.overflow = "";
    if (previousActiveElement.value) {
        previousActiveElement.value.focus();
    }
});

const sizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "max-w-sm w-full";
        case "md":
            return "max-w-md w-full";
        case "lg":
            return "max-w-lg w-full";
        case "xl":
            return "max-w-xl w-full";
        case "2xl":
            return "max-w-2xl w-full";
        case "3xl":
            return "max-w-3xl w-full";
        case "4xl":
            return "max-w-4xl w-full";
        case "5xl":
            return "max-w-5xl w-full";
        case "6xl":
            return "max-w-6xl w-full";
        case "custom":
            return "w-full";
        case "full":
            return "max-w-full mx-4 w-full";
        default:
            return "max-w-md w-full";
    }
});

const customSizeStyle = computed(() => {
    if (props.size === "custom") {
        return {
            maxWidth: "var(--modal-width, 800px)",
        };
    }
    return {};
});
</script>

<style scoped>
/* Modal动画 */
.modal-enter-active,
.modal-leave-active {
    transition: all 0.15s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
    transform: scale(0.95);
}

/* 确保modal在最顶层 */
.fixed.z-50 {
    z-index: 1000;
}

/* 焦点管理 */
.fixed.z-50:focus {
    outline: none;
}

/* 响应式大小调整 */
@media (max-width: 640px) {
    .p-4 {
        padding: 1rem;
    }
}
</style>
