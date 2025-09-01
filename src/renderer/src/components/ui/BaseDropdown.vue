<template>
    <Menu as="div" class="relative inline-block text-left">
        <MenuButton
            :class="[
                'inline-flex w-full justify-center items-center gap-x-1.5 rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition-colors',
                'bg-[var(--color-card-bg)] text-[var(--color-text)] border border-[var(--color-border)]',
                'hover:bg-[var(--color-card-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2',
            ]"
        >
            <slot name="trigger">
                {{ triggerText }}
            </slot>
            <PhCaretDown
                v-if="showArrow"
                class="-mr-1 h-5 w-5 text-[var(--color-text-secondary)]"
                aria-hidden="true"
            />
        </MenuButton>

        <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
        >
            <MenuItems
                :class="[
                    'absolute z-10 mt-2 origin-top-right rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none',
                    'bg-[var(--color-card-bg)] border border-[var(--color-border)]',
                    positionClasses,
                    widthClasses,
                ]"
            >
                <div class="py-1">
                    <slot />
                </div>
            </MenuItems>
        </transition>
    </Menu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Menu, MenuButton, MenuItems } from "@headlessui/vue";
import { PhCaretDown } from "@phosphor-icons/vue";

interface Props {
    triggerText?: string;
    showArrow?: boolean;
    position?: "left" | "right";
    width?: "auto" | "full" | "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<Props>(), {
    triggerText: "Options",
    showArrow: true,
    position: "right",
    width: "auto",
});

const positionClasses = computed(() => {
    return props.position === "left" ? "left-0" : "right-0";
});

const widthClasses = computed(() => {
    switch (props.width) {
        case "full":
            return "w-full";
        case "sm":
            return "w-32";
        case "md":
            return "w-48";
        case "lg":
            return "w-64";
        default:
            return "w-56";
    }
});
</script>
