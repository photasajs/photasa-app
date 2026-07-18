<script setup lang="ts">
/**
 * RFC 0118 — 导入进度 chip：后台可见；点击 reattach
 */
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { PhX as XIcon } from "@phosphor-icons/vue";
import { loggers } from "@photasa/common";
import { useImportSessionStore } from "@renderer/stores/import-session";

const { t } = useI18n();
const logger = loggers.importProgress;
const session = useImportSessionStore();
const { phase, progress, progressPercent, showChip, isTerminal } = storeToRefs(session);

const label = computed(() => {
    if (phase.value === "paused") return t("import.status.paused");
    if (phase.value === "completed") return t("import.importCompleted");
    if (phase.value === "failed") return t("import.importFailed");
    if (phase.value === "cancelled") return t("import.status.cancelled");
    return t("import.importRunning");
});

const counts = computed(() => {
    const p = progress.value;
    if (!p) return "";
    return `${p.processedFiles}/${p.totalFiles}`;
});

const liveText = computed(
    () => `${label.value} ${counts.value} ${progressPercent.value}%`.trim(),
);

function onOpen(): void {
    logger.info("📝 点选导入进度 chip，复开模态", {
        phase: phase.value,
        progress: counts.value,
    });
    session.requestOpenModal();
}

function onDismissChip(event: Event): void {
    event.stopPropagation();
    if (isTerminal.value) {
        logger.info("📝 终态 chip 关闭，清会话", phase.value);
        session.clear();
    } else {
        // 运行中点 X：打开模态，不 cancel
        logger.info("📝 运行中 chip 关闭键 → 复开模态（不取消）", phase.value);
        session.requestOpenModal();
    }
}
</script>

<template>
    <button
        v-if="showChip"
        type="button"
        class="import-progress-chip"
        :class="{
            'is-paused': phase === 'paused',
            'is-done': phase === 'completed',
            'is-error': phase === 'failed' || phase === 'cancelled',
        }"
        :aria-label="liveText"
        @click="onOpen"
    >
        <span class="chip-live" aria-live="polite">{{ liveText }}</span>
        <span class="chip-meta">{{ t("import.showProgress") }}</span>
        <span
            class="chip-dismiss"
            role="button"
            tabindex="0"
            :aria-label="t('import.closeButton')"
            @click="onDismissChip"
            @keydown.enter.prevent="onDismissChip"
        >
            <XIcon class="w-3.5 h-3.5" />
        </span>
    </button>
</template>

<style scoped>
.import-progress-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    max-width: min(28rem, 90vw);
    padding: 0.35rem 0.5rem 0.35rem 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid var(--color-card-border, rgba(0, 0, 0, 0.12));
    background: var(--color-card-bg, var(--color-bg-secondary));
    color: var(--color-text);
    font-size: 0.75rem;
    line-height: 1.25;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.import-progress-chip.is-paused {
    border-color: rgb(234 179 8 / 0.5);
}

.import-progress-chip.is-done {
    border-color: rgb(34 197 94 / 0.5);
}

.import-progress-chip.is-error {
    border-color: rgb(239 68 68 / 0.5);
}

.chip-live {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
}

.chip-meta {
    color: var(--color-text-secondary);
    white-space: nowrap;
}

.chip-dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.15rem;
    border-radius: 0.25rem;
    opacity: 0.7;
}

.chip-dismiss:hover {
    opacity: 1;
    background: rgb(0 0 0 / 0.06);
}
</style>
