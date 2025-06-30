<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import type { TabsProps } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { usePhotosStore } from "@renderer/stores/photos";
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

const activeKey = ref(1);
const showScanning = ref(false);
const mode = ref<TabsProps["tabPosition"]>("left");

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
        },
    };
});
</script>

<template>
    <a-tabs v-model:activeKey="activeKey" :tab-position="mode" :style="{ minHeight: '50vh' }">
        <a-tab-pane :key="1" :tab="label.tabs.general">
            <GeneralSettings />
        </a-tab-pane>
        <a-tab-pane :key="2" :tab="label.tabs.theme">
            <ThemeSettings />
        </a-tab-pane>
        <a-tab-pane :key="4" :tab="label.language">
            <LanguageSettings />
        </a-tab-pane>
        <a-tab-pane :key="3" :tab="label.tabs.about">
            <AboutPhotosa></AboutPhotosa>
        </a-tab-pane>
        <a-tab-pane :key="5" tab="高级配置">
            <AdvancedSettings />
        </a-tab-pane>
    </a-tabs>
    <a-modal
        v-model:visible="showScanning"
        :mask-closable="false"
        :title="label.scanning"
        width="800px"
    >
        <a-spin>
            <div>{{}}</div>
        </a-spin>
        <template #footer>{{ processingFile }}</template>
    </a-modal>
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
