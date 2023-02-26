<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import type { UnwrapRef } from "vue";
import { reactive, ref } from "vue";
import { photosStore } from "@renderer/stores/photos";
import { chooseDirectory, importPhotos } from "@renderer/utils/api";

interface FormState {
    name: string;
    delivery: boolean;
    type: string[];
    resource: string;
    desc: string;
    targetDir: string;
}

const store = photosStore();

const visible = ref(false);
const processed = reactive<string[]>([]);
const labelCol = reactive({ style: { width: "150px" } });
const wrapperCol = reactive({ span: 14 });
const formState: UnwrapRef<FormState> = reactive({
    name: "",
    delivery: false,
    type: [],
    resource: "",
    desc: "",
    targetDir: store.paths[0],
});

type ImportArgs = {
    type: "next" | "error" | "complete";
    action?: {
        targetFileName: string;
    };
    error?: {
        message: string;
    };
};

const handler: Record<string, (args: ImportArgs | undefined) => void> = {
    next: (args): void => {
        if (args?.action?.targetFileName) {
            processed.push(args.action.targetFileName);
        }
    },
    error: (args): void => {
        if (args?.error?.message) {
            processed.push(args.error.message);
        }
        visible.value = false;
    },
    complete: (): void => {
        visible.value = false;
    },
};

function onImport(): void {
    visible.value = true;

    const dir = `${formState.name}`;
    const paths = [...store.paths];
    importPhotos([dir], paths[0], (args) => {
        handler[args.type]?.call(null, args);
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
</script>

<template>
    <a-form :model="formState" :label-col="labelCol" :wrapper-col="wrapperCol">
        <a-form-item label="Choose a folder to import">
            <a-input v-model:value="formState.name" />
            <a-button type="primary" @click="onChoose">Choose Directory</a-button>
        </a-form-item>
        <a-form-item label="Instant delivery">
            <a-switch v-model:checked="formState.delivery" />
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
        <a-form-item label="Target Directory">
            <a-input v-model:value="formState.targetDir" type="textarea" />
        </a-form-item>
        <a-form-item :wrapper-col="{ span: 14, offset: 4 }">
            <a-button type="primary" @click="onImport">Import</a-button>
            <a-button style="margin-left: 10px">Cancel</a-button>
        </a-form-item>
    </a-form>
    <a-modal v-model:visible="visible" :mask-closable="false" :closable="false" title="Importing">
        <template #footer> </template>
        <a-list size="small" bordered :data-source="processed" class="import-message-list">
            <template #renderItem="{ item }">
                <a-list-item>{{ item }}</a-list-item>
            </template>
            <template #header>
                <div>Header</div>
            </template>
            <template #footer>
                <div>Footer</div>
            </template>
        </a-list>
    </a-modal>
</template>
<style scoped lang="less">
.import-message-list {
    height: 300px;
    overflow: auto;
}
</style>
