<template>
    <div
        v-bind="$attrs"
        class="base-space"
        :class="[`base-space--${direction}`, `base-space--${align}`, `base-space--${size}`]"
        :style="spaceStyle"
    >
        <template v-for="(item, index) in items" :key="index">
            <div
                v-if="index > 0"
                class="base-space-item-separator"
                :class="`base-space-item-separator--${direction}`"
            />
            <div class="base-space-item">
                <slot :item="item" :index="index">
                    {{ item }}
                </slot>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from "vue";

interface BaseSpaceProps {
    /** 间距方向 */
    direction?: "horizontal" | "vertical";
    /** 对齐方式 */
    align?: "start" | "end" | "center" | "baseline";
    /** 间距大小 */
    size?: "small" | "middle" | "large" | number;
    /** 是否换行 */
    wrap?: boolean;
    /** 分割符 */
    split?: string | boolean;
}

const props = withDefaults(defineProps<BaseSpaceProps>(), {
    direction: "horizontal",
    align: "center",
    size: "middle",
    wrap: false,
});

const slots = useSlots();

// 间距值通过CSS类控制，不需要JavaScript计算

// 计算样式
const spaceStyle = computed(() => {
    const style: Record<string, string> = {};

    if (props.direction === "vertical") {
        style.flexDirection = "column";
    }

    if (props.wrap) {
        style.flexWrap = "wrap";
    }

    return style;
});

// 获取子元素
const items = computed(() => {
    if (slots.default) {
        // 如果有插槽内容，返回插槽内容
        return slots.default();
    }
    return [];
});
</script>

<style scoped>
.base-space {
    display: inline-flex;
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

/* 间距大小 */
.base-space--small .base-space-item-separator--horizontal {
    width: 8px;
}

.base-space--small .base-space-item-separator--vertical {
    height: 8px;
}

.base-space--middle .base-space-item-separator--horizontal {
    width: 16px;
}

.base-space--middle .base-space-item-separator--vertical {
    height: 16px;
}

.base-space--large .base-space-item-separator--horizontal {
    width: 24px;
}

.base-space--large .base-space-item-separator--vertical {
    height: 24px;
}

/* 分隔符 */
.base-space-item-separator {
    flex-shrink: 0;
}

.base-space-item-separator--horizontal {
    display: inline-block;
}

.base-space-item-separator--vertical {
    display: block;
}

.base-space-item {
    display: inline-block;
}
</style>
