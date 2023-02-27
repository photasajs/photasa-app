<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { ref, reactive, UnwrapRef, computed } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { chooseDirectory } from "@renderer/utils/api";
import { storeToRefs } from "pinia";
import type { TabsProps } from "ant-design-vue";

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
        <a-tab-pane :key="1" tab="General">
            <a-form :model="formState" v-bind="formItemLayout" :layout="formlayout">
                <a-form-item label="Choose a folder to import">
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
                            <template #footer>
                                <div></div>
                            </template>
                        </a-list>
                        <a-button type="primary" @click="onChoose">Choose Directory</a-button>
                    </a-space>
                </a-form-item>
                <a-form-item :label="`Thumbnail Image Size: ${thumbnailSize}px`">
                    <a-slider v-model:value="thumbnailSize" :min="150" :max="400"></a-slider>
                </a-form-item>
            </a-form>
        </a-tab-pane>
    </a-tabs>
</template>
<style scoped lang="less">
.import-message-list {
    height: 300px;
    overflow: auto;
}
</style>
