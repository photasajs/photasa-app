<script setup lang="ts">
import { ref, computed, reactive } from "vue";
import { usePhotosStore } from "@renderer/stores/photos";
import { usePreferenceStore } from "@renderer/stores/preference";
import { storeToRefs } from "pinia";
import { getImageType } from "@renderer/utils/api";
import { trim } from "radash";
import type { ImageTypeResult } from "image-type";
import { JsonTreeView } from "json-tree-view-vue3";
import type { Tags, XmpTags, IccTags } from "exifreader";
import { useI18n } from "vue-i18n";
import { openInFinder } from "@renderer/utils/api";

const { t } = useI18n();

type Card = {
    title: string;
    parts: string[];
    images: Image[];
};

type Image = {
    key: string;
    src: string;
    fallback: string;
};

type ImageMeta = {
    imageType: ImageTypeResult;
    tags: Tags | XmpTags | IccTags;
    path: string;
    maxDepth: number;
    json: string;
};

const store = usePhotosStore();

const { currentFolder } = storeToRefs(store);
const { getFolderFiles } = store;
const { thumbnailSize } = storeToRefs(usePreferenceStore());
const showInfo = ref(false);
const loadingInfo = ref(false);
const fallback = ref(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3PTWBSGcbGzM6GCKqlIBRV0dHRJFarQ0eUT8LH4BnRU0NHR0UEFVdIlFRV7TzRksomPY8uykTk/zewQfKw/9znv4yvJynLv4uLiV2dBoDiBf4qP3/ARuCRABEFAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghgg0Aj8i0JO4OzsrPv69Wv+hi2qPHr0qNvf39+iI97soRIh4f3z58/u7du3SXX7Xt7Z2enevHmzfQe+oSN2apSAPj09TSrb+XKI/f379+08+A0cNRE2ANkupk+ACNPvkSPcAAEibACyXUyfABGm3yNHuAECRNgAZLuYPgEirKlHu7u7XdyytGwHAd8jjNyng4OD7vnz51dbPT8/7z58+NB9+/bt6jU/TI+AGWHEnrx48eJ/EsSmHzx40L18+fLyzxF3ZVMjEyDCiEDjMYZZS5wiPXnyZFbJaxMhQIQRGzHvWR7XCyOCXsOmiDAi1HmPMMQjDpbpEiDCiL358eNHurW/5SnWdIBbXiDCiA38/Pnzrce2YyZ4//59F3ePLNMl4PbpiL2J0L979+7yDtHDhw8vtzzvdGnEXdvUigSIsCLAWavHp/+qM0BcXMd/q25n1vF57TYBp0a3mUzilePj4+7k5KSLb6gt6ydAhPUzXnoPR0dHl79WGTNCfBnn1uvSCJdegQhLI1vvCk+fPu2ePXt2tZOYEV6/fn31dz+shwAR1sP1cqvLntbEN9MxA9xcYjsxS1jWR4AIa2Ibzx0tc44fYX/16lV6NDFLXH+YL32jwiACRBiEbf5KcXoTIsQSpzXx4N28Ja4BQoK7rgXiydbHjx/P25TaQAJEGAguWy0+2Q8PD6/Ki4R8EVl+bzBOnZY95fq9rj9zAkTI2SxdidBHqG9+skdw43borCXO/ZcJdraPWdv22uIEiLA4q7nvvCug8WTqzQveOH26fodo7g6uFe/a17W3+nFBAkRYENRdb1vkkz1CH9cPsVy/jrhr27PqMYvENYNlHAIesRiBYwRy0V+8iXP8+/fvX11Mr7L7ECueb/r48eMqm7FuI2BGWDEG8cm+7G3NEOfmdcTQw4h9/55lhm7DekRYKQPZF2ArbXTAyu4kDYB2YxUzwg0gi/41ztHnfQG26HbGel/crVrm7tNY+/1btkOEAZ2M05r4FB7r9GbAIdxaZYrHdOsgJ/wCEQY0J74TmOKnbxxT9n3FgGGWWsVdowHtjt9Nnvf7yQM2aZU/TIAIAxrw6dOnAWtZZcoEnBpNuTuObWMEiLAx1HY0ZQJEmHJ3HNvGCBBhY6jtaMoEiJB0Z29vL6ls58vxPcO8/zfrdo5qvKO+d3Fx8Wu8zf1dW4p/cPzLly/dtv9Ts/EbcvGAHhHyfBIhZ6NSiIBTo0LNNtScABFyNiqFCBChULMNNSdAhJyNSiECRCjUbEPNCRAhZ6NSiAARCjXbUHMCRMjZqBQiQIRCzTbUnAARcjYqhQgQoVCzDTUnQIScjUohAkQo1GxDzQkQIWejUogAEQo121BzAkTI2agUIkCEQs021JwAEXI2KoUIEKFQsw01J0CEnI1KIQJEKNRsQ80JECFno1KIABEKNdtQcwJEyNmoFCJAhELNNtScABFyNiqFCBChULMNNSdAhJyNSiECRCjUbEPNCRAhZ6NSiAARCjXbUHMCRMjZqBQiQIRCzTbUnAARcjYqhQgQoVCzDTUnQIScjUohAkQo1GxDzQkQIWejUogAEQo121BzAkTI2agUIkCEQs021JwAEXI2KoUIEKFQsw01J0CEnI1KIQJEKNRsQ80JECFno1KIABEKNdtQcwJEyNmoFCJAhELNNtScABFyNiqFCBChULMNNSdAhJyNSiECRCjUbEPNCRAhZ6NSiAARCjXbUHMCRMjZqBQiQIRCzTbUnAARcjYqhQgQoVCzDTUnQIScjUohAkQo1GxDzQkQIWejUogAEQo121BzAkTI2agUIkCEQs021JwAEXI2KoUIEKFQsw01J0CEnI1KIQJEKNRsQ80JECFno1KIABEKNdtQcwJEyNmoFCJAhELNNtScABFyNiqFCBChULMNNSdAhJyNSiEC/wGgKKC4YMA4TAAAAABJRU5ErkJggg==",
);

const mouseEnterDelay = ref(0.5);

const cards = computed(() => {
    const cards: Card[] = [];
    const images: Image[] = [];
    getFolderFiles(currentFolder.value)?.forEach((file) => {
        if (file.path.indexOf(currentFolder.value) >= 0) {
            images.push({
                key: file.path,
                src: `file://${file.thumbnail}`,
                fallback: `file://${file.path}`,
            });
        }
    });

    cards.push({
        title: currentFolder.value,
        images,
        parts: currentFolder.value?.split("/"),
    });

    return cards;
});

const imageMeta = reactive<ImageMeta>({
    imageType: {} as ImageTypeResult,
    tags: {},
    path: "",
    maxDepth: 3,
    json: "",
});

const label = computed(() => {
    return {
        getInfo: t("menu.getInfo"),
        open: t("menu.open"),
    };
});

function openImageMeta(image: Image): void {
    showInfo.value = true;
    loadingInfo.value = true;
    const path = `/${trim(image.fallback, "file://")}`;
    getImageType(path).then((info) => {
        loadingInfo.value = false;
        imageMeta.imageType = info.imageType ?? {};
        imageMeta.json = JSON.stringify(info.tags ?? {});
        imageMeta.tags = info.tags ?? {};
        imageMeta.path = path;
    });
}

function openFileInFilder(image: Image): void {
    const path = `/${trim(image.fallback, "file://")}`;
    openInFinder(path);
}
</script>

<template>
    <a-card v-for="card in cards" :key="card.title">
        <template #title>
            <a-breadcrumb style="margin: 16px 0">
                <a-breadcrumb-item v-for="part in card.parts" :key="part">{{
                    part
                }}</a-breadcrumb-item>
            </a-breadcrumb>
        </template>

        <div class="image-list">
            <ul v-if="card.images.length > 0">
                <li
                    v-for="image in card.images"
                    :key="image.key"
                    :width="150"
                    :height="150"
                    class="image-item"
                >
                    <a-dropdown :trigger="['contextmenu']">
                        <a-tooltip
                            placement="rightBottom"
                            :mouse-enter-delay="mouseEnterDelay"
                            :title="image.fallback"
                        >
                            <a-card hoverable>
                                <a-image
                                    :width="thumbnailSize"
                                    :height="thumbnailSize"
                                    :src="image.src"
                                    :fallback="fallback"
                                    :preview="{
                                        src: image.fallback,
                                    }"
                                />
                            </a-card>
                        </a-tooltip>

                        <template #overlay>
                            <a-menu>
                                <a-menu-item key="1" @click="openImageMeta(image)">{{
                                    label.getInfo
                                }}</a-menu-item>
                                <a-menu-item key="2" @click="openFileInFilder(image)">{{
                                    label.open
                                }}</a-menu-item>
                            </a-menu>
                        </template>
                    </a-dropdown>
                </li>
            </ul>
            <a-empty v-else />
        </div>
    </a-card>
    <a-drawer
        v-model:visible="showInfo"
        class="custom-class"
        style="color: red"
        title="Basic Drawer"
        placement="right"
    >
        <a-spin :spinning="loadingInfo">
            <a-descriptions title="Image Info" layout="vertical" bordered :column="2">
                <a-descriptions-item label="Image Width">{{
                    imageMeta.tags?.["Image Width"]?.value
                }}</a-descriptions-item>
                <a-descriptions-item label="Image Height">{{
                    imageMeta.tags?.["Image Height"]?.value
                }}</a-descriptions-item>
                <a-descriptions-item label="MIME Type">{{
                    imageMeta.imageType.mime
                }}</a-descriptions-item>
                <a-descriptions-item label="MIME Type">{{
                    imageMeta.imageType.ext
                }}</a-descriptions-item>
                <a-descriptions-item label="Location" :span="2">{{
                    imageMeta.path
                }}</a-descriptions-item>
                <a-descriptions-item label="Status" :span="2">
                    <a-layout
                        :style="{
                            height: '100%',
                            width: '265px',
                            overflow: 'auto',
                        }"
                    >
                        <JsonTreeView :data="imageMeta.json" :max-depth="imageMeta.maxDepth" />
                    </a-layout>
                </a-descriptions-item>
            </a-descriptions>
        </a-spin>
    </a-drawer>
</template>
<style lang="less">
.image-list {
    height: 100%;
    overflow: auto;

    ul {
        list-style-type: none;

        li {
            .ant-image {
                overflow: hidden;
            }

            margin-top: 0px;
            margin-left: 0px;
            margin-right: 10px;
            margin-bottom: 10px;
            float: left;
            box-shadow: 1px 1px 2px #777;
            border-radius: 1px;
            background-color: white;
            white-space: nowrap;
            word-break: keep-all;
            text-overflow: ellipsis;
            overflow: hidden;
            transition: all 0.5s ease;
        }
    }
}
</style>
