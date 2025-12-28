<template>
    <div class="duplicate-handler">
        <!-- 头部信息 -->
        <div class="duplicate-header">
            <h3>
                <ExclamationCircleOutlined />
                {{ t("import.duplicateFiles") }}
            </h3>
            <div class="duplicate-stats">
                <BaseTag color="orange"
                    >{{ duplicates.length }} {{ t("import.duplicatesFound") }}</BaseTag
                >
                <BaseTag v-if="duplicateStats.totalWastedSpace > 0" color="red">
                    {{ formatSize(duplicateStats.totalWastedSpace) }} {{ t("import.wastedSpace") }}
                </BaseTag>
            </div>
        </div>

        <!-- 批量操作 -->
        <div class="batch-actions">
            <BaseRow :gutter="16" align="middle">
                <BaseCol :span="12">
                    <div class="batch-strategy">
                        <label>{{ t("import.batchStrategy") }}:</label>
                        <BaseSelect
                            v-model:modelValue="batchStrategy"
                            style="width: 200px"
                            :options="strategyOptions"
                            @update:modelValue="onBatchStrategyChange"
                        />
                        <BaseButton type="primary" size="sm" @click="applyBatchStrategy">
                            {{ t("import.applyToAll") }}
                        </BaseButton>
                    </div>
                </BaseCol>
                <BaseCol :span="12">
                    <div class="batch-selection">
                        <BaseSpace>
                            <BaseButton size="sm" @click="selectAllDuplicates">
                                {{ t("import.selectAll") }}
                            </BaseButton>
                            <BaseButton size="sm" @click="deselectAllDuplicates">
                                {{ t("import.deselectAll") }}
                            </BaseButton>
                            <BaseButton size="sm" @click="autoResolve">
                                <template #icon><ThunderboltOutlined /></template>
                                {{ t("import.autoResolve") }}
                            </BaseButton>
                        </BaseSpace>
                    </div>
                </BaseCol>
            </BaseRow>
        </div>

        <!-- 重复文件列表 -->
        <div class="duplicate-list">
            <BaseList :data-source="duplicates" :pagination="paginationConfig">
                <template #renderItem="{ item: duplicate }">
                    <BaseListItem class="duplicate-item">
                        <template #actions>
                            <BaseCheckbox
                                :modelValue="selectedDuplicates.has(duplicate.duplicateFile.path)"
                                @update:modelValue="toggleDuplicateSelection(duplicate)"
                            />
                            <BaseButton type="text" size="sm" @click="showComparison(duplicate)">
                                <template #icon><EyeOutlined /></template>
                                {{ t("import.compare") }}
                            </BaseButton>
                        </template>

                        <div class="duplicate-content">
                            <!-- 文件信息对比 -->
                            <div class="file-comparison">
                                <!-- 原文件 -->
                                <div class="file-info original-file">
                                    <div class="file-header">
                                        <h4>{{ t("import.originalFile") }}</h4>
                                        <BaseTag color="blue">{{ t("import.existing") }}</BaseTag>
                                    </div>
                                    <div class="file-details">
                                        <div class="file-name">
                                            {{ duplicate.originalFile.name }}
                                        </div>
                                        <div class="file-meta">
                                            <span class="file-size">{{
                                                formatSize(duplicate.originalFile.size)
                                            }}</span>
                                            <span
                                                v-if="duplicate.originalFile.modifiedTime"
                                                class="file-date"
                                            >
                                                {{
                                                    formatDate(duplicate.originalFile.modifiedTime)
                                                }}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <!-- 对比箭头 -->
                                <div class="comparison-arrow">
                                    <SwapOutlined />
                                </div>

                                <!-- 重复文件 -->
                                <div class="file-info duplicate-file">
                                    <div class="file-header">
                                        <h4>{{ t("import.duplicateFile") }}</h4>
                                        <BaseTag color="orange">{{
                                            t("import.importing")
                                        }}</BaseTag>
                                    </div>
                                    <div class="file-details">
                                        <div class="file-name">
                                            {{ duplicate.duplicateFile.name }}
                                        </div>
                                        <div class="file-meta">
                                            <span class="file-size">{{
                                                formatSize(duplicate.duplicateFile.size)
                                            }}</span>
                                            <span
                                                v-if="duplicate.duplicateFile.modifiedTime"
                                                class="file-date"
                                            >
                                                {{
                                                    formatDate(duplicate.duplicateFile.modifiedTime)
                                                }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 重复原因 -->
                            <div class="duplicate-reason">
                                <InfoCircleOutlined />
                                <span>{{ duplicate.reason }}</span>
                            </div>

                            <!-- 处理策略选择 -->
                            <div class="strategy-selection">
                                <label>{{ t("import.action") }}:</label>
                                <BaseRadioGroup
                                    :value="getSelectedStrategy(duplicate)"
                                    @change="(e) => setDuplicateStrategy(duplicate, e.target.value)"
                                >
                                    <BaseRadio value="skip">
                                        <BaseTooltip :title="t('import.strategy.skip.description')">
                                            {{ t("import.strategy.skip.label") }}
                                        </BaseTooltip>
                                    </BaseRadio>
                                    <BaseRadio value="rename">
                                        <BaseTooltip
                                            :title="t('import.strategy.rename.description')"
                                        >
                                            {{ t("import.strategy.rename.label") }}
                                        </BaseTooltip>
                                    </BaseRadio>
                                    <BaseRadio value="overwrite">
                                        <BaseTooltip
                                            :title="t('import.strategy.overwrite.description')"
                                        >
                                            <span class="danger-option">{{
                                                t("import.strategy.overwrite.label")
                                            }}</span>
                                        </BaseTooltip>
                                    </BaseRadio>
                                    <BaseRadio value="keep_both">
                                        <BaseTooltip
                                            :title="t('import.strategy.keepBoth.description')"
                                        >
                                            {{ t("import.strategy.keepBoth.label") }}
                                        </BaseTooltip>
                                    </BaseRadio>
                                </BaseRadioGroup>
                            </div>

                            <!-- 推荐建议 -->
                            <div v-if="getRecommendation(duplicate)" class="recommendation">
                                <BulbOutlined />
                                <span
                                    >{{ t("import.recommendation") }}:
                                    {{ getRecommendation(duplicate) }}</span
                                >
                            </div>

                            <!-- 警告信息 -->
                            <div v-if="getWarning(duplicate)" class="warning">
                                <WarningOutlined />
                                <span>{{ getWarning(duplicate) }}</span>
                            </div>
                        </div>
                    </BaseListItem>
                </template>
            </BaseList>
        </div>

        <!-- 文件对比对话框 -->
        <BaseModal
            v-model:open="showComparisonDialog"
            :title="t('import.fileComparison')"
            width="900px"
            :footer="null"
        >
            <div v-if="comparisonData" class="file-comparison-dialog">
                <BaseRow :gutter="24">
                    <!-- 原文件详情 -->
                    <BaseCol :span="12">
                        <div class="comparison-panel">
                            <h4>{{ t("import.originalFile") }}</h4>
                            <BaseDescriptions :column="1" size="small" bordered>
                                <BaseDescriptionItem :label="t('import.fileName')">
                                    {{ comparisonData.originalFile.name }}
                                </BaseDescriptionItem>
                                <BaseDescriptionItem :label="t('import.fileSize')">
                                    {{ formatSize(comparisonData.originalFile.size) }}
                                </BaseDescriptionItem>
                                <BaseDescriptionItem :label="t('import.modifiedTime')">
                                    {{ formatDate(comparisonData.originalFile.modifiedTime) }}
                                </BaseDescriptionItem>
                                <BaseDescriptionItem :label="t('import.filePath')">
                                    <span
                                        class="copyable-text"
                                        @click="copyToClipboard(comparisonData.originalFile.path)"
                                    >
                                        {{ comparisonData.originalFile.path }}
                                    </span>
                                </BaseDescriptionItem>
                            </BaseDescriptions>
                        </div>
                    </BaseCol>

                    <!-- 重复文件详情 -->
                    <BaseCol :span="12">
                        <div class="comparison-panel">
                            <h4>{{ t("import.duplicateFile") }}</h4>
                            <BaseDescriptions :column="1" size="small" bordered>
                                <BaseDescriptionItem :label="t('import.fileName')">
                                    {{ comparisonData.duplicateFile.name }}
                                </BaseDescriptionItem>
                                <BaseDescriptionItem :label="t('import.fileSize')">
                                    {{ formatSize(comparisonData.duplicateFile.size) }}
                                </BaseDescriptionItem>
                                <BaseDescriptionItem :label="t('import.modifiedTime')">
                                    {{ formatDate(comparisonData.duplicateFile.modifiedTime) }}
                                </BaseDescriptionItem>
                                <BaseDescriptionItem :label="t('import.filePath')">
                                    <span
                                        class="copyable-text"
                                        @click="copyToClipboard(comparisonData.duplicateFile.path)"
                                    >
                                        {{ comparisonData.duplicateFile.path }}
                                    </span>
                                </BaseDescriptionItem>
                            </BaseDescriptions>
                        </div>
                    </BaseCol>
                </BaseRow>

                <!-- 对比分析 -->
                <div v-if="comparisonAnalysis" class="comparison-analysis">
                    <div class="divider">{{ t("import.comparisonAnalysis") }}</div>
                    <BaseDescriptions :column="2" size="small" bordered>
                        <BaseDescriptionItem :label="t('import.sizeDifference')">
                            <span
                                :class="getSizeDifferenceClass(comparisonAnalysis.sizeDifference)"
                            >
                                {{ formatSizeDifference(comparisonAnalysis.sizeDifference) }}
                            </span>
                        </BaseDescriptionItem>
                        <BaseDescriptionItem :label="t('import.timeDifference')">
                            <span
                                :class="getTimeDifferenceClass(comparisonAnalysis.timeDifference)"
                            >
                                {{ formatTimeDifference(comparisonAnalysis.timeDifference) }}
                            </span>
                        </BaseDescriptionItem>
                        <BaseDescriptionItem :label="t('import.recommendation')" :span="2">
                            <BaseTag
                                :color="getRecommendationColor(comparisonAnalysis.recommendation)"
                            >
                                {{
                                    t(`import.recommendation.${comparisonAnalysis.recommendation}`)
                                }}
                            </BaseTag>
                        </BaseDescriptionItem>
                    </BaseDescriptions>
                </div>
            </div>
        </BaseModal>

        <!-- 批量确认对话框 -->
        <BaseModal
            v-model:open="showBatchConfirm"
            :title="t('import.confirmBatchAction')"
            :ok-text="t('import.apply')"
            :cancel-text="t('import.cancel')"
            @ok="confirmBatchStrategy"
        >
            <div class="batch-confirm-content">
                <p>
                    {{
                        t("import.batchConfirmMessage", {
                            strategy: getBatchStrategyLabel(),
                            count: selectedDuplicates.size,
                        })
                    }}
                </p>
                <div v-if="batchStrategy === 'overwrite'" class="warning-message">
                    <WarningOutlined />
                    <span>{{ t("import.overwriteWarning") }}</span>
                </div>
            </div>
        </BaseModal>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
    PhWarning as ExclamationCircleOutlined,
    PhLightning as ThunderboltOutlined,
    PhEye as EyeOutlined,
    PhArrowsClockwise as SwapOutlined,
    PhInfo as InfoCircleOutlined,
    PhLightbulb as BulbOutlined,
    PhWarning as WarningOutlined,
} from "@phosphor-icons/vue";
import type { DuplicateFileInfo, DuplicateStrategy, FileComparison } from "@photasa/common";
import {
    BaseButton,
    BaseTag,
    BaseRow,
    BaseCol,
    BaseSpace,
    BaseSelect,
    BaseList,
    BaseListItem,
    BaseCheckbox,
    BaseRadio,
    BaseRadioGroup,
    BaseTooltip,
    BaseDescriptions,
    BaseDescriptionItem,
    BaseModal,
} from "@renderer/components/ui";

// Props
const props = withDefaults(
    defineProps<{
        duplicates: DuplicateFileInfo[];
        pageSize?: number;
    }>(),
    {
        pageSize: 10,
    },
);

// Emits
const emit = defineEmits<{
    (e: "strategy-change", duplicate: DuplicateFileInfo, strategy: DuplicateStrategy): void;
    (e: "batch-strategy", strategy: DuplicateStrategy, selectedDuplicates: Set<string>): void;
    (e: "auto-resolve", duplicates: DuplicateFileInfo[]): void;
}>();

const { t } = useI18n();

// 响应式状态
const batchStrategy = ref<DuplicateStrategy>("rename");
const selectedDuplicates = ref(new Set<string>());
const duplicateStrategies = ref(new Map<string, DuplicateStrategy>());
const showComparisonDialog = ref(false);
const showBatchConfirm = ref(false);
const comparisonData = ref<DuplicateFileInfo | null>(null);
const comparisonAnalysis = ref<FileComparison | null>(null);

// 计算属性
const strategyOptions = computed(() => [
    { label: t("import.strategy.skip.label"), value: "skip" },
    { label: t("import.strategy.rename.label"), value: "rename" },
    { label: t("import.strategy.overwrite.label"), value: "overwrite" },
    { label: t("import.strategy.keepBoth.label"), value: "keep_both" },
]);

const duplicateStats = computed(() => {
    let identicalFiles = 0;
    let totalWastedSpace = 0;

    for (const duplicate of props.duplicates) {
        if (duplicate.reason.includes("Identical")) {
            identicalFiles++;
            totalWastedSpace += duplicate.duplicateFile.size;
        }
    }

    return {
        totalDuplicates: props.duplicates.length,
        identicalFiles,
        totalWastedSpace,
    };
});

const paginationConfig = computed(() => ({
    pageSize: props.pageSize,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) =>
        t("import.pagination", { start: range[0], end: range[1], total }),
}));

// 方法
const getSelectedStrategy = (duplicate: DuplicateFileInfo): DuplicateStrategy => {
    return duplicateStrategies.value.get(duplicate.duplicateFile.path) || "rename";
};

const setDuplicateStrategy = (duplicate: DuplicateFileInfo, strategy: DuplicateStrategy) => {
    duplicateStrategies.value.set(duplicate.duplicateFile.path, strategy);
    emit("strategy-change", duplicate, strategy);
};

const toggleDuplicateSelection = (duplicate: DuplicateFileInfo) => {
    const path = duplicate.duplicateFile.path;
    if (selectedDuplicates.value.has(path)) {
        selectedDuplicates.value.delete(path);
    } else {
        selectedDuplicates.value.add(path);
    }
};

const selectAllDuplicates = () => {
    selectedDuplicates.value.clear();
    for (const duplicate of props.duplicates) {
        selectedDuplicates.value.add(duplicate.duplicateFile.path);
    }
};

const deselectAllDuplicates = () => {
    selectedDuplicates.value.clear();
};

const onBatchStrategyChange = () => {
    // 策略改变时的处理
};

const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        // 可以添加成功提示
    } catch (err) {
        console.error("Failed to copy text: ", err);
    }
};

const applyBatchStrategy = () => {
    if (selectedDuplicates.value.size === 0) {
        // 如果没有选择，应用到所有
        selectAllDuplicates();
    }
    showBatchConfirm.value = true;
};

const confirmBatchStrategy = () => {
    // 应用批量策略
    for (const path of selectedDuplicates.value) {
        duplicateStrategies.value.set(path, batchStrategy.value);
    }

    emit("batch-strategy", batchStrategy.value, selectedDuplicates.value);
    showBatchConfirm.value = false;
};

const getBatchStrategyLabel = (): string => {
    const option = strategyOptions.value.find((opt) => opt.value === batchStrategy.value);
    return option?.label || "";
};

const autoResolve = () => {
    // 自动解决重复文件
    emit("auto-resolve", props.duplicates);
};

const showComparison = async (duplicate: DuplicateFileInfo) => {
    comparisonData.value = duplicate;

    // 这里可以调用API获取详细的文件比较信息
    // comparisonAnalysis.value = await compareFiles(duplicate.originalFile, duplicate.duplicateFile);

    // 模拟比较分析
    comparisonAnalysis.value = {
        sizeDifference: duplicate.originalFile.size - duplicate.duplicateFile.size,
        timeDifference:
            (duplicate.originalFile.modifiedTime?.getTime() || 0) -
            (duplicate.duplicateFile.modifiedTime?.getTime() || 0),
        recommendation: "keep_both",
    };

    showComparisonDialog.value = true;
};

const getRecommendation = (duplicate: DuplicateFileInfo): string => {
    // 基于文件信息提供推荐
    if (duplicate.reason.includes("Identical")) {
        return t("import.recommendation.skipIdentical");
    }

    if (duplicate.originalFile.size > duplicate.duplicateFile.size) {
        return t("import.recommendation.keepLarger");
    }

    return "";
};

const getWarning = (duplicate: DuplicateFileInfo): string => {
    const strategy = getSelectedStrategy(duplicate);

    if (strategy === "overwrite") {
        if (duplicate.originalFile.size > duplicate.duplicateFile.size) {
            return t("import.warning.overwriteLarger");
        }
        if (
            (duplicate.originalFile.modifiedTime?.getTime() || 0) >
            (duplicate.duplicateFile.modifiedTime?.getTime() || 0)
        ) {
            return t("import.warning.overwriteNewer");
        }
    }

    return "";
};

// 格式化函数
const formatSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (date: Date | undefined): string => {
    if (!date) return t("import.unknown");
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
};

const formatSizeDifference = (diff: number): string => {
    if (diff === 0) return t("import.sameSize");
    const absDiff = Math.abs(diff);
    const sign = diff > 0 ? "+" : "-";
    return `${sign}${formatSize(absDiff)}`;
};

const formatTimeDifference = (diff: number): string => {
    if (diff === 0) return t("import.sameTime");
    const absDiff = Math.abs(diff);
    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
        return diff > 0 ? t("import.daysNewer", { days }) : t("import.daysOlder", { days });
    } else if (hours > 0) {
        return diff > 0 ? t("import.hoursNewer", { hours }) : t("import.hoursOlder", { hours });
    } else {
        return diff > 0 ? t("import.newer") : t("import.older");
    }
};

const getSizeDifferenceClass = (diff: number): string => {
    if (diff > 0) return "size-larger";
    if (diff < 0) return "size-smaller";
    return "size-same";
};

const getTimeDifferenceClass = (diff: number): string => {
    if (diff > 0) return "time-newer";
    if (diff < 0) return "time-older";
    return "time-same";
};

const getRecommendationColor = (recommendation: string): string => {
    switch (recommendation) {
        case "keep_original":
            return "blue";
        case "keep_duplicate":
            return "green";
        case "keep_both":
            return "orange";
        default:
            return "default";
    }
};
</script>

<style scoped lang="less">
.duplicate-handler {
    .duplicate-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding: 12px;
        background-color: var(--warning-color);
        opacity: 0.1;
        border: 1px solid var(--warning-color);
        border-radius: 6px;

        h3 {
            margin: 0;
            color: var(--warning-color);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .duplicate-stats {
            display: flex;
            gap: 8px;
        }
    }

    .batch-actions {
        margin-bottom: 16px;
        padding: 12px;
        background-color: var(--hover-color);
        border-radius: 6px;

        .batch-strategy {
            display: flex;
            align-items: center;
            gap: 8px;

            label {
                font-weight: 500;
                white-space: nowrap;
                color: var(--text-color);
            }
        }

        .batch-selection {
            text-align: right;
        }
    }

    .duplicate-list {
        .duplicate-item {
            border: 1px solid var(--border-color);
            border-radius: 6px;
            margin-bottom: 16px;
            padding: 16px;

            &:hover {
                border-color: var(--primary-color);
                box-shadow: var(--box-shadow);
            }
        }

        .duplicate-content {
            width: 100%;

            .file-comparison {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 16px;

                .file-info {
                    flex: 1;
                    padding: 12px;
                    border: 1px solid var(--border-color);
                    border-radius: 4px;

                    &.original-file {
                        background-color: var(--success-color);
                        opacity: 0.1;
                        border-color: var(--success-color);
                    }

                    &.duplicate-file {
                        background-color: var(--warning-color);
                        opacity: 0.1;
                        border-color: var(--warning-color);
                    }

                    .file-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;

                        h4 {
                            margin: 0;
                            font-size: 14px;
                            color: var(--text-color);
                        }
                    }

                    .file-details {
                        .file-name {
                            font-weight: 500;
                            margin-bottom: 4px;
                            word-break: break-all;
                            color: var(--text-color);
                        }

                        .file-meta {
                            display: flex;
                            gap: 12px;
                            font-size: 12px;
                            color: var(--text-color);
                            opacity: 0.7;

                            .file-size {
                                font-weight: 500;
                                color: var(--primary-color);
                            }
                        }
                    }
                }

                .comparison-arrow {
                    font-size: 18px;
                    color: var(--text-color);
                    opacity: 0.5;
                }
            }

            .duplicate-reason {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
                padding: 8px;
                background-color: var(--hover-color);
                border-radius: 4px;
                font-size: 13px;
                color: var(--text-color);
                opacity: 0.7;
            }

            .strategy-selection {
                margin-bottom: 12px;

                label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: var(--text-color);
                }

                .danger-option {
                    color: var(--error-color);
                }
            }

            .recommendation {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
                background-color: var(--success-color);
                opacity: 0.1;
                border: 1px solid var(--success-color);
                border-radius: 4px;
                font-size: 13px;
                color: var(--success-color);
                margin-bottom: 8px;
            }

            .warning {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
                background-color: var(--warning-color);
                opacity: 0.1;
                border: 1px solid var(--warning-color);
                border-radius: 4px;
                font-size: 13px;
                color: var(--warning-color);
            }
        }
    }

    .file-comparison-dialog {
        .comparison-panel {
            h4 {
                margin-bottom: 12px;
                color: var(--text-color);
            }
        }

        .comparison-analysis {
            margin-top: 16px;

            .size-larger {
                color: var(--success-color);
            }
            .size-smaller {
                color: var(--warning-color);
            }
            .size-same {
                color: var(--text-color);
                opacity: 0.7;
            }

            .time-newer {
                color: var(--success-color);
            }
            .time-older {
                color: var(--warning-color);
            }
            .time-same {
                color: var(--text-color);
                opacity: 0.7;
            }
        }
    }

    .batch-confirm-content {
        .warning-message {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 12px;
            padding: 8px;
            background-color: var(--warning-color);
            opacity: 0.1;
            border: 1px solid var(--warning-color);
            border-radius: 4px;
            color: var(--warning-color);
        }
    }
}
</style>
