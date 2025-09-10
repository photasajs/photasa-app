<template>
    <div class="file-filter">
        <!-- 过滤器头部 -->
        <div class="filter-header">
            <h4>{{ t("import.filters") }}</h4>
            <div class="filter-actions">
                <BaseButton size="sm" type="link" @click="resetFilters">
                    <template #icon><ReloadOutlined /></template>
                    {{ t("import.resetFilters") }}
                </BaseButton>
                <BaseButton size="sm" type="link" @click="toggleAdvanced">
                    <template #icon><SettingOutlined /></template>
                    {{ showAdvanced ? t("import.hideAdvanced") : t("import.showAdvanced") }}
                </BaseButton>
            </div>
        </div>

        <!-- 基础过滤器 -->
        <div class="filter-section">
            <BaseRow :gutter="16">
                <!-- 文件类型过滤 -->
                <BaseCol :span="12">
                    <div class="filter-item">
                        <label class="filter-label">{{ t("import.fileTypes.label") }}</label>
                        <BaseCheckboxGroup
                            v-model:modelValue="localFilters.fileTypes"
                            :options="fileTypeOptions"
                            @update:modelValue="onFilterChange"
                        />
                    </div>
                </BaseCol>

                <!-- 包含子文件夹 -->
                <BaseCol :span="12">
                    <div class="filter-item">
                        <label class="filter-label">{{ t("import.includeSubfolders") }}</label>
                        <BaseSwitch
                            v-model:modelValue="localFilters.includeSubfolders"
                            @update:modelValue="onFilterChange"
                        />
                    </div>
                </BaseCol>
            </BaseRow>
        </div>

        <!-- 高级过滤器 -->
        <div v-if="showAdvanced" class="filter-section advanced-filters">
            <div class="divider">{{ t("import.advancedFilters") }}</div>

            <!-- 文件大小过滤 -->
            <div class="filter-item">
                <label class="filter-label">
                    {{ t("import.fileSizeRange") }}
                    <BaseTooltip :title="t('import.fileSizeHelp')">
                        <QuestionCircleOutlined class="help-icon" />
                    </BaseTooltip>
                </label>
                <div class="size-filter">
                    <BaseRow :gutter="8" align="middle">
                        <BaseCol :span="5">
                            <input
                                v-model.number="sizeFilter.minValue"
                                type="number"
                                :min="0"
                                class="file-size-input"
                                @change="onSizeFilterChange"
                            />
                        </BaseCol>
                        <BaseCol :span="4">
                            <BaseSelect
                                v-model:modelValue="sizeFilter.minUnit"
                                size="sm"
                                :options="sizeUnitOptions"
                                @update:modelValue="onSizeFilterChange"
                            />
                        </BaseCol>
                        <BaseCol :span="2" class="range-separator">
                            <span>-</span>
                        </BaseCol>
                        <BaseCol :span="5">
                            <input
                                v-model.number="sizeFilter.maxValue"
                                type="number"
                                :min="sizeFilter.minValue || 0"
                                class="file-size-input"
                                @change="onSizeFilterChange"
                            />
                        </BaseCol>
                        <BaseCol :span="4">
                            <BaseSelect
                                v-model:modelValue="sizeFilter.maxUnit"
                                size="sm"
                                :options="sizeUnitOptions"
                                @update:modelValue="onSizeFilterChange"
                            />
                        </BaseCol>
                        <BaseCol :span="4">
                            <BaseButton size="sm" type="link" @click="resetSizeFilter">
                                {{ t("import.reset") }}
                            </BaseButton>
                        </BaseCol>
                    </BaseRow>
                </div>
            </div>

            <!-- 日期范围过滤 -->
            <div class="filter-item">
                <label class="filter-label">
                    {{ t("import.dateRange") }}
                    <BaseTooltip :title="t('import.dateRangeHelp')">
                        <QuestionCircleOutlined class="help-icon" />
                    </BaseTooltip>
                </label>
                <div class="date-filter">
                    <input
                        v-model="dateRange"
                        type="date"
                        class="date-input"
                        @change="
                            (e) =>
                                onDateRangeChange([
                                    dayjs((e.target as HTMLInputElement).value),
                                    dayjs((e.target as HTMLInputElement).value),
                                ])
                        "
                    />
                    <BaseButton size="sm" type="link" @click="resetDateFilter">
                        {{ t("import.reset") }}
                    </BaseButton>
                </div>
            </div>

            <!-- 快速日期过滤 -->
            <div class="filter-item">
                <label class="filter-label">{{ t("import.quickDateFilters") }}</label>
                <div class="quick-date-filters">
                    <div class="flex">
                        <BaseButton
                            v-for="preset in datePresets"
                            :key="preset.key"
                            size="sm"
                            :type="selectedDatePreset === preset.key ? 'primary' : 'default'"
                            @click="applyDatePreset(preset)"
                            class="first:rounded-r-none last:rounded-l-none middle:rounded-none border-r-0 last:border-r"
                        >
                            {{ preset.label }}
                        </BaseButton>
                    </div>
                </div>
            </div>

            <!-- 文件名模式过滤 -->
            <div class="filter-item">
                <label class="filter-label">
                    {{ t("import.fileNamePattern") }}
                    <BaseTooltip :title="t('import.fileNamePatternHelp')">
                        <QuestionCircleOutlined class="help-icon" />
                    </BaseTooltip>
                </label>
                <div class="pattern-filter">
                    <input
                        v-model="fileNamePattern"
                        :placeholder="t('import.fileNamePatternPlaceholder')"
                        class="pattern-input"
                        @change="onPatternChange"
                    />
                    <BaseButton size="sm" type="link" @click="resetPatternFilter">
                        {{ t("import.reset") }}
                    </BaseButton>
                </div>
            </div>

            <!-- 排除模式 -->
            <div class="filter-item">
                <label class="filter-label">
                    {{ t("import.excludePatterns") }}
                    <BaseTooltip :title="t('import.excludePatternsHelp')">
                        <QuestionCircleOutlined class="help-icon" />
                    </BaseTooltip>
                </label>
                <div class="exclude-patterns">
                    <BaseSelect
                        v-model:modelValue="excludePatterns"
                        mode="tags"
                        size="sm"
                        :options="[]"
                        :placeholder="t('import.excludePatternsPlaceholder')"
                        @update:modelValue="onExcludePatternsChange"
                    />
                </div>
            </div>
        </div>

        <!-- 过滤结果统计 -->
        <div v-if="showStats" class="filter-stats">
            <div class="divider" />
            <div class="stats-content">
                <BaseRow :gutter="16">
                    <BaseCol :span="6">
                        <div class="statistic-item">
                            <div class="statistic-title">{{ t("import.filteredFiles") }}</div>
                            <div class="statistic-value" style="font-size: 14px; color: #1890ff">
                                {{ stats.filteredFiles }}
                            </div>
                        </div>
                    </BaseCol>
                    <BaseCol :span="6">
                        <div class="statistic-item">
                            <div class="statistic-title">{{ t("import.totalSize") }}</div>
                            <div class="statistic-value" style="font-size: 14px; color: #52c41a">
                                {{ formatSize(stats.totalSize) }}
                            </div>
                        </div>
                    </BaseCol>
                    <BaseCol :span="6">
                        <div class="statistic-item">
                            <div class="statistic-title">{{ t("import.images") }}</div>
                            <div class="statistic-value" style="font-size: 14px; color: #722ed1">
                                {{ stats.imageFiles }}
                            </div>
                        </div>
                    </BaseCol>
                    <BaseCol :span="6">
                        <div class="statistic-item">
                            <div class="statistic-title">{{ t("import.videos") }}</div>
                            <div class="statistic-value" style="font-size: 14px; color: #fa8c16">
                                {{ stats.videoFiles }}
                            </div>
                        </div>
                    </BaseCol>
                </BaseRow>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import dayjs, { type Dayjs } from "dayjs";
import {
    PhArrowClockwise as ReloadOutlined,
    PhGear as SettingOutlined,
    PhQuestion as QuestionCircleOutlined,
} from "@phosphor-icons/vue";
import type { ImportFilters } from "@common/import-types";
import {
    BaseButton,
    BaseRow,
    BaseCol,
    BaseSwitch,
    BaseTooltip,
    BaseSelect,
} from "@renderer/components/ui";

// Props
const props = withDefaults(
    defineProps<{
        filters: ImportFilters;
        showStats?: boolean;
        stats?: {
            filteredFiles: number;
            totalSize: number;
            imageFiles: number;
            videoFiles: number;
        };
    }>(),
    {
        showStats: false,
        stats: () => ({
            filteredFiles: 0,
            totalSize: 0,
            imageFiles: 0,
            videoFiles: 0,
        }),
    },
);

// Emits
const emit = defineEmits<{
    (e: "update:filters", filters: ImportFilters): void;
    (e: "filter-change", filters: ImportFilters): void;
}>();

const { t } = useI18n();

// 响应式状态
const showAdvanced = ref(false);
const selectedDatePreset = ref<string | null>(null);
const fileNamePattern = ref("");
const excludePatterns = ref<string>("");

// 本地过滤器状态
const localFilters = reactive<ImportFilters>({ ...props.filters });

// 大小过滤器状态
const sizeFilter = reactive({
    minValue: 0,
    minUnit: "KB",
    maxValue: null as number | null,
    maxUnit: "GB",
});

// 日期范围
const dateRange = ref<[Dayjs, Dayjs] | null>(null);

// 选项配置
const fileTypeOptions = computed(() => [
    { label: t("import.fileTypes.images"), value: "image" },
    { label: t("import.fileTypes.videos"), value: "video" },
]);

const sizeUnitOptions = [
    { label: "B", value: "B" },
    { label: "KB", value: "KB" },
    { label: "MB", value: "MB" },
    { label: "GB", value: "GB" },
];

const datePresets = computed(() => [
    {
        key: "today",
        label: t("import.datePresets.today"),
        getValue: () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return { start: today, end: tomorrow };
        },
    },
    {
        key: "yesterday",
        label: t("import.datePresets.yesterday"),
        getValue: () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const today = new Date(yesterday);
            today.setDate(today.getDate() + 1);
            return { start: yesterday, end: today };
        },
    },
    {
        key: "thisWeek",
        label: t("import.datePresets.thisWeek"),
        getValue: () => {
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);
            return { start: startOfWeek, end: endOfWeek };
        },
    },
    {
        key: "thisMonth",
        label: t("import.datePresets.thisMonth"),
        getValue: () => {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            return { start: startOfMonth, end: endOfMonth };
        },
    },
    {
        key: "lastMonth",
        label: t("import.datePresets.lastMonth"),
        getValue: () => {
            const now = new Date();
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return { start: startOfLastMonth, end: endOfLastMonth };
        },
    },
]);

// 方法
const onFilterChange = () => {
    selectedDatePreset.value = null;
    emitFilterChange();
};

const onSizeFilterChange = () => {
    // 转换大小单位为字节
    const minBytes = convertToBytes(sizeFilter.minValue || 0, sizeFilter.minUnit);
    const maxBytes = sizeFilter.maxValue
        ? convertToBytes(sizeFilter.maxValue, sizeFilter.maxUnit)
        : Number.MAX_SAFE_INTEGER;

    localFilters.sizeRange = {
        min: minBytes,
        max: maxBytes,
    };

    selectedDatePreset.value = null;
    emitFilterChange();
};

const onDateRangeChange = (dates: [Dayjs, Dayjs] | null) => {
    if (dates) {
        localFilters.dateRange = {
            start: dates[0].toDate(),
            end: dates[1].toDate(),
        };
    } else {
        localFilters.dateRange = {
            start: new Date(0),
            end: new Date(),
        };
    }

    selectedDatePreset.value = null;
    emitFilterChange();
};

const onPatternChange = () => {
    // 这里可以添加文件名模式过滤逻辑
    emitFilterChange();
};

const onExcludePatternsChange = () => {
    // 这里可以添加排除模式过滤逻辑
    emitFilterChange();
};

const applyDatePreset = (preset: any) => {
    const { start, end } = preset.getValue();
    localFilters.dateRange = { start, end };
    selectedDatePreset.value = preset.key;

    // 更新日期选择器显示
    dateRange.value = null;

    emitFilterChange();
};

const resetFilters = () => {
    localFilters.fileTypes = ["image", "video"];
    localFilters.sizeRange = { min: 0, max: Number.MAX_SAFE_INTEGER };
    localFilters.dateRange = { start: new Date(0), end: new Date() };
    localFilters.includeSubfolders = true;

    // 重置其他状态
    sizeFilter.minValue = 0;
    sizeFilter.maxValue = null;
    dateRange.value = null;
    selectedDatePreset.value = null;
    fileNamePattern.value = "";
    excludePatterns.value = "";

    emitFilterChange();
};

const resetSizeFilter = () => {
    sizeFilter.minValue = 0;
    sizeFilter.maxValue = null;
    sizeFilter.minUnit = "KB";
    sizeFilter.maxUnit = "GB";

    localFilters.sizeRange = { min: 0, max: Number.MAX_SAFE_INTEGER };
    emitFilterChange();
};

const resetDateFilter = () => {
    dateRange.value = null;
    selectedDatePreset.value = null;
    localFilters.dateRange = { start: new Date(0), end: new Date() };
    emitFilterChange();
};

const resetPatternFilter = () => {
    fileNamePattern.value = "";
    emitFilterChange();
};

const toggleAdvanced = () => {
    showAdvanced.value = !showAdvanced.value;
};

const emitFilterChange = () => {
    // 深度克隆过滤器，确保 Date 对象被正确处理
    const clonedFilters = {
        ...localFilters,
        dateRange: {
            start: new Date(localFilters.dateRange.start.getTime()),
            end: new Date(localFilters.dateRange.end.getTime()),
        },
    };
    emit("update:filters", clonedFilters);
    emit("filter-change", clonedFilters);
};

// 工具函数
const convertToBytes = (value: number, unit: string): number => {
    const multipliers = {
        B: 1,
        KB: 1024,
        MB: 1024 * 1024,
        GB: 1024 * 1024 * 1024,
    };
    return value * (multipliers[unit as keyof typeof multipliers] || 1);
};

const formatSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// 监听器
watch(
    () => props.filters,
    (newFilters) => {
        Object.assign(localFilters, newFilters);
    },
    { deep: true },
);
</script>

<style scoped lang="less">
.file-filter {
    .filter-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        h4 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color);
        }

        .filter-actions {
            display: flex;
            gap: 8px;
        }
    }

    .filter-section {
        margin-bottom: 16px;

        &.advanced-filters {
            background-color: var(--hover-color);
            padding: 16px;
            border-radius: 6px;
        }
    }

    .filter-item {
        margin-bottom: 16px;

        &:last-child {
            margin-bottom: 0;
        }

        .filter-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            font-size: 13px;
            color: var(--text-color);

            .help-icon {
                margin-left: 4px;
                color: var(--text-color);
                opacity: 0.5;
                cursor: help;
            }
        }
    }

    .size-filter {
        .range-separator {
            text-align: center;

            span {
                color: var(--text-color);
                opacity: 0.5;
            }
        }
    }

    .date-filter {
        display: flex;
        align-items: center;
        gap: 8px;

        .ant-picker {
            flex: 1;
        }
    }

    .quick-date-filters {
        .ant-btn-group {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
    }

    .pattern-filter {
        display: flex;
        align-items: center;
        gap: 8px;

        .ant-input {
            flex: 1;
        }
    }

    .exclude-patterns {
        .ant-select {
            width: 100%;
        }
    }

    .filter-stats {
        .stats-content {
            padding: 12px 0;
        }
    }
}
</style>
