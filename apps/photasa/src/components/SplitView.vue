<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import { getPosition } from "@renderer/utils/dom";

type Direction = "vertical" | "horizontal";

interface Props {
    direction?: Direction;
    aInit?: string;
    aMin?: string;
    aMax?: string;
}

interface Emits {
    (e: "update:offset", value: string | number): void;
    (e: "dragStart"): void;
    (e: "dragEnd"): void;
}

const props = withDefaults(defineProps<Props>(), {
    direction: "horizontal",
    aInit: "50%",
    aMin: "none",
    aMax: "none",
});

const emit = defineEmits<Emits>();

const container = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const offset = ref<string | number>(props.aInit);

const isVertical = computed(() => props.direction === "vertical");
const offsetA = computed(() => {
    if (typeof offset.value === "string") {
        return offset.value;
    }
    return `${offset.value}px`;
});

const styleA = computed(() => {
    const property = isVertical.value ? "Height" : "Width";
    return {
        [property.toLowerCase()]: offsetA.value,
        [`min${property}`]: props.aMin,
        [`max${property}`]: props.aMax,
    };
});

function dragStart(event: MouseEvent) {
    event.preventDefault();
    isDragging.value = true;
    emit("dragStart");
    window.addEventListener("mousemove", dragging, { passive: true });
    window.addEventListener("mouseup", dragStop, { passive: true, once: true });
}

function dragStop() {
    window.removeEventListener("mousemove", dragging);
    isDragging.value = false;
    emit("dragEnd");
}

function mouseOffset({ pageX, pageY }: MouseEvent): number {
    if (!container.value) return 0;
    const containerOffset = getPosition(container.value);
    let newOffset;
    if (isVertical.value) {
        newOffset = pageY - containerOffset.y;
        newOffset = Math.min(newOffset, container.value.offsetHeight);
    } else {
        newOffset = pageX - containerOffset.x;
        newOffset = Math.min(newOffset, container.value.offsetWidth);
    }
    return Math.max(newOffset, 0);
}

function dragging(event: MouseEvent) {
    const newOffset = mouseOffset(event);
    offset.value = newOffset;
    emit("update:offset", newOffset);
}

// Cleanup event listeners on component unmount
onBeforeUnmount(() => {
    window.removeEventListener("mousemove", dragging);
    window.removeEventListener("mouseup", dragStop);
});

// Add touch support
function handleTouchStart(event: TouchEvent) {
    event.preventDefault();
    const touch = event.touches[0];
    dragStart(
        new MouseEvent("mousedown", {
            clientX: touch.clientX,
            clientY: touch.clientY,
        }),
    );
}

function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    const touch = event.touches[0];
    dragging(
        new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY,
        }),
    );
}
</script>

<template>
    <div
        ref="container"
        :class="[
            $s.SplitView,
            {
                [$s.isVertical]: isVertical,
            },
        ]"
    >
        <div
            :class="[
                $s.SideA,
                {
                    [$s.isLocked]: isDragging,
                },
            ]"
            :style="styleA"
        >
            <slot name="A" />
        </div>
        <span
            :class="[
                $s.Handle,
                {
                    [$s.isVertical]: isVertical,
                    [$s.isHorizontal]: !isVertical,
                },
            ]"
            @mousedown="dragStart"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
        />
        <div
            :class="[
                $s.SideB,
                {
                    [$s.isLocked]: isDragging,
                },
            ]"
        >
            <slot name="B" />
        </div>
    </div>
</template>

<style module="$s" lang="less">
.SplitView {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    touch-action: none;

    &.isVertical {
        flex-direction: column;
    }
}

.Handle {
    user-select: none;
    box-sizing: border-box;
    transition:
        background-color 0.2s ease,
        opacity 0.2s ease;
    z-index: 10;
    background-color: var(--color-splitter-border, rgba(255, 255, 255, 0.12));
    background-clip: content-box; /* Clip background to center content box to allow transparent borders */
    touch-action: none;

    &.isHorizontal {
        width: 10px; /* 4px border + 2px content + 4px border */
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        margin: 0 -4px;
        cursor: col-resize;
    }

    &.isVertical {
        height: 10px;
        border-top: 4px solid transparent;
        border-bottom: 4px solid transparent;
        margin: -4px 0;
        cursor: row-resize;
    }

    &:hover,
    &:active {
        background-color: var(--color-splitter-hover, var(--color-primary, #3794ff));
    }
}

.SideA {
    overflow: auto;

    &.isLocked {
        pointer-events: none;
    }
}

.SideB {
    composes: SideA;
    flex: 1;
}
</style>
