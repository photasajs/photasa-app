<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { BaseInlineFormField, BaseSwitch } from "@renderer/components/ui";
import { usePreferenceStore } from "@renderer/stores/preference";
import { TELEMETRY_CONSENT_STATUS } from "@renderer/constants/telemetry";
import { useFangXuanLing } from "@renderer/composables/useFangXuanLing";
import { persistTelemetryConsent } from "@renderer/services/telemetry/telemetry-service";
import { notification } from "@renderer/services/notification-manager";

defineOptions({
    name: "TelemetrySettings",
});

const { t } = useI18n();
const preferenceStore = usePreferenceStore();
const fangXuanLing = useFangXuanLing();
const { telemetry } = storeToRefs(preferenceStore);

const enabled = computed({
    get: () => telemetry.value.consentStatus === TELEMETRY_CONSENT_STATUS.GRANTED,
    set: async (value: boolean) => {
        const nextStatus = value
            ? TELEMETRY_CONSENT_STATUS.GRANTED
            : TELEMETRY_CONSENT_STATUS.DENIED;
        try {
            await persistTelemetryConsent(fangXuanLing, nextStatus, {
                fromDialog: false,
                existingPolicyVersion: telemetry.value.consentPolicyVersion,
            });
            notification.success({
                title: t("telemetry.settings.savedTitle"),
                message: t("telemetry.settings.savedMessage"),
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t("notification.unknownError");
            notification.error({
                title: t("telemetry.settings.errorTitle"),
                message,
            });
        }
    },
});

const label = computed(() => ({
    title: t("telemetry.settings.title"),
    description: t("telemetry.settings.description"),
    enabled: t("telemetry.settings.enabled"),
    enabledDesc: t("telemetry.settings.enabledDescription"),
}));
</script>

<template>
    <div class="settings-panel">
        <div class="header-section">
            <div class="header-title">{{ label.title }}</div>
            <div class="header-desc">{{ label.description }}</div>
        </div>

        <BaseInlineFormField :label="label.enabled" :description="label.enabledDesc">
            <BaseSwitch v-model="enabled" />
        </BaseInlineFormField>
    </div>
</template>

<style scoped>
.settings-panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.header-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
}

.header-desc {
    margin-top: 0.25rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
}
</style>
