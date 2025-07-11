<template>
    <Dialog :open="open" @close="$emit('close')" class="relative z-50">
        <!-- 背景遮罩 -->
        <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

        <!-- 容器 -->
        <div class="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel
                :class="[
                    'w-full max-w-md transform overflow-hidden rounded-lg shadow-xl transition-all',
                    'bg-[var(--color-card-bg)] border border-[var(--color-border)]',
                    sizeClasses,
                ]"
            >
                <!-- 标题区域 -->
                <div
                    v-if="title || $slots.title"
                    class="px-6 py-4 border-b border-[var(--color-border)]"
                >
                    <DialogTitle class="text-lg font-medium text-[var(--color-text)]">
                        <slot name="title">{{ title }}</slot>
                    </DialogTitle>
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
                    <BaseButton variant="secondary" @click="$emit('cancel')">
                        {{ cancelText }}
                    </BaseButton>
                    <BaseButton variant="primary" @click="$emit('confirm')">
                        {{ confirmText }}
                    </BaseButton>
                </div>

                <!-- 关闭按钮 -->
                <button
                    v-if="closable"
                    @click="$emit('close')"
                    class="absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                >
                    <XMarkIcon class="h-5 w-5" />
                </button>
            </DialogPanel>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import BaseButton from "./BaseButton.vue";

interface Props {
    open: boolean;
    title?: string;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    closable?: boolean;
    showDefaultFooter?: boolean;
    confirmText?: string;
    cancelText?: string;
}

const props = withDefaults(defineProps<Props>(), {
    size: "md",
    closable: true,
    showDefaultFooter: false,
    confirmText: "Confirm",
    cancelText: "Cancel",
});

defineEmits<{
    close: [];
    confirm: [];
    cancel: [];
}>();

const sizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "max-w-sm";
        case "lg":
            return "max-w-lg";
        case "xl":
            return "max-w-xl";
        case "full":
            return "max-w-full mx-4";
        default:
            return "max-w-md";
    }
});
</script>
