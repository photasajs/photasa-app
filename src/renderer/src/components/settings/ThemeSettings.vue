<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { usePreferenceStore } from "@renderer/stores/preference";

defineOptions({
    name: "ThemeSettings",
});

const { t } = useI18n();
const preferenceStore = usePreferenceStore();
const { darkMode } = storeToRefs(preferenceStore);
</script>

<template>
    <a-form layout="horizontal">
        <a-form-item :label="t('preference.darkMode')">
            <a-switch v-model:checked="darkMode" />
        </a-form-item>
    </a-form>
</template>
