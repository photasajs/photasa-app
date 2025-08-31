<template>
    <div class="import-history">
        <h2 class="text-xl font-bold mb-4">{{ t("import.history.title") }}</h2>

        <!-- 搜索和过滤 -->
        <div class="mb-4 flex gap-4">
            <BaseInput
                v-model="searchQuery"
                :placeholder="t('import.history.search')"
                class="flex-1"
            >
                <template #prefix>
                    <MagnifyingGlassIcon class="w-5 h-5 text-[var(--color-text-secondary)]" />
                </template>
            </BaseInput>

            <BaseSelect v-model="timeFilter" :options="timeFilterOptions" class="w-48" />
        </div>

        <!-- 历史记录列表 -->
        <div v-if="filteredHistory.length > 0" class="space-y-4">
            <div
                v-for="entry in filteredHistory"
                :key="entry.id"
                class="border border-[var(--color-border)] rounded-lg overflow-hidden"
            >
                <div
                    class="p-4 bg-[var(--color-bg-secondary)] flex items-center justify-between cursor-pointer"
                    @click="toggleDetails(entry.id)"
                >
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-lg font-medium">
                                {{ formatDate(entry.timestamp) }}
                            </span>
                            <span class="text-sm text-[var(--color-text-secondary)]">
                                {{ formatTime(entry.timestamp) }}
                            </span>
                            <span
                                class="px-2 py-0.5 rounded-full text-xs"
                                :class="
                                    entry.result.success
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                "
                            >
                                {{
                                    entry.result.success
                                        ? t("import.history.success")
                                        : t("import.history.failed")
                                }}
                            </span>
                        </div>
                        <div class="text-sm text-[var(--color-text-secondary)] mt-1">
                            {{ t("import.history.files", { count: entry.result.successfulFiles }) }}
                            {{ formatSize(entry.statistics.totalSize) }}
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <BaseButton
                            v-if="entry.canUndo"
                            variant="danger"
                            size="sm"
                            @click.stop="confirmUndo(entry)"
                        >
                            <ArrowUturnLeftIcon class="w-4 h-4 mr-1" />
                            {{ t("import.history.undo") }}
                        </BaseButton>

                        <ChevronDownIcon
                            class="w-5 h-5 transition-transform duration-200"
                            :class="{ 'rotate-180': expandedEntries.has(entry.id) }"
                        />
                    </div>
                </div>

                <!-- 详细信息 -->
                <div
                    v-if="expandedEntries.has(entry.id)"
                    class="p-4 border-t border-[var(--color-border)]"
                >
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <h4 class="font-medium mb-1">{{ t("import.history.source") }}</h4>
                            <div class="text-sm">
                                <div
                                    v-for="(path, index) in entry.sourcePaths"
                                    :key="index"
                                    class="truncate"
                                >
                                    {{ path }}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 class="font-medium mb-1">{{ t("import.history.target") }}</h4>
                            <div class="text-sm truncate">{{ entry.targetPath }}</div>
                        </div>
                    </div>

                    <div class="mb-4">
                        <h4 class="font-medium mb-1">{{ t("import.history.statistics") }}</h4>
                        <div class="grid grid-cols-4 gap-4 text-center">
                            <div>
                                <div class="text-lg font-medium">
                                    {{ entry.statistics.totalFiles }}
                                </div>
                                <div class="text-xs text-[var(--color-text-secondary)]">
                                    {{ t("import.history.totalFiles") }}
                                </div>
                            </div>
                            <div>
                                <div class="text-lg font-medium">
                                    {{ entry.statistics.successfulFiles }}
                                </div>
                                <div class="text-xs text-[var(--color-text-secondary)]">
                                    {{ t("import.history.successfulFiles") }}
                                </div>
                            </div>
                            <div>
                                <div class="text-lg font-medium">
                                    {{ entry.statistics.skippedFiles }}
                                </div>
                                <div class="text-xs text-[var(--color-text-secondary)]">
                                    {{ t("import.history.skippedFiles") }}
                                </div>
                            </div>
                            <div>
                                <div class="text-lg font-medium">
                                    {{ entry.statistics.duplicateCount }}
                                </div>
                                <div class="text-xs text-[var(--color-text-secondary)]">
                                    {{ t("import.history.duplicates") }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 文件列表 -->
                    <div v-if="entry.fileList && entry.fileList.length > 0">
                        <h4 class="font-medium mb-2 flex items-center justify-between">
                            <span>{{ t("import.history.files") }}</span>
                            <BaseButton
                                size="sm"
                                variant="secondary"
                                @click="toggleFileList(entry.id)"
                            >
                                {{
                                    showFileLists.has(entry.id)
                                        ? t("import.history.hideFiles")
                                        : t("import.history.showFiles")
                                }}
                            </BaseButton>
                        </h4>

                        <div
                            v-if="showFileLists.has(entry.id)"
                            class="max-h-60 overflow-y-auto border border-[var(--color-border)] rounded-lg"
                        >
                            <table class="min-w-full divide-y divide-[var(--color-border)]">
                                <thead class="bg-[var(--color-bg-secondary)]">
                                    <tr>
                                        <th
                                            class="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
                                        >
                                            {{ t("import.history.fileName") }}
                                        </th>
                                        <th
                                            class="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
                                        >
                                            {{ t("import.history.size") }}
                                        </th>
                                        <th
                                            class="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
                                        >
                                            {{ t("import.history.importTime") }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody
                                    class="bg-[var(--color-bg)] divide-y divide-[var(--color-border)]"
                                >
                                    <tr
                                        v-for="(file, index) in entry.fileList.slice(0, 50)"
                                        :key="index"
                                    >
                                        <td class="px-3 py-2 whitespace-nowrap text-sm">
                                            <div class="truncate max-w-xs">
                                                {{ getFileName(file.targetPath) }}
                                            </div>
                                        </td>
                                        <td class="px-3 py-2 whitespace-nowrap text-sm">
                                            {{ formatSize(file.size) }}
                                        </td>
                                        <td class="px-3 py-2 whitespace-nowrap text-sm">
                                            {{ formatDate(file.importTime) }}
                                        </td>
                                    </tr>
                                    <tr v-if="entry.fileList.length > 50">
                                        <td
                                            colspan="3"
                                            class="px-3 py-2 text-sm text-center text-[var(--color-text-secondary)]"
                                        >
                                            {{
                                                t("import.history.moreFiles", {
                                                    count: entry.fileList.length - 50,
                                                })
                                            }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="text-center py-12">
            <InboxIcon class="w-16 h-16 mx-auto text-[var(--color-text-secondary)]" />
            <h3 class="mt-4 text-lg font-medium">{{ t("import.history.empty") }}</h3>
            <p class="mt-2 text-[var(--color-text-secondary)]">
                {{ t("import.history.emptyDescription") }}
            </p>
        </div>

        <!-- 撤销确认对话框 -->
        <BaseModal
            :open="!!undoEntry"
            :title="t('import.history.undoConfirmTitle')"
            @close="undoEntry = null"
        >
            <div v-if="undoEntry" class="space-y-4">
                <p>{{ t("import.history.undoConfirmMessage") }}</p>

                <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div class="flex">
                        <ExclamationTriangleIcon class="h-5 w-5 text-yellow-400" />
                        <div class="ml-3">
                            <p class="text-sm text-yellow-700">
                                {{ t("import.history.undoWarning") }}
                            </p>
                        </div>
                    </div>
                </div>

                <div class="bg-[var(--color-bg-secondary)] p-4 rounded-lg">
                    <div class="flex justify-between mb-2">
                        <span class="text-sm font-medium">{{
                            t("import.history.filesToDelete")
                        }}</span>
                        <span class="text-sm font-medium">{{
                            undoPreview?.filesToDelete.length || 0
                        }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm font-medium">{{
                            t("import.history.estimatedTime")
                        }}</span>
                        <span class="text-sm font-medium">{{
                            formatTime(undoPreview?.estimatedTime || 0)
                        }}</span>
                    </div>
                </div>

                <div v-if="undoPreview?.potentialIssues?.length" class="space-y-2">
                    <h4 class="font-medium">{{ t("import.history.potentialIssues") }}</h4>
                    <ul class="space-y-1 text-sm">
                        <li
                            v-for="(issue, index) in undoPreview.potentialIssues"
                            :key="index"
                            class="flex items-start"
                        >
                            <span
                                class="inline-block w-2 h-2 mt-1.5 mr-2 rounded-full"
                                :class="{
                                    'bg-red-500': issue.severity === 'error',
                                    'bg-yellow-500': issue.severity === 'warning',
                                    'bg-blue-500': issue.severity === 'info',
                                }"
                            ></span>
                            <span>{{ issue.issue }}</span>
                        </li>
                    </ul>
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-3">
                    <BaseButton variant="secondary" @click="undoEntry = null">
                        {{ t("import.history.cancel") }}
                    </BaseButton>
                    <BaseButton variant="danger" :loading="isUndoing" @click="executeUndo">
                        {{ t("import.history.confirmUndo") }}
                    </BaseButton>
                </div>
            </template>
        </BaseModal>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from "vue";
import { useI18n } from "vue-i18n";
import {
    MagnifyingGlassIcon,
    ChevronDownIcon,
    ArrowUturnLeftIcon,
    InboxIcon,
    ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";
import { BaseButton, BaseInput, BaseSelect, BaseModal } from "@renderer/components/ui";
import { getImportHistory, undoImport } from "@renderer/utils/api";
import type { ImportHistory, UndoPreview } from "@common/import-types";
import path from "path";

const { t } = useI18n();

// 状态
const importHistory = ref<ImportHistory[]>([]);
const searchQuery = ref("");
const timeFilter = ref("all");
const expandedEntries = reactive(new Set<string>());
const showFileLists = reactive(new Set<string>());
const undoEntry = ref<ImportHistory | null>(null);
const undoPreview = ref<UndoPreview | null>(null);
const isUndoing = ref(false);
const isLoading = ref(false);

// 过滤选项
const timeFilterOptions = computed(() => [
    { value: "all", label: t("import.history.timeFilter.all") },
    { value: "today", label: t("import.history.timeFilter.today") },
    { value: "week", label: t("import.history.timeFilter.week") },
    { value: "month", label: t("import.history.timeFilter.month") },
]);

// 过滤后的历史记录
const filteredHistory = computed(() => {
    let filtered = [...importHistory.value];

    // 搜索过滤
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        filtered = filtered.filter((entry) => {
            return (
                entry.sourcePaths.some((path) => path.toLowerCase().includes(query)) ||
                entry.targetPath.toLowerCase().includes(query) ||
                entry.id.toLowerCase().includes(query)
            );
        });
    }

    // 时间过滤
    if (timeFilter.value !== "all") {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (timeFilter.value === "today") {
            filtered = filtered.filter((entry) => new Date(entry.timestamp) >= today);
        } else if (timeFilter.value === "week") {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            filtered = filtered.filter((entry) => new Date(entry.timestamp) >= weekAgo);
        } else if (timeFilter.value === "month") {
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            filtered = filtered.filter((entry) => new Date(entry.timestamp) >= monthAgo);
        }
    }

    return filtered;
});

// 方法
const loadHistory = async () => {
    try {
        isLoading.value = true;
        importHistory.value = await getImportHistory();
    } catch (error) {
        console.error("Failed to load import history:", error);
    } finally {
        isLoading.value = false;
    }
};

const toggleDetails = (id: string) => {
    if (expandedEntries.has(id)) {
        expandedEntries.delete(id);
    } else {
        expandedEntries.add(id);
    }
};

const toggleFileList = (id: string) => {
    if (showFileLists.has(id)) {
        showFileLists.delete(id);
    } else {
        showFileLists.add(id);
    }
};

const confirmUndo = async (entry: ImportHistory) => {
    undoEntry.value = entry;

    try {
        // 获取撤销预览
        // TODO: Implement previewUndoImport function
        undoPreview.value = null;
    } catch (error) {
        console.error("Failed to preview undo:", error);
        undoPreview.value = null;
    }
};

const executeUndo = async () => {
    if (!undoEntry.value) return;

    try {
        isUndoing.value = true;
        await undoImport(undoEntry.value.id);

        // 重新加载历史记录
        await loadHistory();

        // 关闭对话框
        undoEntry.value = null;
    } catch (error) {
        console.error("Failed to undo import:", error);
    } finally {
        isUndoing.value = false;
    }
};

// 格式化函数
const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString();
};

const formatTime = (date: Date | string | number) => {
    if (typeof date === "number") {
        // 处理秒数
        if (date < 60) return `${Math.ceil(date)}s`;
        if (date < 3600) {
            const mins = Math.floor(date / 60);
            const secs = Math.ceil(date % 60);
            return `${mins}m ${secs}s`;
        }
        const hours = Math.floor(date / 3600);
        const mins = Math.floor((date % 3600) / 60);
        return `${hours}h ${mins}m`;
    }

    const d = new Date(date);
    return d.toLocaleTimeString();
};

const formatSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const getFileName = (filePath: string): string => {
    return path.basename(filePath);
};

// 生命周期
onMounted(() => {
    loadHistory();
});
</script>

<style scoped>
.import-history {
    max-width: 1200px;
    margin: 0 auto;
}
</style>
