<template>
    <div
        v-bind="$attrs"
        class="base-space"
        :class="[`base-space--${direction}`, `base-space--${align}`, `base-space--${size}`]"
        :style="spaceStyle"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface BaseSpaceProps {
    /** 间距方向 */
    direction?: "horizontal" | "vertical";
    /** 对齐方式 */
    align?: "start" | "end" | "center" | "baseline";
    /** 间距大小 */
    size?: "small" | "middle" | "large" | number;
    /** 是否换行 */
    wrap?: boolean;
}

const props = withDefaults(defineProps<BaseSpaceProps>(), {
    direction: "horizontal",
    align: "center",
    size: "middle",
    wrap: false,
});

// 计算样式
const spaceStyle = computed(() => {
    const style: Record<string, string> = {};

    if (props.wrap) {
        style.flexWrap = "wrap";
    }

    // 设置gap
    if (typeof props.size === "number") {
        style.gap = `${props.size}px`;
    } else {
        // 对于字符串size，也设置对应的gap值
        switch (props.size) {
            case "small":
                style.gap = "8px";
                break;
            case "middle":
                style.gap = "24px";
                break;
            case "large":
                style.gap = "24px";
                break;
        }
    }

    return style;
});
</script>

<style scoped>
.base-space {
    display: flex;
    align-items: center;
}

/* 方向 */
.base-space--horizontal {
    flex-direction: row;
}

.base-space--vertical {
    flex-direction: column;
}

/* 对齐方式 */
.base-space--start {
    align-items: flex-start;
}

.base-space--end {
    align-items: flex-end;
}

.base-space--center {
    align-items: center;
}

.base-space--baseline {
    align-items: baseline;
}

/* 间距大小 - 使用gap属性 */
.base-space--small {
    gap: 8px;
}

.base-space--middle {
    gap: 24px;
}

.base-space--large {
    gap: 24px;
}
</style>
