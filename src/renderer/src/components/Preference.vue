<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { ref, reactive, UnwrapRef, computed } from "vue";
import { storeToRefs } from "pinia";
import type { TabsProps } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { usePreferenceStore } from "@renderer/stores/preference";
import { usePhotosStore } from "@renderer/stores/photos";
import { chooseDirectory, scanSubfolders } from "@renderer/utils/api";
import LanguageSwitcher from "./LanguageSwitcher.vue";

import { FolderTwoTone, CloseOutlined } from "@ant-design/icons-vue";
import { notification } from "ant-design-vue";

import About from "./About.vue";

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

function onChoose(): void {
    chooseDirectory().then(({ filePaths }) => {
        if (isDuplicate(filePaths[0])) {
            openNotificationWithIcon(
                "warning",
                t("notification.duplicatePath.title"),
                t("notification.duplicatePath.message", { path: filePaths[0] }),
            );
            return;
        }
        if (filePaths.length <= 0) {
            openNotificationWithIcon(
                "info",
                t("notification.emptyPath.title"),
                t("notification.emptyPath.message"),
            );
            return;
        }
        // Save to preference
        addPath(filePaths[0]);

        // Add Level 1 Subfolders
        scanSubfolders(filePaths[0])
            .then((folders) => {
                folders.forEach((f) => addScanFolder(f, "scan"));
            })
            .then(() => {
                // Add Self
                addScanFolder(filePaths[0], "current");
            });
    });
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
            <a-form :model="formState" v-bind="formItemLayout" :layout="formLayout">
                <a-form-item :label="t('preference.watchFolderList')">
                    <a-space direction="vertical">
                        <a-list
                            size="small"
                            bordered
                            :data-source="paths"
                            class="import-message-list"
                        >
                            <template #header>
                                <a-descriptions :title="label.folderList">
                                    <a-descriptions-item :label="label.folderListUsage">{{
                                        label.folderListDesc
                                    }}</a-descriptions-item>
                                </a-descriptions>
                            </template>
                            <template #renderItem="{ item }">
                                <a-list-item>
                                    <template #actions>
                                        <a-button @click="handleRemove(item)"
                                            ><close-outlined
                                        /></a-button>
                                    </template>
                                    <a-skeleton
                                        avatar
                                        :title="false"
                                        :loading="!!item.loading"
                                        active
                                    >
                                        <a-list-item-meta>
                                            <template #title>
                                                {{ item }}
                                            </template>
                                            <template #avatar>
                                                <folder-two-tone />
                                            </template>
                                        </a-list-item-meta>
                                    </a-skeleton>
                                </a-list-item>
                            </template>
                            <template #footer> </template>
                        </a-list>
                        <a-button type="primary" @click="onChoose">{{
                            label.chooseDirectory
                        }}</a-button>
                    </a-space>
                </a-form-item>
                <a-form-item :label="`${label.thumbnailSize} : ${thumbnailSize}px`">
                    <a-slider v-model:value="thumbnailSize" :min="150" :max="400"></a-slider>
                </a-form-item>
                <a-form-item :label="label.language">
                    <div class="language-settings">
                        <LanguageSwitcher />
                    </div>
                </a-form-item>
            </a-form>
        </a-tab-pane>
        <a-tab-pane :key="2" :tab="label.tabs.theme">
            <a-form :model="formState" v-bind="formItemLayout" layout="horizontal">
                <a-form-item :label="label.darkMode">
                    <a-switch v-model:checked="darkMode" />
                </a-form-item>
            </a-form>
        </a-tab-pane>
        <a-tab-pane :key="3" :tab="label.tabs.about">
            <About></About>
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
