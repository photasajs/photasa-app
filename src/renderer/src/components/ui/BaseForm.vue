<template>
    <form :class="['space-y-6', className]" @submit="handleSubmit">
        <slot />
    </form>
</template>

<script setup lang="ts">
interface Props {
    className?: string;
}

withDefaults(defineProps<Props>(), {
    className: "",
});

const emit = defineEmits<{
    submit: [event: Event];
}>();

const handleSubmit = (event: Event) => {
    emit("submit", event);
};
</script>
