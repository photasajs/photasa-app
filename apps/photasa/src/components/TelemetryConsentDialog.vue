<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { BaseButton, BaseModal } from "@renderer/components/ui";
import { TELEMETRY_CONSENT_STATUS } from "@renderer/constants/telemetry";
import { useFangXuanLing } from "@renderer/composables/useFangXuanLing";
import { persistTelemetryConsent } from "@renderer/services/telemetry/telemetry-service";

defineOptions({
    name: "TelemetryConsentDialog",
});

const emit = defineEmits<{
    (e: "completed"): void;
}>();

const { t } = useI18n();
const fangXuanLing = useFangXuanLing();
const visible = ref(true);
const saving = ref(false);

async function choose(
    consentStatus: typeof TELEMETRY_CONSENT_STATUS.GRANTED | typeof TELEMETRY_CONSENT_STATUS.DENIED,
) {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        await persistTelemetryConsent(fangXuanLing, consentStatus, { fromDialog: true });
        visible.value = false;
        emit("completed");
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <BaseModal
        :open="visible"
        :title="t('telemetry.consent.title')"
        size="md"
        :closable="false"
        :persistent="true"
        :show-default-footer="false"
    >
        <p class="text-[var(--color-text-secondary)] leading-relaxed mb-4">
            {{ t("telemetry.consent.purpose") }}
        </p>
        <p class="text-[var(--color-text-secondary)] leading-relaxed mb-4">
            {{ t("telemetry.consent.scope") }}
        </p>
        <p class="text-[var(--color-text-secondary)] leading-relaxed">
            {{ t("telemetry.consent.destination") }}
        </p>

        <template #footer>
            <div class="flex w-full gap-3">
                <BaseButton
                    class="flex-1"
                    variant="secondary"
                    :disabled="saving"
                    @click="choose(TELEMETRY_CONSENT_STATUS.DENIED)"
                >
                    {{ t("telemetry.consent.deny") }}
                </BaseButton>
                <BaseButton
                    class="flex-1"
                    variant="primary"
                    :disabled="saving"
                    @click="choose(TELEMETRY_CONSENT_STATUS.GRANTED)"
                >
                    {{ t("telemetry.consent.grant") }}
                </BaseButton>
            </div>
        </template>
    </BaseModal>
</template>
