<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { usePhotosStore } from "@renderer/stores/photos";
import { BaseModal, BaseTabs, BaseSpinner } from "@renderer/components/ui";
import LanguageSettings from "./settings/LanguageSettings.vue";
import GeneralSettings from "./settings/GeneralSettings.vue";
import AboutPhotasa from "./settings/AboutPhotasa.vue";
import ThemeSettings from "./settings/ThemeSettings.vue";
import AdvancedSettings from "./settings/AdvancedSettings.vue";
import UpdateSettings from "./settings/UpdateSettings.vue";
import ScanMonitoringSettings from "./settings/ScanMonitoringSettings.vue";
import ImportSettings from "./settings/ImportSettings.vue";

defineOptions({
    name: "UserPreference",
});

const { t } = useI18n();

const photosStore = usePhotosStore();
const { processingFile } = storeToRefs(photosStore);

const activeKey = ref(0); // 改为索引0对应第一个tab (原来key=1对应general)
const showScanning = ref(false);

const label = computed(() => {
    return {
        chooseDirectory: t("preference.chooseDirectory"),
        thumbnailSize: t("preference.thumbnailSize"),
        folderList: t("preference.folderList"),
        folderListUsage: t("preference.folderListUsage"),
        folderListDesc: t("preference.folderListDesc"),
        darkMode: t("preference.darkMode"),
        scanning: t("preference.scanning"),
        language: t("preference.language"),
        tabs: {
            general: t("preference.tabs.general"),
            about: t("preference.tabs.about"),
            theme: t("preference.tabs.theme"),
            advanced: t("preference.tabs.advanced"),
            autoUpdate: t("preference.tabs.autoUpdate"),
            scanMonitoring: t("preference.tabs.scanMonitoring"),
            import: t("preference.tabs.import"),
        },
    };
});

const tabsData = computed(() => [
    { key: "general", label: label.value.tabs.general },
    { key: "theme", label: label.value.tabs.theme },
    { key: "language", label: label.value.language },
    { key: "autoUpdate", label: label.value.tabs.autoUpdate },
    { key: "import", label: label.value.tabs.import },
    { key: "scanMonitoring", label: label.value.tabs.scanMonitoring },
    { key: "about", label: label.value.tabs.about },
    { key: "advanced", label: label.value.tabs.advanced },
]);
</script>

<template>
    <BaseTabs
        :tabs="tabsData"
        :selectedIndex="activeKey"
        @change="activeKey = $event"
        orientation="vertical"
        class="h-[75vh] max-h-[600px] min-h-[450px]"
    >
        <template #general>
            <GeneralSettings />
        </template>
        <template #theme>
            <ThemeSettings />
        </template>
        <template #language>
            <LanguageSettings />
        </template>
        <template #autoUpdate>
            <UpdateSettings />
        </template>
        <template #import>
            <ImportSettings />
        </template>
        <template #scanMonitoring>
            <ScanMonitoringSettings />
        </template>
        <template #advanced>
            <AdvancedSettings />
        </template>
        <template #about>
            <AboutPhotasa />
        </template>
    </BaseTabs>
    <BaseModal
        :open="showScanning"
        :title="label.scanning"
        size="lg"
        :closable="false"
        @close="showScanning = false"
    >
        <div class="flex items-center justify-center p-8">
            <BaseSpinner size="lg" />
        </div>
        <template #footer>
            <div class="text-[var(--color-text-secondary)]">{{ processingFile }}</div>
        </template>
    </BaseModal>
</template>
<style scoped lang="less">
/* 为所有设置页面提供统一的容器样式 */
:deep(.settings-container) {
    height: 100%;
    overflow-y: auto;
    padding: 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
}

:deep(.settings-container::-webkit-scrollbar) {
    width: 6px;
}

:deep(.settings-container::-webkit-scrollbar-track) {
    background: var(--color-scrollbar-track);
    border-radius: 3px;
}

:deep(.settings-container::-webkit-scrollbar-thumb) {
    background: var(--color-scrollbar-thumb);
    border-radius: 3px;

    &:hover {
        background: var(--color-scrollbar-thumb-hover);
    }
}

/* 统一设置页面间距 */
:deep(.setting-section) {
    margin-bottom: 16px;
}

/* 保留原有的特定组件样式 */
:deep(.import-message-list) {
    height: 300px;
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
}

:deep(.import-message-list::-webkit-scrollbar) {
    width: var(--color-scrollbar-width, 8px);
    height: var(--color-scrollbar-width, 8px);
}

:deep(.import-message-list::-webkit-scrollbar-track) {
    background: var(--color-scrollbar-track);
    border-radius: var(--color-scrollbar-border-radius, 4px);
}

:deep(.import-message-list::-webkit-scrollbar-track:hover) {
    background: var(--color-scrollbar-track-hover);
}

:deep(.import-message-list::-webkit-scrollbar-thumb) {
    background: var(--color-scrollbar-thumb);
    border-radius: var(--color-scrollbar-border-radius, 4px);
    transition: all 0.2s ease;
}

:deep(.import-message-list::-webkit-scrollbar-thumb:hover) {
    background: var(--color-scrollbar-thumb-hover);
}

:deep(.import-message-list::-webkit-scrollbar-thumb:active) {
    background: var(--color-scrollbar-thumb-active);
}

:deep(.language-settings) {
    margin-top: 8px;
}
</style>
