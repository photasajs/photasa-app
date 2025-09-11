<template>
    <div
        class="tooltip-wrapper"
        @mouseenter="showTooltip"
        @mouseleave="hideTooltip"
        @focus="showTooltip"
        @blur="hideTooltip"
    >
        <!-- Trigger element -->
        <slot></slot>

        <!-- Tooltip content -->
        <Teleport to="body">
            <Transition name="tooltip-fade" @enter="onEnter" @leave="onLeave">
                <div
                    v-if="visible && title"
                    ref="tooltipRef"
                    class="tooltip"
                    :class="[`tooltip-${placement}`, { [`tooltip-${color}`]: color }]"
                    :style="tooltipStyle"
                    role="tooltip"
                    :aria-describedby="tooltipId"
                >
                    <div class="tooltip-content">
                        {{ title }}
                    </div>
                    <div class="tooltip-arrow" :class="`tooltip-arrow-${placement}`"></div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from "vue";

interface BaseTooltipProps {
    title: string;
    placement?: "top" | "bottom" | "left" | "right";
    color?: "default" | "blue" | "green" | "red";
    mouseEnterDelay?: number;
    mouseLeaveDelay?: number;
}

const props = withDefaults(defineProps<BaseTooltipProps>(), {
    placement: "top",
    color: "default",
    mouseEnterDelay: 0.1,
    mouseLeaveDelay: 0.1,
});

const visible = ref(false);
const tooltipRef = ref<HTMLElement>();
const tooltipStyle = ref({});
const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;

let enterTimer: number | undefined;
let leaveTimer: number | undefined;

const showTooltip = async () => {
    if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = undefined;
    }

    enterTimer = window.setTimeout(async () => {
        visible.value = true;
        await nextTick();
        updatePosition();
    }, props.mouseEnterDelay * 1000);
};

const hideTooltip = () => {
    if (enterTimer) {
        clearTimeout(enterTimer);
        enterTimer = undefined;
    }

    leaveTimer = window.setTimeout(() => {
        visible.value = false;
    }, props.mouseLeaveDelay * 1000);
};

const updatePosition = () => {
    // Simple positioning - could be enhanced with more sophisticated logic
    tooltipStyle.value = {
        position: "fixed",
        zIndex: "9999",
        pointerEvents: "none",
    };
};

const onEnter = () => {
    // Animation enter callback
};

const onLeave = () => {
    // Animation leave callback
};
</script>

<style scoped>
.tooltip-wrapper {
    display: inline-block;
}

.tooltip {
    position: absolute;
    background-color: rgba(0, 0, 0, 0.75);
    color: white;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.5;
    max-width: 250px;
    word-wrap: break-word;
    z-index: 1070;
}

.tooltip-content {
    position: relative;
}

.tooltip-arrow {
    position: absolute;
    width: 0;
    height: 0;
    border: 4px solid transparent;
}

.tooltip-top {
    margin-bottom: 4px;
}

.tooltip-arrow-top {
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    border-top-color: rgba(0, 0, 0, 0.75);
}

.tooltip-bottom {
    margin-top: 4px;
}

.tooltip-arrow-bottom {
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    border-bottom-color: rgba(0, 0, 0, 0.75);
}

.tooltip-left {
    margin-right: 4px;
}

.tooltip-arrow-left {
    right: -8px;
    top: 50%;
    transform: translateY(-50%);
    border-left-color: rgba(0, 0, 0, 0.75);
}

.tooltip-right {
    margin-left: 4px;
}

.tooltip-arrow-right {
    left: -8px;
    top: 50%;
    transform: translateY(-50%);
    border-right-color: rgba(0, 0, 0, 0.75);
}

/* Color variations */
.tooltip-blue {
    background-color: var(--color-info);
}

.tooltip-green {
    background-color: var(--color-success);
}

.tooltip-red {
    background-color: var(--color-danger);
}

/* Transitions */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
    transition: opacity 0.15s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
    opacity: 0;
}
</style>
