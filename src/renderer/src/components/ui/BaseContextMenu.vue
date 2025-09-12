<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onClickOutside } from "@vueuse/core";

interface BaseContextMenuProps {
    disabled?: boolean;
}

const props = withDefaults(defineProps<BaseContextMenuProps>(), {
    disabled: false,
});

const emit = defineEmits<{
    open: [];
    close: [];
}>();

const isOpen = ref(false);
const menuRef = ref<HTMLElement>();
const triggerRef = ref<HTMLElement>();
const position = ref({ x: 0, y: 0 });

const positionStyle = computed(() => {
    return {
        position: "fixed" as const,
        top: `${position.value.y}px`,
        left: `${position.value.x}px`,
        zIndex: 1050,
    };
});

function open(event: MouseEvent) {
    if (props.disabled) return;
    event.preventDefault();
    event.stopPropagation();

    // 计算位置
    position.value = {
        x: event.clientX,
        y: event.clientY,
    };

    isOpen.value = true;
    emit("open");
}

function close() {
    isOpen.value = false;
    emit("close");
}

function handleContextMenu(event: MouseEvent) {
    open(event);
}

// 点击菜单外部关闭
onClickOutside(menuRef, close, { ignore: [triggerRef] });

// ESC 键关闭
function handleEscape(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen.value) {
        close();
    }
}

onMounted(() => {
    document.addEventListener("keydown", handleEscape);
});

onUnmounted(() => {
    document.removeEventListener("keydown", handleEscape);
});

defineExpose({
    open,
    close,
    isOpen,
});
</script>

<template>
    <div class="base-context-menu">
        <div ref="triggerRef" @contextmenu="handleContextMenu">
            <slot />
        </div>
        <Teleport to="body">
            <Transition name="menu-fade">
                <div
                    v-if="isOpen"
                    ref="menuRef"
                    class="base-context-menu-overlay"
                    :style="positionStyle"
                >
                    <slot name="menu" :close="close" />
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.base-context-menu {
    display: contents;
}

.base-context-menu-overlay {
    background: var(
        --color-menu-bg,
        var(--color-dropdown-bg, var(--color-bg-elevated, var(--color-bg-secondary)))
    );
    border: 1px solid var(--color-menu-border, var(--color-dropdown-border, var(--color-border)));
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    padding: 4px 0;
    min-width: 140px;
    backdrop-filter: blur(8px);
}

.menu-fade-enter-active,
.menu-fade-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
}

.menu-fade-enter-from {
    opacity: 0;
    transform: scale(0.95);
}

.menu-fade-leave-to {
    opacity: 0;
    transform: scale(0.95);
}
</style>
