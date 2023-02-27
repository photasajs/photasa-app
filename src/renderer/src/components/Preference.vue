<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { ref, reactive, UnwrapRef, computed } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { chooseDirectory } from "@renderer/utils/api";
import { storeToRefs } from "pinia";
import type { TabsProps } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import About from "./About.vue";

const { t } = useI18n();

interface FormState {
    name: string;
}
const store = usePreferenceStore();
const { paths, thumbnailSize } = storeToRefs(store);

function onChoose(): void {
    chooseDirectory().then(({ filePaths }) => {
        if (filePaths.length > 0) {
            store.addPath(filePaths[0]);
        }
    });
}
const activeKey = ref(1);
const mode = ref<TabsProps["tabPosition"]>("left");
const formState: UnwrapRef<FormState> = reactive({
    name: "",
});
const msg = computed(() => {
    return {
        watchFolderList: t("preference.watchFolderList"),
        chooseDirectory: t("preference.chooseDirectory"),
        thumbnailSize: t("preference.thumbnailSize"),
        tabs: {
            general: t("preference.tabs.general"),
            about: t("preference.tabs.about"),
        },
    };
});
const formlayout = ref("vertical");
const formItemLayout = computed(() => {
    return formlayout.value === "horizontal"
        ? {
              labelCol: { span: 4 },
              wrapperCol: { span: 14 },
          }
        : {};
});
</script>

<template>
    <a-tabs v-model:activeKey="activeKey" :tab-position="mode" :style="{ minHeight: '50vh' }">
        <a-tab-pane :key="1" :tab="msg.tabs.general">
            <a-form :model="formState" v-bind="formItemLayout" :layout="formlayout">
                <a-form-item :label="msg.watchFolderList">
                    <a-space direction="vertical">
                        <a-list
                            size="small"
                            bordered
                            :data-source="paths"
                            class="import-message-list"
                        >
                            <template #header>
                                <a-descriptions title="Folder List">
                                    <a-descriptions-item label="Usage"
                                        >Watch change in the folder</a-descriptions-item
                                    >
                                </a-descriptions>
                            </template>
                            <template #renderItem="{ item }">
                                <a-list-item>{{ item }}</a-list-item>
                            </template>
                            <template #footer> </template>
                        </a-list>
                        <a-button type="primary" @click="onChoose">{{
                            msg.chooseDirectory
                        }}</a-button>
                    </a-space>
                </a-form-item>
                <a-form-item :label="`${msg.thumbnailSize}: ${thumbnailSize}px`">
                    <a-slider v-model:value="thumbnailSize" :min="150" :max="400"></a-slider>
                </a-form-item>
            </a-form>
        </a-tab-pane>
        <a-tab-pane :key="2" :tab="msg.tabs.about">
            <About></About>
        </a-tab-pane>
    </a-tabs>
</template>
<style scoped lang="less">
.import-message-list {
    height: 300px;
    overflow: auto;
}
</style>
