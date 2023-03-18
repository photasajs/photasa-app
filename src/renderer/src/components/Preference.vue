<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { ref, reactive, UnwrapRef, computed } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { usePhotosStore } from "@renderer/stores/photos";
import { chooseDirectory, createThumbnailTask, updatePhotoList } from "@renderer/utils/api";
import { storeToRefs } from "pinia";
import type { TabsProps } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import About from "./About.vue";
import { FolderTwoTone, CloseOutlined } from "@ant-design/icons-vue";
import { notification } from "ant-design-vue";
import { scanPhotos } from "@renderer/utils/api";
import type { PhotoPath } from "../../../preload/types";


const { t } = useI18n();

interface FormState {
    name: string;
}

const preferenceStore = usePreferenceStore();
const { addPath, removePath } = preferenceStore;
const { paths, thumbnailSize, darkMode } = storeToRefs(preferenceStore);

const photosStore = usePhotosStore();
const { addFile } = photosStore;

function isDuplicate(path: string): boolean {
    return paths.value.includes(path);
}

type ScanArgs = {
    type: "next" | "error" | "complete";
    action?: PhotoPath;
    error?: {
        message: string;
    };
};

const processed = reactive<string[]>([]);
const handler: Record<string, (args: ScanArgs | undefined) => void> = {
    next: (args): void => {
        if (args?.action?.path) {
            processed.push(args.action.path);
            // Save to .photasa.json
            updatePhotoList(args.action.path)
                // Create thumbnail
                .then((photasaConfig) => {
                    return createThumbnailTask.perform({
                        path: args.action?.path as string,
                        thumbnail: args.action?.thumbnail as string,
                        width: thumbnailSize.value,
                        height: thumbnailSize.value,
                    }).then(() => {
                        // Add to fileList
                        photasaConfig.photoList.forEach(p => {
                            addFile(paths.value, {
                                path: p.path,
                                thumbnail: p.thumbnail,
                            })
                        })
                    })
                });
        }
    },
    error: (args): void => {
        if (args?.error?.message) {
            processed.push(args.error.message);
        }
    },
    complete: (): void => {
        showScanning.value = false;
    },
};

function onChoose(): void {
    chooseDirectory().then(({ filePaths }) => {
        if (isDuplicate(filePaths[0])) {
            openNotificationWithIcon(
                "warning",
                "Duplicate folder",
                `The folder [${filePaths[0]}] is already in the list`,
            );
            return;
        }
        if (filePaths.length <= 0) {
            openNotificationWithIcon("info", "Empty Path", "Please select a folder");
            return;
        }

        addPath(filePaths[0]);
        showScanning.value = true;
        scanPhotos(filePaths[0], (args) => {
            handler[args.type]?.call(null, args);
        });
    });
}
const activeKey = ref(1);
const showScanning = ref(false);
const mode = ref<TabsProps["tabPosition"]>("left");
const formState: UnwrapRef<FormState> = reactive({
    name: "",
});
const label = computed(() => {
    return {
        watchFolderList: t("preference.watchFolderList"),
        chooseDirectory: t("preference.chooseDirectory"),
        thumbnailSize: t("preference.thumbnailSize"),
        folderList: t("preference.folderList"),
        folderListUsage: t("preference.folderListUsage"),
        folderListDesc: t("preference.folderListDesc"),
        darkMode: t("preference.darkMode"),
        scanning: t("preference.scanning"),
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
                <a-form-item :label="label.watchFolderList">
                    <a-space direction="vertical">
                        <a-list size="small" bordered :data-source="paths" class="import-message-list">
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
                                        <a-button @click="handleRemove(item)"><close-outlined /></a-button>
                                    </template>
                                    <a-skeleton avatar :title="false" :loading="!!item.loading" active>
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
                <a-form-item :label="`${label.thumbnailSize}: ${thumbnailSize}px`">
                    <a-slider v-model:value="thumbnailSize" :min="150" :max="400"></a-slider>
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
    <a-modal v-model:visible="showScanning" :mask-closable="false" :title="label.scanning" width="800px">
        <div>{{ processed }}</div>
        <template #footer></template>
    </a-modal>
</template>
<style scoped lang="less">
.import-message-list {
    height: 300px;
    overflow: auto;
}
</style>
