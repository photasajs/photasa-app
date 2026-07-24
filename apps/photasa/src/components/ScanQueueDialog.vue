<!-- Scan Queue Dialog — 单列表虚拟卡片（RFC 0162 + 功能对等） -->
<template>
    <BaseModal
        :open="show"
        :title="t('scan.queueTitle')"
        size="custom"
        :style="{ '--modal-width': '680px' }"
        @close="$emit('close')"
    >
        <div class="scan-queue-container">
            <div v-if="scanningFolder.length === 0" class="empty-status">
                <div class="empty-icon" aria-hidden="true">
                    <PhCheckCircle :size="40" weight="duotone" />
                </div>
                <h4>{{ t("scan.queueEmpty") }}</h4>
                <p>{{ t("scan.allTasksCompleted") }}</p>
            </div>
            <div v-else class="queue-content">
                <div class="queue-stats">
                    <span class="queue-stat queue-stat-live">
                        <span class="queue-stat-dot" aria-hidden="true" />
                        {{ t("scan.processing") }}
                    </span>
                    <span class="queue-stat">
                        {{ t("scan.pendingTasks", { count: scanningFolder.length }) }}
                    </span>
                </div>

                <div class="queue-feed-shell">
                    <div ref="queueListRef" class="queue-feed scrollbar-theme-thin">
                        <div class="queue-feed-inner" :style="{ height: `${virtualTotalSize}px` }">
                            <article
                                v-for="virtualRow in virtualRows"
                                :key="virtualRow.key"
                                class="queue-card"
                                :class="
                                    getCardClass(scanningFolder[virtualRow.index], virtualRow.index)
                                "
                                :style="{
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }"
                            >
                                <div class="queue-card-icon">
                                    <component
                                        :is="
                                            getItemIcon(
                                                scanningFolder[virtualRow.index]?.operationType,
                                            )
                                        "
                                        :size="18"
                                        :weight="virtualRow.index === 0 ? 'duotone' : 'regular'"
                                    />
                                </div>
                                <div class="queue-card-body">
                                    <div class="queue-card-head">
                                        <p
                                            class="queue-card-path"
                                            :title="scanningFolder[virtualRow.index]?.path"
                                        >
                                            {{ scanningFolder[virtualRow.index]?.path }}
                                        </p>
                                        <div class="queue-card-badges">
                                            <span
                                                v-if="scanningFolder[virtualRow.index]?.status"
                                                class="queue-chip"
                                                :class="
                                                    getStatusClass(
                                                        scanningFolder[virtualRow.index]?.status,
                                                    )
                                                "
                                            >
                                                {{
                                                    getStatusText(
                                                        scanningFolder[virtualRow.index]?.status,
                                                    )
                                                }}
                                            </span>
                                            <span
                                                class="queue-chip"
                                                :class="
                                                    getActionClass(
                                                        scanningFolder[virtualRow.index]?.action ??
                                                            '',
                                                    )
                                                "
                                            >
                                                {{
                                                    getActionText(
                                                        scanningFolder[virtualRow.index]?.action ??
                                                            "",
                                                    )
                                                }}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="queue-card-meta-row">
                                        <span class="queue-card-meta-item">
                                            {{
                                                formatPathName(
                                                    scanningFolder[virtualRow.index]?.path ?? "",
                                                )
                                            }}
                                        </span>
                                        <span class="queue-card-meta-sep">·</span>
                                        <span
                                            class="queue-card-meta-item"
                                            :title="
                                                formatFullTimestamp(
                                                    scanningFolder[virtualRow.index]?.createdAt,
                                                )
                                            "
                                        >
                                            {{
                                                formatRelativeTime(
                                                    scanningFolder[virtualRow.index]?.createdAt,
                                                )
                                            }}
                                        </span>
                                        <template
                                            v-if="
                                                scanningFolder[virtualRow.index]?.priority !==
                                                undefined
                                            "
                                        >
                                            <span class="queue-card-meta-sep">·</span>
                                            <span class="queue-card-meta-item">
                                                {{ t("scan.priority") }}:
                                                {{ scanningFolder[virtualRow.index]?.priority }}
                                            </span>
                                        </template>
                                    </div>
                                    <div
                                        v-if="
                                            shouldReserveActiveDetailSlot(virtualRow.index) ||
                                            shouldShowFailedState(scanningFolder[virtualRow.index])
                                        "
                                        class="queue-card-detail-slot"
                                    >
                                        <p
                                            v-if="
                                                shouldShowProgress(
                                                    scanningFolder[virtualRow.index],
                                                    virtualRow.index,
                                                )
                                            "
                                            class="queue-card-progress"
                                        >
                                            {{ t("scan.processed") }}:
                                            {{
                                                scanningFolder[virtualRow.index]?.progress
                                                    ?.processed ?? 0
                                            }}
                                            <template
                                                v-if="
                                                    (scanningFolder[virtualRow.index]?.progress
                                                        ?.total ?? 0) > 0
                                                "
                                            >
                                                /
                                                {{
                                                    scanningFolder[virtualRow.index]?.progress
                                                        ?.total
                                                }}
                                            </template>
                                            <span
                                                class="queue-cache-indicator"
                                                :title="t('scan.incrementalCache')"
                                            >
                                                🔄
                                            </span>
                                        </p>
                                        <p
                                            v-else-if="
                                                shouldShowFailedState(
                                                    scanningFolder[virtualRow.index],
                                                )
                                            "
                                            class="queue-card-error"
                                            :title="scanningFolder[virtualRow.index]?.error"
                                        >
                                            {{ scanningFolder[virtualRow.index]?.error }}
                                            <span class="queue-card-retry">
                                                {{
                                                    t("scan.retryState", {
                                                        retryCount:
                                                            scanningFolder[virtualRow.index]
                                                                ?.retryCount ?? 0,
                                                        maxRetries:
                                                            scanningFolder[virtualRow.index]
                                                                ?.maxRetries ?? 0,
                                                    })
                                                }}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <template #footer>
            <BaseButton variant="primary" @click="$emit('close')">
                {{ t("button.ok") }}
            </BaseButton>
        </template>
    </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { PhCheckCircle, PhFile, PhFolder } from "@phosphor-icons/vue";
import { BaseModal, BaseButton } from "@renderer/components/ui";
import type { ScanQueueItem } from "@renderer/stores/scanning-types";
import {
    QUEUE_CARD_GAP,
    estimateQueueCardHeight,
    formatPathName as formatPathNameFromPath,
    getQueueCardTier,
    shouldShowFailedState,
    shouldShowProgress,
    shouldReserveActiveDetailSlot,
} from "./scan-queue-display";
import { useI18n } from "vue-i18n";

interface Props {
    show: boolean;
    scanningFolder: ScanQueueItem[];
}

const props = defineProps<Props>();
const { scanningFolder } = toRefs(props);

defineEmits<{
    close: [];
}>();

const { t } = useI18n();

const queueListRef = ref<HTMLElement | null>(null);

const virtualizer = useVirtualizer({
    count: 0,
    getScrollElement: () => queueListRef.value,
    estimateSize: (index) => estimateQueueCardHeight(scanningFolder.value[index], index),
    gap: QUEUE_CARD_GAP,
    overscan: 10,
});

const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const virtualTotalSize = computed(() => virtualizer.value.getTotalSize());

watch(
    scanningFolder,
    (queue) => {
        virtualizer.value.options.count = queue.length;
        virtualizer.value.measure();
    },
    { deep: true, immediate: true },
);

function formatPathName(path: string): string {
    return formatPathNameFromPath(path, t("scan.unknownFolder"));
}

function getItemIcon(operationType?: ScanQueueItem["operationType"]) {
    return operationType === "file" ? PhFile : PhFolder;
}

function getCardClass(item: ScanQueueItem | undefined, index: number): string[] {
    const tier = getQueueCardTier(index);
    const classes = [`queue-card-${tier}`];

    if (item && shouldShowFailedState(item)) {
        classes.push("queue-card-failed");
    }

    return classes;
}

function getActionText(action: string): string {
    const actionMap: Record<string, string> = {
        scan: t("scan.actions.scan"),
        rescan: t("scan.actions.rescan"),
        current: t("scan.actions.current"),
    };
    return actionMap[action] || action;
}

function getActionClass(action: string): string {
    const classMap: Record<string, string> = {
        scan: "chip-scan",
        rescan: "chip-rescan",
        current: "chip-current",
    };
    return classMap[action] || "chip-default";
}

function getStatusText(status?: ScanQueueItem["status"]): string {
    if (!status) {
        return "";
    }

    const statusMap: Record<ScanQueueItem["status"], string> = {
        pending: t("scan.statusLabels.pending"),
        processing: t("scan.statusLabels.processing"),
        failed: t("scan.statusLabels.failed"),
    };

    return statusMap[status] ?? status;
}

function getStatusClass(status?: ScanQueueItem["status"]): string {
    if (status === "failed") {
        return "chip-failed";
    }
    if (status === "processing") {
        return "chip-processing";
    }
    return "chip-pending";
}

function formatRelativeTime(timestamp?: number): string {
    if (!timestamp) {
        return t("scan.noTimestamp");
    }

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
        return t("scan.timeJustNow");
    }
    if (minutes < 60) {
        return t("scan.timeMinutesAgo", { count: minutes });
    }
    if (hours < 24) {
        return t("scan.timeHoursAgo", { count: hours });
    }
    return t("scan.timeDaysAgo", { count: days });
}

function formatFullTimestamp(timestamp?: number): string {
    if (!timestamp) {
        return t("scan.noTimestamp");
    }

    return new Date(timestamp).toLocaleString();
}
</script>

<style scoped lang="less">
.scan-queue-container {
    display: flex;
    flex-direction: column;
    height: min(520px, calc(90vh - 200px));
    overflow: hidden;
}

.empty-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 20px;
    text-align: center;

    .empty-icon {
        margin-bottom: 12px;
        color: var(--color-success, #52c41a);
        opacity: 0.85;
    }

    h4 {
        margin: 0 0 6px;
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text);
    }

    p {
        margin: 0;
        font-size: 13px;
        color: var(--color-text-secondary);
    }
}

.queue-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.queue-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    flex-shrink: 0;
}

.queue-stat {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: var(--color-fill-secondary, rgba(255, 255, 255, 0.06));
}

.queue-stat-live {
    color: var(--color-primary);
    background: var(--color-primary-bg, rgba(24, 144, 255, 0.12));
}

.queue-stat-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
}

.queue-feed-shell {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg-container, var(--color-bg));
    overflow: hidden;
}

.queue-feed {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-gutter: stable;
    padding: 8px;
    box-sizing: border-box;
}

.queue-feed-inner {
    position: relative;
    width: 100%;
}

.queue-card {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--color-fill-secondary, rgba(255, 255, 255, 0.04));
    box-sizing: border-box;
}

.queue-card-active {
    background: linear-gradient(
        135deg,
        var(--color-primary-bg, rgba(24, 144, 255, 0.14)) 0%,
        var(--color-fill-secondary, rgba(255, 255, 255, 0.04)) 100%
    );
    box-shadow: inset 0 0 0 1px var(--color-primary, rgba(24, 144, 255, 0.35));
}

.queue-card-next {
    box-shadow: inset 0 0 0 1px var(--color-border);
}

.queue-card-failed {
    box-shadow: inset 0 0 0 1px var(--color-error, rgba(255, 77, 79, 0.45));
}

.queue-card-icon {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    margin-top: 2px;
    border-radius: 8px;
    color: var(--color-text-secondary);
    background: var(--color-bg-elevated, rgba(0, 0, 0, 0.2));
}

.queue-card-active .queue-card-icon {
    color: var(--color-primary);
    background: var(--color-primary-bg, rgba(24, 144, 255, 0.16));
}

.queue-card-body {
    flex: 1;
    min-width: 0;
}

.queue-card-head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 4px;
}

.queue-card-path {
    margin: 0;
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.35;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.queue-card-active .queue-card-path {
    color: var(--color-primary);
    font-weight: 600;
}

.queue-card-badges {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
}

.queue-card-meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
    font-size: 11px;
    line-height: 1.35;
    color: var(--color-text-secondary);
}

.queue-card-meta-sep {
    opacity: 0.6;
}

.queue-card-detail-slot {
    min-height: 18px;
    margin-top: 4px;
}

.queue-card-progress {
    margin: 0;
    font-size: 11px;
    line-height: 1.35;
    color: var(--color-primary);
}

.queue-cache-indicator {
    margin-left: 4px;
    cursor: help;
}

.queue-card-error {
    margin: 0;
    font-size: 11px;
    line-height: 1.35;
    color: var(--color-error, #ff4d4f);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.queue-card-retry {
    margin-left: 6px;
    color: var(--color-text-secondary);
}

.queue-chip {
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    background: var(--color-fill-tertiary, rgba(255, 255, 255, 0.08));
    color: var(--color-text-secondary);
}

.chip-scan,
.chip-current {
    color: var(--color-success, #52c41a);
    background: rgba(82, 196, 26, 0.12);
}

.chip-rescan {
    color: var(--color-warning, #fa8c16);
    background: rgba(250, 140, 22, 0.12);
}

.chip-pending {
    color: var(--color-text-secondary);
}

.chip-processing {
    color: var(--color-primary);
    background: var(--color-primary-bg, rgba(24, 144, 255, 0.12));
}

.chip-failed {
    color: var(--color-error, #ff4d4f);
    background: rgba(255, 77, 79, 0.12);
}
</style>
