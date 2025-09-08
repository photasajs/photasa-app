<template>
    <div v-bind="$attrs" class="base-col" :class="colClasses" :style="colStyle">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";

interface BaseColProps {
    /** 栅格占位格数 */
    span?: number;
    /** 栅格顺序 */
    order?: number;
    /** 栅格左侧的间隔格数 */
    offset?: number;
    /** 栅格向右移动格数 */
    push?: number;
    /** 栅格向左移动格数 */
    pull?: number;
    /** 响应式栅格 */
    xs?: number | { span?: number; offset?: number; order?: number; push?: number; pull?: number };
    sm?: number | { span?: number; offset?: number; order?: number; push?: number; pull?: number };
    md?: number | { span?: number; offset?: number; order?: number; push?: number; pull?: number };
    lg?: number | { span?: number; offset?: number; order?: number; push?: number; pull?: number };
    xl?: number | { span?: number; offset?: number; order?: number; push?: number; pull?: number };
    xxl?: number | { span?: number; offset?: number; order?: number; push?: number; pull?: number };
    /** 是否自动填充 */
    flex?: boolean | string | number;
}

const props = withDefaults(defineProps<BaseColProps>(), {
    span: 24,
    order: 0,
    offset: 0,
    push: 0,
    pull: 0,
});

const rowContext = inject<{ gutter: number | [number, number] }>("row");

// 计算列类名
const colClasses = computed(() => {
    const classes: string[] = [];

    // 基础span
    if (props.span !== 24) {
        classes.push(`base-col--span-${props.span}`);
    }

    // offset
    if (props.offset > 0) {
        classes.push(`base-col--offset-${props.offset}`);
    }

    // push
    if (props.push > 0) {
        classes.push(`base-col--push-${props.push}`);
    }

    // pull
    if (props.pull > 0) {
        classes.push(`base-col--pull-${props.pull}`);
    }

    // 响应式
    const breakpoints = ["xs", "sm", "md", "lg", "xl", "xxl"];
    breakpoints.forEach((breakpoint) => {
        const value = props[breakpoint as keyof BaseColProps];
        if (value !== undefined) {
            if (typeof value === "number") {
                classes.push(`base-col--${breakpoint}-${value}`);
            } else {
                if (value.span) classes.push(`base-col--${breakpoint}-${value.span}`);
                if (value.offset) classes.push(`base-col--${breakpoint}-offset-${value.offset}`);
                if (value.push) classes.push(`base-col--${breakpoint}-push-${value.push}`);
                if (value.pull) classes.push(`base-col--${breakpoint}-pull-${value.pull}`);
            }
        }
    });

    return classes;
});

// 计算列样式
const colStyle = computed(() => {
    const style: Record<string, string> = {};

    // flex属性
    if (props.flex !== undefined) {
        if (typeof props.flex === "boolean") {
            style.flex = props.flex ? "1" : "none";
        } else {
            style.flex = String(props.flex);
        }
    }

    // order
    if (props.order !== 0) {
        style.order = String(props.order);
    }

    // gutter
    if (rowContext?.gutter) {
        const gutter = Array.isArray(rowContext.gutter) ? rowContext.gutter[0] : rowContext.gutter;
        style.paddingLeft = `${gutter / 2}px`;
        style.paddingRight = `${gutter / 2}px`;
    }

    return style;
});
</script>

<style scoped>
.base-col {
    position: relative;
    max-width: 100%;
    min-height: 1px;
}

/* 基础栅格系统 (24列) */
.base-col--span-1 {
    width: 4.16666667%;
}
.base-col--span-2 {
    width: 8.33333333%;
}
.base-col--span-3 {
    width: 12.5%;
}
.base-col--span-4 {
    width: 16.66666667%;
}
.base-col--span-5 {
    width: 20.83333333%;
}
.base-col--span-6 {
    width: 25%;
}
.base-col--span-7 {
    width: 29.16666667%;
}
.base-col--span-8 {
    width: 33.33333333%;
}
.base-col--span-9 {
    width: 37.5%;
}
.base-col--span-10 {
    width: 41.66666667%;
}
.base-col--span-11 {
    width: 45.83333333%;
}
.base-col--span-12 {
    width: 50%;
}
.base-col--span-13 {
    width: 54.16666667%;
}
.base-col--span-14 {
    width: 58.33333333%;
}
.base-col--span-15 {
    width: 62.5%;
}
.base-col--span-16 {
    width: 66.66666667%;
}
.base-col--span-17 {
    width: 70.83333333%;
}
.base-col--span-18 {
    width: 75%;
}
.base-col--span-19 {
    width: 79.16666667%;
}
.base-col--span-20 {
    width: 83.33333333%;
}
.base-col--span-21 {
    width: 87.5%;
}
.base-col--span-22 {
    width: 91.66666667%;
}
.base-col--span-23 {
    width: 95.83333333%;
}
.base-col--span-24 {
    width: 100%;
}

/* offset */
.base-col--offset-1 {
    margin-left: 4.16666667%;
}
.base-col--offset-2 {
    margin-left: 8.33333333%;
}
.base-col--offset-3 {
    margin-left: 12.5%;
}
.base-col--offset-4 {
    margin-left: 16.66666667%;
}
.base-col--offset-5 {
    margin-left: 20.83333333%;
}
.base-col--offset-6 {
    margin-left: 25%;
}
.base-col--offset-7 {
    margin-left: 29.16666667%;
}
.base-col--offset-8 {
    margin-left: 33.33333333%;
}
.base-col--offset-9 {
    margin-left: 37.5%;
}
.base-col--offset-10 {
    margin-left: 41.66666667%;
}
.base-col--offset-11 {
    margin-left: 45.83333333%;
}
.base-col--offset-12 {
    margin-left: 50%;
}
.base-col--offset-13 {
    margin-left: 54.16666667%;
}
.base-col--offset-14 {
    margin-left: 58.33333333%;
}
.base-col--offset-15 {
    margin-left: 62.5%;
}
.base-col--offset-16 {
    margin-left: 66.66666667%;
}
.base-col--offset-17 {
    margin-left: 70.83333333%;
}
.base-col--offset-18 {
    margin-left: 75%;
}
.base-col--offset-19 {
    margin-left: 79.16666667%;
}
.base-col--offset-20 {
    margin-left: 83.33333333%;
}
.base-col--offset-21 {
    margin-left: 87.5%;
}
.base-col--offset-22 {
    margin-left: 91.66666667%;
}
.base-col--offset-23 {
    margin-left: 95.83333333%;
}

/* push */
.base-col--push-1 {
    left: 4.16666667%;
}
.base-col--push-2 {
    left: 8.33333333%;
}
.base-col--push-3 {
    left: 12.5%;
}
.base-col--push-4 {
    left: 16.66666667%;
}
.base-col--push-5 {
    left: 20.83333333%;
}
.base-col--push-6 {
    left: 25%;
}
.base-col--push-7 {
    left: 29.16666667%;
}
.base-col--push-8 {
    left: 33.33333333%;
}
.base-col--push-9 {
    left: 37.5%;
}
.base-col--push-10 {
    left: 41.66666667%;
}
.base-col--push-11 {
    left: 45.83333333%;
}
.base-col--push-12 {
    left: 50%;
}
.base-col--push-13 {
    left: 54.16666667%;
}
.base-col--push-14 {
    left: 58.33333333%;
}
.base-col--push-15 {
    left: 62.5%;
}
.base-col--push-16 {
    left: 66.66666667%;
}
.base-col--push-17 {
    left: 70.83333333%;
}
.base-col--push-18 {
    left: 75%;
}
.base-col--push-19 {
    left: 79.16666667%;
}
.base-col--push-20 {
    left: 83.33333333%;
}
.base-col--push-21 {
    left: 87.5%;
}
.base-col--push-22 {
    left: 91.66666667%;
}
.base-col--push-23 {
    left: 95.83333333%;
}

/* pull */
.base-col--pull-1 {
    right: 4.16666667%;
}
.base-col--pull-2 {
    right: 8.33333333%;
}
.base-col--pull-3 {
    right: 12.5%;
}
.base-col--pull-4 {
    right: 16.66666667%;
}
.base-col--pull-5 {
    right: 20.83333333%;
}
.base-col--pull-6 {
    right: 25%;
}
.base-col--pull-7 {
    right: 29.16666667%;
}
.base-col--pull-8 {
    right: 33.33333333%;
}
.base-col--pull-9 {
    right: 37.5%;
}
.base-col--pull-10 {
    right: 41.66666667%;
}
.base-col--pull-11 {
    right: 45.83333333%;
}
.base-col--pull-12 {
    right: 50%;
}
.base-col--pull-13 {
    right: 54.16666667%;
}
.base-col--pull-14 {
    right: 58.33333333%;
}
.base-col--pull-15 {
    right: 62.5%;
}
.base-col--pull-16 {
    right: 66.66666667%;
}
.base-col--pull-17 {
    right: 70.83333333%;
}
.base-col--pull-18 {
    right: 75%;
}
.base-col--pull-19 {
    right: 79.16666667%;
}
.base-col--pull-20 {
    right: 83.33333333%;
}
.base-col--pull-21 {
    right: 87.5%;
}
.base-col--pull-22 {
    right: 91.66666667%;
}
.base-col--pull-23 {
    right: 95.83333333%;
}

/* 响应式断点 */
@media (max-width: 575px) {
    .base-col--xs-1 {
        width: 4.16666667%;
    }
    .base-col--xs-2 {
        width: 8.33333333%;
    }
    .base-col--xs-3 {
        width: 12.5%;
    }
    .base-col--xs-4 {
        width: 16.66666667%;
    }
    .base-col--xs-5 {
        width: 20.83333333%;
    }
    .base-col--xs-6 {
        width: 25%;
    }
    .base-col--xs-7 {
        width: 29.16666667%;
    }
    .base-col--xs-8 {
        width: 33.33333333%;
    }
    .base-col--xs-9 {
        width: 37.5%;
    }
    .base-col--xs-10 {
        width: 41.66666667%;
    }
    .base-col--xs-11 {
        width: 45.83333333%;
    }
    .base-col--xs-12 {
        width: 50%;
    }
    .base-col--xs-13 {
        width: 54.16666667%;
    }
    .base-col--xs-14 {
        width: 58.33333333%;
    }
    .base-col--xs-15 {
        width: 62.5%;
    }
    .base-col--xs-16 {
        width: 66.66666667%;
    }
    .base-col--xs-17 {
        width: 70.83333333%;
    }
    .base-col--xs-18 {
        width: 75%;
    }
    .base-col--xs-19 {
        width: 79.16666667%;
    }
    .base-col--xs-20 {
        width: 83.33333333%;
    }
    .base-col--xs-21 {
        width: 87.5%;
    }
    .base-col--xs-22 {
        width: 91.66666667%;
    }
    .base-col--xs-23 {
        width: 95.83333333%;
    }
    .base-col--xs-24 {
        width: 100%;
    }
}

@media (min-width: 576px) {
    .base-col--sm-1 {
        width: 4.16666667%;
    }
    .base-col--sm-2 {
        width: 8.33333333%;
    }
    .base-col--sm-3 {
        width: 12.5%;
    }
    .base-col--sm-4 {
        width: 16.66666667%;
    }
    .base-col--sm-5 {
        width: 20.83333333%;
    }
    .base-col--sm-6 {
        width: 25%;
    }
    .base-col--sm-7 {
        width: 29.16666667%;
    }
    .base-col--sm-8 {
        width: 33.33333333%;
    }
    .base-col--sm-9 {
        width: 37.5%;
    }
    .base-col--sm-10 {
        width: 41.66666667%;
    }
    .base-col--sm-11 {
        width: 45.83333333%;
    }
    .base-col--sm-12 {
        width: 50%;
    }
    .base-col--sm-13 {
        width: 54.16666667%;
    }
    .base-col--sm-14 {
        width: 58.33333333%;
    }
    .base-col--sm-15 {
        width: 62.5%;
    }
    .base-col--sm-16 {
        width: 66.66666667%;
    }
    .base-col--sm-17 {
        width: 70.83333333%;
    }
    .base-col--sm-18 {
        width: 75%;
    }
    .base-col--sm-19 {
        width: 79.16666667%;
    }
    .base-col--sm-20 {
        width: 83.33333333%;
    }
    .base-col--sm-21 {
        width: 87.5%;
    }
    .base-col--sm-22 {
        width: 91.66666667%;
    }
    .base-col--sm-23 {
        width: 95.83333333%;
    }
    .base-col--sm-24 {
        width: 100%;
    }
}

@media (min-width: 768px) {
    .base-col--md-1 {
        width: 4.16666667%;
    }
    .base-col--md-2 {
        width: 8.33333333%;
    }
    .base-col--md-3 {
        width: 12.5%;
    }
    .base-col--md-4 {
        width: 16.66666667%;
    }
    .base-col--md-5 {
        width: 20.83333333%;
    }
    .base-col--md-6 {
        width: 25%;
    }
    .base-col--md-7 {
        width: 29.16666667%;
    }
    .base-col--md-8 {
        width: 33.33333333%;
    }
    .base-col--md-9 {
        width: 37.5%;
    }
    .base-col--md-10 {
        width: 41.66666667%;
    }
    .base-col--md-11 {
        width: 45.83333333%;
    }
    .base-col--md-12 {
        width: 50%;
    }
    .base-col--md-13 {
        width: 54.16666667%;
    }
    .base-col--md-14 {
        width: 58.33333333%;
    }
    .base-col--md-15 {
        width: 62.5%;
    }
    .base-col--md-16 {
        width: 66.66666667%;
    }
    .base-col--md-17 {
        width: 70.83333333%;
    }
    .base-col--md-18 {
        width: 75%;
    }
    .base-col--md-19 {
        width: 79.16666667%;
    }
    .base-col--md-20 {
        width: 83.33333333%;
    }
    .base-col--md-21 {
        width: 87.5%;
    }
    .base-col--md-22 {
        width: 91.66666667%;
    }
    .base-col--md-23 {
        width: 95.83333333%;
    }
    .base-col--md-24 {
        width: 100%;
    }
}

@media (min-width: 992px) {
    .base-col--lg-1 {
        width: 4.16666667%;
    }
    .base-col--lg-2 {
        width: 8.33333333%;
    }
    .base-col--lg-3 {
        width: 12.5%;
    }
    .base-col--lg-4 {
        width: 16.66666667%;
    }
    .base-col--lg-5 {
        width: 20.83333333%;
    }
    .base-col--lg-6 {
        width: 25%;
    }
    .base-col--lg-7 {
        width: 29.16666667%;
    }
    .base-col--lg-8 {
        width: 33.33333333%;
    }
    .base-col--lg-9 {
        width: 37.5%;
    }
    .base-col--lg-10 {
        width: 41.66666667%;
    }
    .base-col--lg-11 {
        width: 45.83333333%;
    }
    .base-col--lg-12 {
        width: 50%;
    }
    .base-col--lg-13 {
        width: 54.16666667%;
    }
    .base-col--lg-14 {
        width: 58.33333333%;
    }
    .base-col--lg-15 {
        width: 62.5%;
    }
    .base-col--lg-16 {
        width: 66.66666667%;
    }
    .base-col--lg-17 {
        width: 70.83333333%;
    }
    .base-col--lg-18 {
        width: 75%;
    }
    .base-col--lg-19 {
        width: 79.16666667%;
    }
    .base-col--lg-20 {
        width: 83.33333333%;
    }
    .base-col--lg-21 {
        width: 87.5%;
    }
    .base-col--lg-22 {
        width: 91.66666667%;
    }
    .base-col--lg-23 {
        width: 95.83333333%;
    }
    .base-col--lg-24 {
        width: 100%;
    }
}

@media (min-width: 1200px) {
    .base-col--xl-1 {
        width: 4.16666667%;
    }
    .base-col--xl-2 {
        width: 8.33333333%;
    }
    .base-col--xl-3 {
        width: 12.5%;
    }
    .base-col--xl-4 {
        width: 16.66666667%;
    }
    .base-col--xl-5 {
        width: 20.83333333%;
    }
    .base-col--xl-6 {
        width: 25%;
    }
    .base-col--xl-7 {
        width: 29.16666667%;
    }
    .base-col--xl-8 {
        width: 33.33333333%;
    }
    .base-col--xl-9 {
        width: 37.5%;
    }
    .base-col--xl-10 {
        width: 41.66666667%;
    }
    .base-col--xl-11 {
        width: 45.83333333%;
    }
    .base-col--xl-12 {
        width: 50%;
    }
    .base-col--xl-13 {
        width: 54.16666667%;
    }
    .base-col--xl-14 {
        width: 58.33333333%;
    }
    .base-col--xl-15 {
        width: 62.5%;
    }
    .base-col--xl-16 {
        width: 66.66666667%;
    }
    .base-col--xl-17 {
        width: 70.83333333%;
    }
    .base-col--xl-18 {
        width: 75%;
    }
    .base-col--xl-19 {
        width: 79.16666667%;
    }
    .base-col--xl-20 {
        width: 83.33333333%;
    }
    .base-col--xl-21 {
        width: 87.5%;
    }
    .base-col--xl-22 {
        width: 91.66666667%;
    }
    .base-col--xl-23 {
        width: 95.83333333%;
    }
    .base-col--xl-24 {
        width: 100%;
    }
}

@media (min-width: 1600px) {
    .base-col--xxl-1 {
        width: 4.16666667%;
    }
    .base-col--xxl-2 {
        width: 8.33333333%;
    }
    .base-col--xxl-3 {
        width: 12.5%;
    }
    .base-col--xxl-4 {
        width: 16.66666667%;
    }
    .base-col--xxl-5 {
        width: 20.83333333%;
    }
    .base-col--xxl-6 {
        width: 25%;
    }
    .base-col--xxl-7 {
        width: 29.16666667%;
    }
    .base-col--xxl-8 {
        width: 33.33333333%;
    }
    .base-col--xxl-9 {
        width: 37.5%;
    }
    .base-col--xxl-10 {
        width: 41.66666667%;
    }
    .base-col--xxl-11 {
        width: 45.83333333%;
    }
    .base-col--xxl-12 {
        width: 50%;
    }
    .base-col--xxl-13 {
        width: 54.16666667%;
    }
    .base-col--xxl-14 {
        width: 58.33333333%;
    }
    .base-col--xxl-15 {
        width: 62.5%;
    }
    .base-col--xxl-16 {
        width: 66.66666667%;
    }
    .base-col--xxl-17 {
        width: 70.83333333%;
    }
    .base-col--xxl-18 {
        width: 75%;
    }
    .base-col--xxl-19 {
        width: 79.16666667%;
    }
    .base-col--xxl-20 {
        width: 83.33333333%;
    }
    .base-col--xxl-21 {
        width: 87.5%;
    }
    .base-col--xxl-22 {
        width: 91.66666667%;
    }
    .base-col--xxl-23 {
        width: 95.83333333%;
    }
    .base-col--xxl-24 {
        width: 100%;
    }
}
</style>
