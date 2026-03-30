<template>
    <Teleport to="body">
        <Transition name="drawer-fade" appear @enter="onEnter" @leave="onLeave">
            <div
                v-if="modelValue"
                class="drawer-overlay"
                :style="{ zIndex }"
                @click="handleMaskClick"
            >
                <div
                    ref="drawerRef"
                    class="drawer"
                    :class="[`drawer-${placement}`, { 'drawer-bordered': bordered }]"
                    :style="drawerStyle"
                    role="dialog"
                    aria-modal="true"
                    :aria-labelledby="titleId"
                    @click.stop
                >
                    <!-- Header -->
                    <div v-if="$slots.title || title" class="drawer-header">
                        <div :id="titleId" class="drawer-title">
                            <slot name="title">{{ title }}</slot>
                        </div>
                        <button
                            class="drawer-close"
                            type="button"
                            :aria-label="t('common.close')"
                            @click="handleClose"
                        >
                            <PhX class="h-5 w-5" />
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="drawer-body">
                        <slot></slot>
                    </div>

                    <!-- Footer -->
                    <div v-if="$slots.footer" class="drawer-footer">
                        <slot name="footer"></slot>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { onKeyStroke } from "@vueuse/core";
import { PhX } from "@phosphor-icons/vue";

interface BaseDrawerProps {
    modelValue: boolean;
    title?: string;
    placement?: "left" | "right" | "top" | "bottom";
    width?: string | number;
    height?: string | number;
    mask?: boolean;
    maskClosable?: boolean;
    closeOnEsc?: boolean;
    zIndex?: number;
    bordered?: boolean;
}

const props = withDefaults(defineProps<BaseDrawerProps>(), {
    placement: "right",
    width: 400,
    mask: true,
    maskClosable: true,
    closeOnEsc: true,
    zIndex: 1000,
    bordered: false,
});

const emit = defineEmits<{
    "update:modelValue": [value: boolean];
    close: [];
    open: [];
}>();

const { t } = useI18n();
const drawerRef = ref<HTMLElement>();
const titleId = `drawer-title-${Math.random().toString(36).substring(2, 11)}`;

// Focus management
const focusDrawer = () => {
    if (drawerRef.value) {
        drawerRef.value.focus();
    }
};

// Computed styles
const drawerStyle = computed(() => {
    const style: Record<string, string> = {};

    if (props.placement === "left" || props.placement === "right") {
        if (props.width) {
            style.width = typeof props.width === "number" ? `${props.width}px` : props.width;
        }
    } else {
        if (props.height) {
            style.height = typeof props.height === "number" ? `${props.height}px` : props.height;
        }
    }

    return style;
});

// Handle close
const handleClose = () => {
    emit("update:modelValue", false);
    emit("close");
};

// Handle mask click
const handleMaskClick = () => {
    if (props.maskClosable) {
        handleClose();
    }
};

// Handle ESC key
onKeyStroke("Escape", () => {
    if (props.closeOnEsc && props.modelValue) {
        handleClose();
    }
});

// Watchers
watch(
    () => props.modelValue,
    async (newValue) => {
        if (newValue) {
            emit("open");
            await nextTick();
            focusDrawer();
        }
    },
);

// Animation callbacks
const onEnter = () => {
    document.body.style.overflow = "hidden";
};

const onLeave = () => {
    document.body.style.overflow = "";
};
</script>

<style scoped>
.drawer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
        135deg,
        rgba(0, 0, 0, 0.4) 0%,
        rgba(0, 0, 0, 0.6) 50%,
        rgba(0, 0, 0, 0.4) 100%
    );
    backdrop-filter: blur(8px) saturate(180%);
    -webkit-backdrop-filter: blur(8px) saturate(180%);
    display: flex;
    align-items: stretch;
    justify-content: flex-end;
    z-index: 1000;
    animation: overlayFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.drawer {
    background: linear-gradient(
        145deg,
        var(--color-bg) 0%,
        var(--color-bg-secondary, var(--color-bg)) 100%
    );
    display: flex;
    flex-direction: column;
    box-shadow:
        var(--shadow-modern-xl),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    border: 1px solid var(--color-border);
    transition: var(--transition-modern);
    overflow: hidden;
}

.drawer-bordered {
    border: 2px solid var(--color-primary);
}

.drawer-right {
    margin-left: auto;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    border-right: none;
}

.drawer-left {
    margin-right: auto;
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    border-left: none;
}

.drawer-top {
    margin-bottom: auto;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    width: 100%;
    border-top: none;
}

.drawer-bottom {
    margin-top: auto;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    width: 100%;
    border-bottom: none;
}

.drawer-header {
    padding: 28px 32px 24px 32px;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(
        180deg,
        var(--color-bg-secondary, var(--color-bg)) 0%,
        var(--color-bg) 100%
    );
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    position: relative;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.drawer-header::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 1px;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-primary, #1890ff) 50%,
        transparent 100%
    );
    opacity: 0.3;
}

.drawer-title {
    font-size: 20px;
    font-weight: 800;
    color: var(--color-text-primary);
    flex: 1;
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.02em;
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    overflow: hidden;
}

.drawer-title::before {
    content: "📋";
    font-size: 18px;
    -webkit-text-fill-color: initial;
    filter: grayscale(0.2) contrast(1.1);
}

.drawer-close {
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: color 0.2s ease;
    padding: 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
}

.drawer-close:hover {
    color: var(--color-text);
    background: var(--color-bg-hover);
}

.drawer-body {
    padding: 32px;
    flex: 1;
    overflow: auto;
    background: linear-gradient(
        180deg,
        var(--color-bg) 0%,
        var(--color-bg-secondary, var(--color-bg)) 100%
    );
    position: relative;
}

.drawer-body::before {
    content: "";
    position: absolute;
    top: 0;
    left: 16px;
    right: 16px;
    height: 1px;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-border, rgba(0, 0, 0, 0.06)) 50%,
        transparent 100%
    );
    opacity: 0.6;
}

.drawer-footer {
    padding: 24px 32px 28px 32px;
    border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    background: linear-gradient(
        180deg,
        var(--color-bg) 0%,
        var(--color-bg-secondary, var(--color-bg)) 100%
    );
    flex-shrink: 0;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: relative;
}

.drawer-footer::before {
    content: "";
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 1px;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-primary, #1890ff) 50%,
        transparent 100%
    );
    opacity: 0.3;
}

/* Transitions */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
    transition: opacity 0.2s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
    opacity: 0;
}

.drawer-fade-enter-active .drawer,
.drawer-fade-leave-active .drawer {
    transition: transform 0.2s ease;
}

.drawer-fade-enter-from .drawer-right {
    transform: translateX(100%);
}

.drawer-fade-leave-to .drawer-right {
    transform: translateX(100%);
}

.drawer-fade-enter-from .drawer-left {
    transform: translateX(-100%);
}

.drawer-fade-leave-to .drawer-left {
    transform: translateX(-100%);
}

.drawer-fade-enter-from .drawer-top {
    transform: translateY(-100%);
}

.drawer-fade-leave-to .drawer-top {
    transform: translateY(-100%);
}

.drawer-fade-enter-from .drawer-bottom {
    transform: translateY(100%);
}

.drawer-fade-leave-to .drawer-bottom {
    transform: translateY(100%);
}

/* Enhanced animations and effects */
@keyframes overlayFadeIn {
    from {
        opacity: 0;
        backdrop-filter: blur(0px);
        -webkit-backdrop-filter: blur(0px);
    }
    to {
        opacity: 1;
        backdrop-filter: blur(8px) saturate(180%);
        -webkit-backdrop-filter: blur(8px) saturate(180%);
    }
}

@keyframes shimmer {
    0% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(100%);
    }
}

/* Enhanced transitions for modern feel */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-fade-enter-active .drawer,
.drawer-fade-leave-active .drawer {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Smooth scroll for drawer body */
.drawer-body {
    scroll-behavior: smooth;
}

.drawer-body {
    scrollbar-width: thin;
    scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
}

.drawer-body::-webkit-scrollbar {
    width: var(--color-scrollbar-width);
}

.drawer-body::-webkit-scrollbar-track {
    background: var(--color-scrollbar-track);
    border-radius: var(--color-scrollbar-border-radius);
}

.drawer-body::-webkit-scrollbar-track:hover {
    background: var(--color-scrollbar-track-hover);
}

.drawer-body::-webkit-scrollbar-thumb {
    background: var(--color-scrollbar-thumb);
    border-radius: var(--color-scrollbar-border-radius);
    transition: all 0.2s ease;
}

.drawer-body::-webkit-scrollbar-thumb:hover {
    background: var(--color-scrollbar-thumb-hover);
}

.drawer-body::-webkit-scrollbar-thumb:active {
    background: var(--color-scrollbar-thumb-active);
}
</style>
