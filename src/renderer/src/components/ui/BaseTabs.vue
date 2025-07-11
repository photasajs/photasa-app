<template>
    <TabGroup :selectedIndex="selectedIndex" @change="handleChange">
        <div :class="orientation === 'vertical' ? 'flex gap-6' : ''">
            <TabList
                :class="[
                    orientation === 'vertical'
                        ? 'flex flex-col space-y-1 border-r border-[var(--color-border)] min-w-[200px] pr-4'
                        : 'flex space-x-1 border-b border-[var(--color-border)]',
                    positionClasses,
                ]"
            >
                <Tab
                    v-for="(tab, index) in tabs"
                    :key="tab.key || index"
                    v-slot="{ selected }"
                    as="template"
                >
                    <button
                        :class="[
                            'py-2.5 px-4 text-sm font-medium leading-5 transition-all duration-150',
                            'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2',
                            orientation === 'vertical'
                                ? selected
                                    ? 'text-[var(--color-primary)] bg-[var(--color-primary-bg)] border-r-2 border-[var(--color-primary)]'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-card-hover)]'
                                : selected
                                  ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-card-hover)]',
                            tabClasses,
                        ]"
                    >
                        <div
                            :class="
                                orientation === 'vertical'
                                    ? 'flex items-center justify-start gap-2'
                                    : 'flex items-center justify-center gap-2'
                            "
                        >
                            <component v-if="tab.icon" :is="tab.icon" class="h-4 w-4" />
                            {{ tab.label }}
                        </div>
                    </button>
                </Tab>
            </TabList>

            <TabPanels :class="orientation === 'vertical' ? 'flex-1 overflow-auto' : 'mt-4'">
                <TabPanel
                    v-for="(tab, index) in tabs"
                    :key="tab.key || index"
                    :class="[
                        'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2',
                        'transition-all duration-150',
                        orientation === 'vertical' ? 'h-full overflow-auto' : '',
                    ]"
                >
                    <slot :name="tab.key || `panel-${index}`" :tab="tab" :index="index">
                        <div v-if="tab.content" v-html="tab.content" />
                    </slot>
                </TabPanel>
            </TabPanels>
        </div>
    </TabGroup>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from "@headlessui/vue";

interface TabItem {
    key?: string;
    label: string;
    content?: string;
    icon?: any;
    disabled?: boolean;
}

interface Props {
    tabs: TabItem[];
    selectedIndex?: number;
    position?: "left" | "center" | "right";
    size?: "sm" | "md" | "lg";
    orientation?: "horizontal" | "vertical";
}

const props = withDefaults(defineProps<Props>(), {
    selectedIndex: 0,
    position: "left",
    size: "md",
    orientation: "horizontal",
});

const emit = defineEmits<{
    change: [index: number, tab: TabItem];
}>();

const handleChange = (index: number) => {
    emit("change", index, props.tabs[index]);
};

const positionClasses = computed(() => {
    switch (props.position) {
        case "center":
            return "justify-center";
        case "right":
            return "justify-end";
        default:
            return "justify-start";
    }
});

const tabClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "py-1.5 px-3 text-xs";
        case "lg":
            return "py-3 px-6 text-base";
        default:
            return "py-2.5 px-4 text-sm";
    }
});
</script>
