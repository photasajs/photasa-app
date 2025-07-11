<script setup lang="ts">
import { useI18n } from "vue-i18n";
import LanguageSwitcher from "../LanguageSwitcher.vue";

defineOptions({
    name: "LanguageSettings",
});

const { t } = useI18n();
</script>

<template>
    <div class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-[var(--color-text)] mb-2">
                {{ t('preference.language') }}
            </label>
            <div class="language-settings">
                <LanguageSwitcher />
            </div>
        </div>
    </div>
</template>

<style scoped lang="less">
.language-settings {
    margin-top: 8px;
}
</style>
