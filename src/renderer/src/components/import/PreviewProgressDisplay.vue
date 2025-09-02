<template>
    <div class="h-full flex flex-col">
        <!-- Progress Header -->
        <div class="text-center mb-6">
            <!-- Pure CSS Spinner -->
            <div
                class="w-12 h-12 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
            ></div>
            <h3 class="text-lg font-medium mb-2 text-[var(--color-text)]">正在扫描目录...</h3>
            <p class="text-sm text-[var(--color-text-secondary)]">
                {{ progress?.message || "正在处理..." }}
            </p>
        </div>

        <!-- Progress Stats -->
        <div class="flex justify-center gap-8 mb-6 text-sm">
            <div class="text-center">
                <div class="text-2xl font-bold text-[var(--color-text)]">
                    {{ progress?.filesFound || 0 }}
                </div>
                <div class="text-[var(--color-text-secondary)]">文件已发现</div>
            </div>
            <div class="text-center">
                <div class="text-2xl font-bold text-[var(--color-text)]">
                    {{ progress?.directoriesScanned || 0 }}
                </div>
                <div class="text-[var(--color-text-secondary)]">目录已扫描</div>
            </div>
            <div v-if="progress?.totalDirectories" class="text-center">
                <div class="text-2xl font-bold text-[var(--color-text)]">
                    {{
                        Math.round(
                            (props.progress.directoriesScanned / (props.progress.totalDirectories || 1)) *
                                100,
                        )
                    }}%
                </div>
                <div class="text-[var(--color-text-secondary)]">扫描进度</div>
            </div>
        </div>

        <!-- Current Path Display -->
        <div v-if="progress?.currentPath" class="mb-4 px-4">
            <div class="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                <div class="text-xs text-[var(--color-text-secondary)] mb-1">当前扫描路径</div>
                <div class="font-mono text-sm text-[var(--color-text)] truncate">
                    {{ formatPath(props.progress.currentPath || '') }}
                </div>
            </div>
        </div>

        <!-- Discovered Files List -->
        <div class="flex-1 min-h-0 px-4">
            <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-semibold text-[var(--color-text)]">最近发现的文件</h4>
                <span class="text-xs text-[var(--color-text-secondary)]">
                    显示最新 {{ Math.min(props.discoveredFiles?.length || 0, 30) }} 个
                </span>
            </div>

            <div
                v-if="props.discoveredFiles && props.discoveredFiles.length > 0"
                class="bg-[var(--color-bg-secondary)] rounded-lg p-2 max-h-96 overflow-y-auto"
            >
                <div
                    v-for="(item, index) in props.discoveredFiles.slice(0, 30)"
                    :key="index"
                    class="flex items-center p-2 hover:bg-[var(--color-bg-hover)] rounded transition-colors"
                >
                    <!-- File Icon -->
                    <div class="mr-3 flex-shrink-0">
                        <div
                            v-if="item?.type === 'image'"
                            class="w-8 h-8 bg-blue-100 rounded flex items-center justify-center"
                        >
                            <svg
                                class="w-5 h-5 text-blue-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <div
                            v-else-if="item?.type === 'video'"
                            class="w-8 h-8 bg-purple-100 rounded flex items-center justify-center"
                        >
                            <svg
                                class="w-5 h-5 text-purple-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <div
                            v-else
                            class="w-8 h-8 bg-gray-100 rounded flex items-center justify-center"
                        >
                            <svg
                                class="w-5 h-5 text-gray-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                        </div>
                    </div>

                    <!-- File Info -->
                    <div class="min-w-0 flex-1">
                        <div class="text-sm font-medium text-[var(--color-text)] truncate">
                            {{ getFileName(item) }}
                        </div>
                        <div class="text-xs text-[var(--color-text-secondary)] mt-0.5">
                            {{ formatFileSize(item?.size) }}
                            <span v-if="getFilePath(item)" class="mx-1">•</span>
                            <span v-if="getFilePath(item)" class="font-mono">{{
                                getFilePath(item)
                            }}</span>
                        </div>
                    </div>

                    <!-- File Type Badge -->
                    <div class="ml-2 flex-shrink-0">
                        <span
                            :class="getTypeBadgeClass(item?.type)"
                            class="text-xs px-2 py-0.5 rounded-full"
                        >
                            {{ getTypeLabel(item?.type) }}
                        </span>
                    </div>
                </div>
            </div>

            <div v-else class="bg-[var(--color-bg-secondary)] rounded-lg p-8">
                <div class="text-center text-[var(--color-text-secondary)]">
                    <div class="mb-2">
                        <div
                            class="w-8 h-8 mx-auto border-2 border-gray-300 border-t-transparent rounded-full animate-spin"
                        ></div>
                    </div>
                    <p class="text-sm">等待发现文件...</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { PreviewProgress } from "@common/import-types";

interface Props {
    progress: PreviewProgress;
    discoveredFiles: any[];
}

const props = defineProps<Props>();

// 格式化路径显示
const formatPath = (filePath: string) => {
    if (!filePath) return "";

    const parts = filePath.split(/[/\\]/);
    if (parts.length > 3) {
        return ".../" + parts.slice(-3).join("/");
    }
    return filePath;
};

// 获取文件名
const getFileName = (file: any) => {
    if (!file) return "Unknown";
    if (file.name) return file.name;
    if (file.path) {
        const parts = file.path.split(/[/\\]/);
        return parts[parts.length - 1];
    }
    return "Unknown";
};

// 获取文件路径
const getFilePath = (file: any) => {
    if (!file || !file.path) return "";
    const parts = file.path.split(/[/\\]/);
    if (parts.length > 1) {
        const dirParts = parts.slice(0, -1);
        if (dirParts.length > 2) {
            return ".../" + dirParts.slice(-2).join("/");
        }
        return dirParts.join("/");
    }
    return "";
};

// 格式化文件大小
const formatFileSize = (size: number | undefined) => {
    if (!size) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let index = 0;
    let formattedSize = size;

    while (formattedSize >= 1024 && index < units.length - 1) {
        formattedSize /= 1024;
        index++;
    }

    return `${formattedSize.toFixed(1)} ${units[index]}`;
};

// 获取类型标签
const getTypeLabel = (type: string) => {
    switch (type) {
        case "image":
            return "图片";
        case "video":
            return "视频";
        default:
            return "文件";
    }
};

// 获取类型徽章样式
const getTypeBadgeClass = (type: string) => {
    switch (type) {
        case "image":
            return "bg-blue-100 text-blue-700";
        case "video":
            return "bg-purple-100 text-purple-700";
        default:
            return "bg-gray-100 text-gray-700";
    }
};
</script>

<style scoped>
/* Tailwind spinner animation */
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.animate-spin {
    animation: spin 1s linear infinite;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
    width: 6px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
}
</style>
