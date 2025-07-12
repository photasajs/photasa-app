<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { usePhotosStore } from "@renderer/stores/photos";
import { BaseModal, BaseTabs, BaseSpinner } from "@renderer/components/ui";
import LanguageSettings from "./settings/LanguageSettings.vue";
import GeneralSettings from "./settings/GeneralSettings.vue";
import AboutPhotosa from "./settings/AboutPhotosa.vue";
import ThemeSettings from "./settings/ThemeSettings.vue";
import AdvancedSettings from "./settings/AdvancedSettings.vue";

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
        },
    };
});

const tabsData = computed(() => [
    { key: "general", label: label.value.tabs.general },
    { key: "theme", label: label.value.tabs.theme },
    { key: "language", label: label.value.language },
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
        class="min-h-[50vh]"
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
        <template #about>
            <AboutPhotosa />
        </template>
        <template #advanced>
            <AdvancedSettings />
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
.import-message-list {
    height: 300px;
    overflow: auto;
}

.language-settings {
    margin-top: 8px;
}
</style>
