<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { PhFolderOpen, PhX } from "@phosphor-icons/vue";
import { DuplicateStrategies, type DuplicateStrategy } from "@photasa/common";
import { chooseDirectory } from "@renderer/utils/api";
import { usePreferenceStore } from "@renderer/stores/preference";
import { notification } from "@renderer/services/notification-manager";
import { BaseButton, BaseInput, BaseSelect, BaseSwitch } from "@renderer/components/ui";

defineOptions({
    name: "ImportSettings",
});

const { t } = useI18n();
const preferenceStore = usePreferenceStore();

const defaultTargetPath = computed({
    get: () => preferenceStore.importing.defaultTargetPath,
    set: (value: string | number) => {
        preferenceStore.setImportDefaultTargetPath(String(value));
    },
});

const duplicateStrategy = computed({
    get: () => preferenceStore.importing.duplicateStrategy,
    set: (value: string | number | null) => {
        if (value === null) return;
        preferenceStore.setImportDuplicateStrategy(String(value) as DuplicateStrategy);
    },
});

const includeSubfolders = computed({
    get: () => preferenceStore.importing.includeSubfolders,
    set: (value: boolean) => {
        preferenceStore.setImportIncludeSubfolders(value);
    },
});

const duplicateStrategyOptions = computed(() => [
    { value: DuplicateStrategies.RENAME, label: t("import.duplicate.rename") },
    { value: DuplicateStrategies.SKIP, label: t("import.duplicate.skip") },
    { value: DuplicateStrategies.OVERWRITE, label: t("import.duplicate.overwrite") },
    { value: DuplicateStrategies.KEEP_BOTH, label: t("import.duplicate.keepBoth") },
]);

async function chooseDefaultTarget(): Promise<void> {
    const { filePaths } = await chooseDirectory();
    if (!filePaths?.[0]) {
        notification.info({
            title: t("notification.emptyPath.title"),
            message: t("notification.emptyPath.message"),
        });
        return;
    }
    preferenceStore.setImportDefaultTargetPath(filePaths[0]);
}

function clearDefaultTarget(): void {
    preferenceStore.setImportDefaultTargetPath("");
}
</script>

<template>
    <div class="settings-content settings-container">
        <div class="setting-section">
            <label class="setting-label">{{ t("preference.import.defaultTargetPath") }}</label>
            <div class="target-row">
                <BaseInput
                    v-model="defaultTargetPath"
                    readonly
                    :placeholder="t('preference.import.defaultTargetPlaceholder')"
                />
                <BaseButton type="default" @click="chooseDefaultTarget">
                    <template #icon>
                        <PhFolderOpen class="w-4 h-4 text-current" />
                    </template>
                    {{ t("import.browse") }}
                </BaseButton>
                <button
                    type="button"
                    class="icon-button"
                    :aria-label="t('preference.import.clearDefaultTarget')"
                    :title="t('preference.import.clearDefaultTarget')"
                    :disabled="!defaultTargetPath"
                    @click="clearDefaultTarget"
                >
                    <PhX class="w-4 h-4 text-current" />
                </button>
            </div>
        </div>

        <div class="setting-section">
            <label class="setting-label">{{ t("preference.import.duplicateStrategy") }}</label>
            <BaseSelect v-model="duplicateStrategy" :options="duplicateStrategyOptions" />
        </div>

        <div class="setting-section inline-section">
            <div>
                <label class="setting-label">{{ t("preference.import.includeSubfolders") }}</label>
                <p class="setting-hint">{{ t("preference.import.includeSubfoldersHint") }}</p>
            </div>
            <BaseSwitch
                v-model="includeSubfolders"
                :label="t('preference.import.includeSubfolders')"
            />
        </div>
    </div>
</template>

<style scoped lang="less">
.settings-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.setting-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.inline-section {
    align-items: flex-start;
    flex-direction: row;
    justify-content: space-between;
}

.setting-label {
    color: var(--color-text, rgba(0, 0, 0, 0.85));
    font-size: 14px;
    font-weight: 500;
}

.setting-hint {
    color: var(--color-text-secondary, rgba(0, 0, 0, 0.65));
    font-size: 13px;
    line-height: 1.45;
    margin: 2px 0 0;
}

.target-row {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: minmax(0, 1fr) auto 40px;
}

.icon-button {
    align-items: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--color-text-secondary, rgba(0, 0, 0, 0.65));
    display: inline-flex;
    height: 40px;
    justify-content: center;
    transition:
        background-color 0.15s ease,
        border-color 0.15s ease,
        color 0.15s ease;
    width: 40px;
}

.icon-button:hover:not(:disabled) {
    background: var(--color-card-hover, rgba(0, 0, 0, 0.04));
    border-color: var(--color-border, #d9d9d9);
    color: var(--color-text, rgba(0, 0, 0, 0.85));
}

.icon-button:focus-visible {
    outline: 2px solid var(--color-primary, #1677ff);
    outline-offset: 2px;
}

.icon-button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}
</style>
