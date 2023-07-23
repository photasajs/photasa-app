<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import { UnwrapRef, computed } from "vue";
import { reactive, ref } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { chooseDirectory, importPhotos } from "@renderer/utils/api";
import type { SelectProps } from "ant-design-vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

interface FormState {
    name: string;
    allowDuplicateRename: boolean;
    type: string[];
    resource: string;
    desc: string;
    targetDir: string;
}

// Define props and emits
const props = withDefaults(
    defineProps<{
        show: boolean;
    }>(),
    {
        show: () => false,
    },
);
const emit = defineEmits<{ (e: "update:show", show: boolean): void }>();

const { t } = useI18n();
const label = computed(() => {
    return {
        photos: t("import.photos"),
        chooseDirectory: t("import.chooseDirectory"),
        targetDirectory: t("import.targetDirectory"),
        allowDuplicateRename: t("import.allowDuplicateRename"),
        import: t("import.button.import"),
        cancel: t("import.button.cancel"),
    };
});

const store = usePreferenceStore();
const { paths } = storeToRefs(store);
const processed = reactive<string[]>([]);
const labelCol = reactive({ style: { width: "150px" } });
const wrapperCol = reactive({ span: 14 });
const formState: UnwrapRef<FormState> = reactive({
    name: "",
    allowDuplicateRename: true,
    type: [],
    resource: "",
    desc: "",
    targetDir: store.paths[0],
});
const showConfigModal = computed({
    get() {
        return props.show;
    },
    set(value) {
        emit("update:show", value);
    },
});
const showProgressModal = ref(false);

type ImportArgs = {
    type: "next" | "error" | "complete";
    action?: {
        targetFileName: string;
    };
    error?: {
        message: string;
    };
};

const importHandler: Record<string, (args: ImportArgs | undefined) => void> = {
    next: (args): void => {
        if (args?.action?.targetFileName) {
            processed.push(args.action.targetFileName);
        }
    },
    error: (args): void => {
        if (args?.error?.message) {
            processed.push(args.error.message);
        }
        showProgressModal.value = false;
    },
    complete: (): void => {
        showProgressModal.value = false;
    },
};

function onImport(): void {
    showProgressModal.value = true;
    showConfigModal.value = false;

    const dir = `${formState.name}`;
    importPhotos([dir], formState.targetDir, (args) => {
        importHandler[args.type]?.call(null, <ImportArgs>args);
    });
}

function onChoose(): void {
    processed.splice(0, processed.length);
    chooseDirectory().then(({ filePaths }) => {
        if (filePaths.length > 0) {
            formState.name = filePaths[0];
        }
    });
}

const pathOptions = computed<SelectProps["options"]>(() => {
    return paths.value.map((path) => {
        return {
            value: path,
            label: path,
        };
    });
});
</script>

<template>
    <a-modal
        v-model:visible="showConfigModal"
        :mask-closable="false"
        :title="label.photos"
        width="800px"
        :ok-text="label.import"
        :cancel-text="label.cancel"
        @ok="onImport"
    >
        <a-form :model="formState" :label-col="labelCol" :wrapper-col="wrapperCol">
            <a-form-item :label="label.chooseDirectory">
                <a-space>
                    <a-input v-model:value="formState.name" width="800px" />
                    <a-button type="primary" @click="onChoose">...</a-button>
                </a-space>
            </a-form-item>
            <a-form-item :label="label.allowDuplicateRename">
                <a-switch v-model:checked="formState.allowDuplicateRename" />
            </a-form-item>
            <a-form-item label="Activity type">
                <a-checkbox-group v-model:value="formState.type">
                    <a-checkbox value="1" name="type">Online</a-checkbox>
                    <a-checkbox value="2" name="type">Promotion</a-checkbox>
                    <a-checkbox value="3" name="type">Offline</a-checkbox>
                </a-checkbox-group>
            </a-form-item>
            <a-form-item label="Resources">
                <a-radio-group v-model:value="formState.resource">
                    <a-radio value="1">Sponsor</a-radio>
                    <a-radio value="2">Venue</a-radio>
                </a-radio-group>
            </a-form-item>
            <a-form-item :label="label.targetDirectory">
                <a-select
                    ref="select"
                    v-model:value="formState.targetDir"
                    style="width: 100%"
                    :options="pathOptions"
                ></a-select>
            </a-form-item>
        </a-form>
    </a-modal>
    <a-modal
        v-model:visible="showProgressModal"
        :mask-closable="false"
        :closable="false"
        title="Importing"
    >
        <template #footer> </template>
        <a-list size="small" bordered :data-source="processed" class="import-message-list">
            <template #renderItem="{ item }">
                <a-list-item>{{ item }}</a-list-item>
            </template>
            <template #header>
                <a-spin></a-spin>
            </template>
            <template #footer></template>
        </a-list>
    </a-modal>
</template>
<style scoped lang="less">
.import-message-list {
    height: 300px;
    overflow: auto;
}
</style>
