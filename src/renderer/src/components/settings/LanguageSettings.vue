<script setup lang="ts">
import { useI18n } from "vue-i18n";
import LanguageSwitcher from "../LanguageSwitcher.vue";

defineOptions({
    name: "LanguageSettings",
});

const { t } = useI18n();
</script>

<template>
    <a-form layout="vertical">
        <a-form-item :label="t('preference.language')">
            <div class="language-settings">
                <LanguageSwitcher />
            </div>
        </a-form-item>
    </a-form>
</template>

<style scoped lang="less">
.language-settings {
    margin-top: 8px;
}
</style>
