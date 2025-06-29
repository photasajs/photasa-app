<script setup lang="ts">
import { ref, reactive, UnwrapRef, computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { usePreferenceStore } from "@renderer/stores/preference";
import { usePhotosStore } from "@renderer/stores/photos";
import { chooseDirectory, scanSubfolders } from "@renderer/utils/api";
import LanguageSwitcher from "../LanguageSwitcher.vue";
import { FolderTwoTone, CloseOutlined } from "@ant-design/icons-vue";
import { notification } from "ant-design-vue";

defineOptions({
    name: "GeneralSettings",
});

const { t } = useI18n();

interface FormState {
    name: string;
}

const preferenceStore = usePreferenceStore();
const { addPath, removePath, addScanFolder } = preferenceStore;
const { paths, thumbnailSize } = storeToRefs(preferenceStore);

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
        language: t("preference.language"),
    };
});

function isDuplicate(path: string): boolean {
    return paths.value.includes(path);
}

async function onChoose(): Promise<void> {
    try {
        const { filePaths } = await chooseDirectory();
        if (!filePaths || filePaths.length === 0) {
            notification.info({
                message: t("notification.emptyPath.title"),
                description: t("notification.emptyPath.message"),
            });
            return;
        }
        const path = filePaths[0];
        if (isDuplicate(path)) {
            notification.warning({
                message: t("notification.duplicatePath.title"),
                description: t("notification.duplicatePath.message", { folder: path }),
            });
            return;
        }
        addPath(path);
        try {
            const folders = await scanSubfolders(path);
            folders.forEach((f) => addScanFolder(f, "scan"));
            addScanFolder(path, "current");
        } catch (scanError: unknown) {
            // If scanning fails, still add the main path but show a warning
            const errorMessage =
                scanError instanceof Error ? scanError.message : t("notification.unknownError");
            notification.warning({
                message: t("notification.scanError.title"),
                description: t("notification.scanError.message", { path, error: errorMessage }),
            });
            addScanFolder(path, "current");
        }
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : t("notification.unknownError");
        notification.error({
            message: t("notification.error"),
            description: errorMessage,
        });
    }
}

function handleRemove(item): void {
    removePath(item);
}
</script>

<template>
    <a-form :model="formState" layout="vertical">
        <a-form-item :label="t('preference.watchFolderList')">
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
                </a-list>
                <a-button type="primary" @click="onChoose">{{ label.chooseDirectory }}</a-button>
            </a-space>
        </a-form-item>
        <a-form-item :label="`${label.thumbnailSize} : ${thumbnailSize}px`">
            <a-slider v-model:value="thumbnailSize" :min="150" :max="400"></a-slider>
        </a-form-item>
    </a-form>
</template>

<style scoped lang="less">
.import-message-list {
    height: 300px;
    overflow: auto;
}
</style>
