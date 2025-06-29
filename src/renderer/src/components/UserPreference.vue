<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { ref, reactive, UnwrapRef, computed } from "vue";
import { storeToRefs } from "pinia";
import type { TabsProps } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { usePreferenceStore } from "@renderer/stores/preference";
import { usePhotosStore } from "@renderer/stores/photos";
import { chooseDirectory, scanSubfolders } from "@renderer/utils/api";
import LanguageSettings from "./settings/LanguageSettings.vue";
import GeneralSettings from "./settings/GeneralSettings.vue";
import AboutPhotosa from "./settings/AboutPhotosa.vue";
import ThemeSettings from "./settings/ThemeSettings.vue";
import { notification } from "ant-design-vue";

defineOptions({
    name: "UserPreference",
});

const { t } = useI18n();

interface FormState {
    name: string;
}

const preferenceStore = usePreferenceStore();
const { addPath, removePath, addScanFolder } = preferenceStore;
const { paths, thumbnailSize, darkMode } = storeToRefs(preferenceStore);

const photosStore = usePhotosStore();
const { processingFile } = storeToRefs(photosStore);

const activeKey = ref(1);
const showScanning = ref(false);
const mode = ref<TabsProps["tabPosition"]>("left");
const formState: UnwrapRef<FormState> = reactive({
    name: "",
});

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
const formLayout = ref("vertical");
const formItemLayout = computed(() => {
    return formLayout.value === "horizontal"
        ? {
              labelCol: { span: 4 },
              wrapperCol: { span: 14 },
          }
        : {};
});

function isDuplicate(path: string): boolean {
    return paths.value.includes(path);
}

async function onChoose(): Promise<void> {
    try {
        const { filePaths } = await chooseDirectory();
        if (!filePaths || filePaths.length === 0) {
            openNotificationWithIcon(
                "info",
                t("notification.emptyPath.title"),
                t("notification.emptyPath.message"),
            );
            return;
        }
        const path = filePaths[0];
        if (isDuplicate(path)) {
            openNotificationWithIcon(
                "warning",
                t("notification.duplicatePath.title"),
                t("notification.duplicatePath.message", { path }),
            );
            return;
        }
        addPath(path);

        const folders = await scanSubfolders(path);
        folders.forEach((f) => addScanFolder(f, "scan"));
        addScanFolder(path, "current");
    } catch (error) {
        openNotificationWithIcon(
            "error",
            t("notification.error"),
            error?.message || t("notification.unknownError"),
        );
    }
}

function openNotificationWithIcon(type: string, message, description): void {
    notification[type]({
        message,
        description,
    });
}

function handleRemove(item): void {
    removePath(item);
}
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
