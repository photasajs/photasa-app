<template>
    <header class="app-header">
        <a-space class="title-header">
            <a-typography-text type="primary">{{ t("app.title") }}</a-typography-text>
        </a-space>
        <a-space class="setting-header">
            <CoffeeOutlined class="system-icon" @click="openScanList"></CoffeeOutlined>
            <ImportOutlined class="system-icon" @click="openImportPhotos"></ImportOutlined>
            <SettingOutlined class="system-icon" @click="openPreference" />
        </a-space>
    </header>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import CoffeeOutlined from "@ant-design/icons-vue/CoffeeOutlined";
import ImportOutlined from "@ant-design/icons-vue/ImportOutlined";
import SettingOutlined from "@ant-design/icons-vue/SettingOutlined";

const { t } = useI18n();

const emit = defineEmits(["openScanList", "openImportPhotos", "openPreference"]);
function openScanList() {
    emit("openScanList");
}
function openImportPhotos() {
    emit("openImportPhotos");
}
function openPreference() {
    emit("openPreference");
}
</script>

<style lang="less" scoped>
.app-header {
    height: var(--photasa-header-height, 36px);
    margin-left: 36px;
    padding-left: 50px;
    line-height: 36px;
    display: flex;
}
.title-header {
    flex-grow: 1;
    user-select: none;
    -webkit-app-region: drag;
}
.setting-header {
    float: right;
    margin-right: 16px;
    -webkit-app-region: no-drag;
}
.system-icon {
    height: 1.5rem;
    width: 1.5rem;
}
</style>
