<template>
    <li class="breadcrumb-item" :class="{ 'breadcrumb-item-active': !href }">
        <component
            :is="href ? 'a' : 'span'"
            :href="href"
            class="breadcrumb-link"
            @click="handleClick"
        >
            <slot></slot>
        </component>
        <span v-if="!isLast" class="breadcrumb-separator" aria-hidden="true">
            {{ separator }}
        </span>
    </li>
</template>

<script setup lang="ts">
interface BaseBreadcrumbItemProps {
    href?: string;
    separator?: string;
    isLast?: boolean;
}

const props = withDefaults(defineProps<BaseBreadcrumbItemProps>(), {
    separator: "/",
    isLast: false,
});

const emit = defineEmits<{
    click: [event: MouseEvent];
}>();

const handleClick = (event: MouseEvent) => {
    if (!props.href) {
        event.preventDefault();
    }
    emit("click", event);
};
</script>

<style scoped>
.breadcrumb-item {
    display: inline-flex;
    align-items: center;
}

.breadcrumb-item:not(:last-child) {
    margin-right: 8px;
}

.breadcrumb-link {
    color: var(--color-text-secondary);
    text-decoration: none;
    transition: color 0.3s;
    cursor: pointer;
}

.breadcrumb-link:hover {
    color: var(--color-text);
}

.breadcrumb-item-active .breadcrumb-link {
    color: var(--color-text);
    cursor: default;
}

.breadcrumb-item-active .breadcrumb-link:hover {
    color: var(--color-text);
}

.breadcrumb-separator {
    margin-left: 8px;
    color: var(--color-text-secondary);
}
</style>
