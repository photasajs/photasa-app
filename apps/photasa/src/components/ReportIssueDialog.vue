<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
    BaseButton,
    BaseFormField,
    BaseInput,
    BaseModal,
    BaseSelect,
} from "@renderer/components/ui";
import { submitReportIssue } from "@renderer/api/report-issue";
import { notification } from "@renderer/services/notification-manager";
import { useZhangSunWuJi } from "@renderer/composables/useZhangSunWuJi";

defineOptions({
    name: "ReportIssueDialog",
});

const props = defineProps<{
    show: boolean;
}>();

const emit = defineEmits<{
    (e: "close"): void;
}>();

const { t } = useI18n();
const zhangSunWuJi = useZhangSunWuJi();

const category = ref<"bug" | "feature" | "support" | "general">("bug");
const title = ref("");
const body = ref("");
const email = ref("");
const submitting = ref(false);

const categoryOptions = computed(() => [
    { value: "bug", label: t("reportIssue.category.bug") },
    { value: "feature", label: t("reportIssue.category.feature") },
    { value: "support", label: t("reportIssue.category.support") },
    { value: "general", label: t("reportIssue.category.general") },
]);

function resetForm(): void {
    category.value = "bug";
    title.value = "";
    body.value = "";
    email.value = "";
}

watch(
    () => props.show,
    (open) => {
        if (open) {
            resetForm();
        }
    },
);

function handleClose(): void {
    if (submitting.value) {
        return;
    }
    emit("close");
}

async function handleSubmit(): Promise<void> {
    if (submitting.value || !title.value.trim() || !body.value.trim()) {
        return;
    }

    submitting.value = true;
    try {
        const result = await submitReportIssue({
            title: title.value.trim(),
            body: body.value.trim(),
            category: category.value,
            email: email.value.trim() || undefined,
        });

        notification.success({
            title: t("reportIssue.successTitle"),
            message: t("reportIssue.successMessage", { number: result.number }),
            actions: [
                {
                    label: t("reportIssue.openIssue"),
                    onClick: () => {
                        zhangSunWuJi.openExternal(result.htmlUrl);
                    },
                },
            ],
        });
        emit("close");
    } catch {
        notification.error({
            title: t("reportIssue.errorTitle"),
            message: t("reportIssue.errorMessage"),
        });
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <BaseModal :open="show" :title="t('reportIssue.title')" size="md" @close="handleClose">
        <div class="space-y-4">
            <BaseFormField :label="t('reportIssue.categoryLabel')" required>
                <BaseSelect v-model="category" :options="categoryOptions" />
            </BaseFormField>

            <BaseFormField :label="t('reportIssue.titleLabel')" required>
                <BaseInput
                    v-model="title"
                    :placeholder="t('reportIssue.titlePlaceholder')"
                    :disabled="submitting"
                />
            </BaseFormField>

            <BaseFormField :label="t('reportIssue.bodyLabel')" required>
                <textarea
                    v-model="body"
                    class="block w-full min-h-[140px] rounded-md border px-3 py-2 text-sm shadow-sm bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                    :placeholder="t('reportIssue.bodyPlaceholder')"
                    :disabled="submitting"
                />
            </BaseFormField>

            <BaseFormField :label="t('reportIssue.emailLabel')">
                <BaseInput
                    v-model="email"
                    type="email"
                    :placeholder="t('reportIssue.emailPlaceholder')"
                    :disabled="submitting"
                />
            </BaseFormField>
        </div>

        <template #footer>
            <div class="flex w-full justify-end gap-3">
                <BaseButton variant="secondary" :disabled="submitting" @click="handleClose">
                    {{ t("reportIssue.cancel") }}
                </BaseButton>
                <BaseButton
                    variant="primary"
                    :disabled="submitting || !title.trim() || !body.trim()"
                    @click="handleSubmit"
                >
                    {{ t("reportIssue.submit") }}
                </BaseButton>
            </div>
        </template>
    </BaseModal>
</template>
