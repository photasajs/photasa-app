<template>
    <div
        class="base-card"
        :class="[sizeClasses, hoverableClasses, customClasses]"
        :style="customStyle"
        @click="handleClick"
    >
        <div v-if="title || $slots.title" class="base-card-header">
            <slot name="title">
                <h3 class="base-card-title">{{ title }}</h3>
            </slot>
        </div>
        <div class="base-card-body" :class="bodyClasses">
            <slot />
        </div>
        <div v-if="$slots.footer" class="base-card-footer">
            <slot name="footer" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
    title?: string;
    size?: "sm" | "md" | "lg";
    bodyPadding?: boolean;
    hoverable?: boolean;
    style?: Record<string, any>;
    class?: string;
}

const props = withDefaults(defineProps<Props>(), {
    size: "md",
    bodyPadding: true,
    hoverable: false,
});

const emit = defineEmits<{
    click: [event: MouseEvent];
}>();

const sizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "base-card-sm";
        case "lg":
            return "base-card-lg";
        default:
            return "base-card-md";
    }
});

const bodyClasses = computed(() => {
    return props.bodyPadding ? "" : "base-card-body-no-padding";
});

const hoverableClasses = computed(() => {
    return props.hoverable ? "base-card-hoverable" : "";
});

const customClasses = computed(() => {
    return props.class || "";
});

const customStyle = computed(() => {
    return props.style || {};
});

const handleClick = (event: MouseEvent) => {
    if (props.hoverable) {
        emit("click", event);
    }
};
</script>

<style scoped>
.base-card {
    background: linear-gradient(
        145deg,
        var(--color-bg) 0%,
        var(--color-bg-secondary, var(--color-bg)) 100%
    );
    border: 1px solid var(--color-border, rgba(0, 0, 0, 0.06));
    border-radius: 16px;
    box-shadow:
        var(--shadow-modern-md),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: var(--transition-modern);
    overflow: hidden;
    position: relative;
}

.base-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-primary, #1890ff) 20%,
        var(--color-primary, #1890ff) 80%,
        transparent 100%
    );
    opacity: 0.4;
}

.base-card-header {
    padding: 24px 28px 20px 28px;
    border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.06));
    background: linear-gradient(
        180deg,
        var(--color-bg-secondary, var(--color-bg)) 0%,
        var(--color-bg) 100%
    );
    position: relative;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.base-card-header::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 1px;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-primary, #1890ff) 50%,
        transparent 100%
    );
    opacity: 0.2;
}

.base-card-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
    line-height: 1.3;
    letter-spacing: -0.02em;
    background: linear-gradient(
        135deg,
        var(--color-text-primary) 0%,
        var(--color-primary, #1890ff) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    display: flex;
    align-items: center;
    gap: 12px;
}

.base-card-title::before {
    content: "🎯";
    font-size: 16px;
    -webkit-text-fill-color: initial;
    filter: grayscale(0.3) contrast(1.1);
}

.base-card-body {
    padding: 28px;
    background: var(--color-bg);
    position: relative;
}

.base-card-body::before {
    content: "";
    position: absolute;
    top: 0;
    left: 20px;
    right: 20px;
    height: 1px;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-border, rgba(0, 0, 0, 0.04)) 50%,
        transparent 100%
    );
    opacity: 0.8;
}

.base-card-body-no-padding {
    padding: 0 !important;
}

.base-card-footer {
    padding: 20px 28px 24px 28px;
    border-top: 1px solid var(--color-border, rgba(0, 0, 0, 0.06));
    background: linear-gradient(
        180deg,
        var(--color-bg) 0%,
        var(--color-bg-secondary, var(--color-bg)) 100%
    );
    position: relative;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.base-card-footer::before {
    content: "";
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 1px;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-primary, #1890ff) 50%,
        transparent 100%
    );
    opacity: 0.2;
}

/* Size variants */
.base-card-sm {
    max-width: 384px;
    border-radius: 12px;
}

.base-card-sm .base-card-header,
.base-card-sm .base-card-body,
.base-card-sm .base-card-footer {
    padding-left: 20px;
    padding-right: 20px;
}

.base-card-sm .base-card-header {
    padding-top: 18px;
    padding-bottom: 16px;
}

.base-card-sm .base-card-body {
    padding-top: 20px;
    padding-bottom: 20px;
}

.base-card-sm .base-card-footer {
    padding-top: 16px;
    padding-bottom: 18px;
}

.base-card-md {
    max-width: 672px;
}

.base-card-lg {
    max-width: 896px;
    border-radius: 20px;
}

.base-card-lg .base-card-header,
.base-card-lg .base-card-body,
.base-card-lg .base-card-footer {
    padding-left: 36px;
    padding-right: 36px;
}

.base-card-lg .base-card-header {
    padding-top: 28px;
    padding-bottom: 24px;
}

.base-card-lg .base-card-body {
    padding-top: 32px;
    padding-bottom: 32px;
}

.base-card-lg .base-card-footer {
    padding-top: 24px;
    padding-bottom: 28px;
}

/* Hoverable state */
.base-card-hoverable {
    cursor: pointer;
}

.base-card-hoverable:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow:
        var(--shadow-modern-lg),
        0 0 0 1px var(--color-primary, rgba(24, 144, 255, 0.2)),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.base-card-hoverable:hover::before {
    opacity: 0.8;
    background: linear-gradient(
        90deg,
        var(--color-primary, #1890ff) 0%,
        var(--color-primary-light, #40a9ff) 50%,
        var(--color-primary, #1890ff) 100%
    );
}

.base-card-hoverable:active {
    transform: translateY(-2px) scale(1.01);
    transition-duration: 0.1s;
}

/* Enhanced visual effects */
.base-card:hover .base-card-title::before {
    transform: scale(1.2) rotate(5deg);
    transition: transform 0.2s ease;
}

@media (max-width: 768px) {
    .base-card-sm,
    .base-card-md,
    .base-card-lg {
        max-width: 100%;
        margin: 0 8px;
    }

    .base-card-header,
    .base-card-body,
    .base-card-footer {
        padding-left: 20px !important;
        padding-right: 20px !important;
    }
}
</style>
