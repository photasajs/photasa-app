<template>
    <Teleport to="body">
        <Transition name="modal" appear @enter="onEnter" @leave="onLeave">
            <div
                v-if="open"
                class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
                @click="handleBackdropClick"
                @keydown.esc="handleEscape"
                tabindex="-1"
                ref="modalRef"
            >
                <!-- 背景遮罩 -->
                <div class="modal-backdrop fixed inset-0 bg-black/30" aria-hidden="true" />

                <!-- Modal内容 -->
                <div
                    @click.stop
                    :class="[
                        'modal-content relative transform rounded-lg shadow-xl',
                        'bg-[var(--color-card-bg)] border border-[var(--color-border)]',
                        'max-h-[90vh] flex flex-col',
                        sizeClasses,
                    ]"
                    :style="[props.size === 'custom' ? customSizeStyle : {}, props.style]"
                    role="dialog"
                    :aria-labelledby="title ? 'modal-title' : undefined"
                    aria-modal="true"
                >
                    <!-- 标题区域 -->
                    <div
                        v-if="title || $slots.title"
                        class="px-6 py-4 border-b border-[var(--color-border)] overflow-hidden flex-shrink-0"
                    >
                        <h2
                            id="modal-title"
                            class="text-lg font-medium text-[var(--color-text)] break-words"
                        >
                            <slot name="title">{{ title }}</slot>
                        </h2>
                    </div>

                    <!-- 内容区域 -->
                    <div class="px-6 py-4 flex-1 overflow-y-auto overflow-x-hidden scrollbar-theme">
                        <slot />
                    </div>

                    <!-- 底部操作区域 -->
                    <div
                        v-if="$slots.footer"
                        class="px-6 py-4 border-t border-[var(--color-border)] flex justify-end gap-3 overflow-hidden flex-shrink-0"
                    >
                        <slot name="footer" />
                    </div>

                    <!-- 默认底部按钮 -->
                    <div
                        v-else-if="showDefaultFooter"
                        class="px-6 py-4 border-t border-[var(--color-border)] flex justify-end gap-3 overflow-hidden flex-shrink-0"
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
                        <PhX class="h-5 w-5" />
                    </button>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from "vue";
import { PhX } from "@phosphor-icons/vue";
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
    style?: string | Record<string, string>; // 支持 style 属性
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

// 动画回调函数
const onEnter = (_el: Element) => {
    // 动画开始时的处理
    console.log("Modal enter animation started");
};

const onLeave = (_el: Element) => {
    // 动画结束时的处理
    console.log("Modal leave animation completed");
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

// Safelist for Tailwind to ensure these classes are included
// max-w-sm max-w-md max-w-lg max-w-xl max-w-2xl max-w-3xl max-w-4xl max-w-5xl max-w-6xl max-w-full
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
/* Modal容器动画 */
.modal-enter-active {
    transition: all 0.3s ease-out;
}

.modal-leave-active {
    transition: all 0.2s ease-in;
}

.modal-enter-from {
    opacity: 0;
}

.modal-leave-to {
    opacity: 0;
}

/* 背景遮罩动画 */
.modal-backdrop {
    transition: opacity 0.3s ease;
}

.modal-enter-from .modal-backdrop {
    opacity: 0;
}

.modal-leave-to .modal-backdrop {
    opacity: 0;
}

/* Modal内容动画 */
.modal-content {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: transform, opacity;
    /* 防止水平滚动 */
    overflow-x: hidden;
    word-wrap: break-word;
    word-break: break-word;
    min-width: 0;
}

.modal-enter-from .modal-content {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
}

.modal-leave-to .modal-content {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
}

/* 确保modal在最顶层 */
.fixed.z-50 {
    z-index: 1000;
}

/* 焦点管理 */
.fixed.z-50:focus {
    outline: none;
}

/* 确保标题和底部区域没有滚动条 */
.modal-content > div:first-child,
.modal-content > div:last-child {
    overflow: hidden !important;
    flex-shrink: 0;
}

/* 防止模态框内容区域内的所有元素产生水平滚动 */
.modal-content * {
    max-width: 100%;
    box-sizing: border-box;
}

/* 特别处理可能产生水平滚动的元素 */
.modal-content input,
.modal-content textarea,
.modal-content select,
.modal-content button,
.modal-content div,
.modal-content span,
.modal-content p,
.modal-content h1,
.modal-content h2,
.modal-content h3,
.modal-content h4,
.modal-content h5,
.modal-content h6 {
    max-width: 100%;
    overflow-x: hidden;
    word-wrap: break-word;
    word-break: break-word;
}

/* 确保表格不会产生水平滚动 */
.modal-content table {
    width: 100%;
    table-layout: fixed;
}

.modal-content td,
.modal-content th {
    word-wrap: break-word;
    word-break: break-word;
    overflow-wrap: break-word;
}

/* 响应式大小调整 */
@media (max-width: 640px) {
    .p-4 {
        padding: 1rem;
    }

    /* 移动端优化动画 */
    .modal-content {
        transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .modal-enter-from .modal-content {
        transform: scale(0.95) translateY(-10px);
    }
}
</style>
