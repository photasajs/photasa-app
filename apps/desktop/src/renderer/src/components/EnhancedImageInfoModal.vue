<template>
    <BaseModal
        :open="modelValue"
        :title="t('imageInfo.title')"
        size="2xl"
        :closable="true"
        :show-default-footer="false"
        @close="handleClose"
    >
        <template #footer>
            <div class="flex justify-between items-center w-full">
                <div class="flex items-center gap-2">
                    <BaseBadge
                        :type="getStatusType(photasa?.status)"
                        :text="getStatusText(photasa?.status)"
                    />
                    <span class="text-sm text-[var(--color-text-secondary)]">
                        {{ t("imageInfo.lastUpdated") }}:
                        {{ formatDateTime(photasa?.lastModified) }}
                    </span>
                </div>
                <div class="flex gap-3">
                    <BaseButton
                        variant="secondary"
                        @click="handleOpenInFinder"
                        :disabled="!photasa?.path"
                    >
                        <template #icon>
                            <PhFolderOpen class="w-4 h-4" />
                        </template>
                        {{ t("imageInfo.openInFinder") }}
                    </BaseButton>
                    <BaseButton variant="primary" @click="handleFixConfig" :loading="fixing">
                        <template #icon>
                            <PhWrench class="w-4 h-4" />
                        </template>
                        {{ t("imageInfo.repairLibrary") }}
                    </BaseButton>
                </div>
            </div>
        </template>

        <BaseSpinContainer :spinning="loading">
            <div v-if="photasa" class="enhanced-image-info">
                <!-- 文件预览区域 -->
                <div class="preview-section">
                    <div class="preview-card">
                        <div class="preview-header">
                            <div class="file-icon">
                                <PhImage v-if="isImage" class="w-8 h-8 text-blue-500 icon-bounce" />
                                <PhVideo
                                    v-else-if="isVideo"
                                    class="w-8 h-8 text-purple-500 icon-bounce"
                                />
                                <PhFile v-else class="w-8 h-8 text-gray-500 icon-bounce" />
                            </div>
                            <div class="file-info">
                                <h3 class="file-name fade-in-up">
                                    {{ getFileName(photasa.path) }}
                                </h3>
                                <p class="file-path fade-in-up delay-100">{{ photasa.path }}</p>
                            </div>
                            <div class="file-stats">
                                <div class="stat-item fade-in-up delay-200">
                                    <span class="stat-label">{{ t("imageInfo.fileCount") }}</span>
                                    <span class="stat-value counter-animation">{{
                                        getFileCount()
                                    }}</span>
                                </div>
                                <div class="stat-item fade-in-up delay-300">
                                    <span class="stat-label">{{ t("imageInfo.folderSize") }}</span>
                                    <span class="stat-value counter-animation">{{
                                        formatFolderSize()
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 详细信息区域 -->
                <div class="details-section">
                    <!-- 基本信息卡片 -->
                    <div class="info-card">
                        <div class="info-card-header">
                            <PhInfo class="w-5 h-5" />
                            <h4>{{ t("imageInfo.basicInfo") }}</h4>
                        </div>
                        <div class="info-card-content">
                            <div class="info-grid">
                                <div class="info-item">
                                    <span class="info-label">{{ t("imageInfo.location") }}</span>
                                    <div class="info-value path-value">
                                        <code>{{ photasa.path }}</code>
                                        <button
                                            @click="copyPath"
                                            class="copy-button"
                                            :title="t('imageInfo.copyPath')"
                                        >
                                            <PhCopy class="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">{{ t("imageInfo.status") }}</span>
                                    <div class="info-value">
                                        <BaseBadge
                                            :type="getStatusType(photasa.status)"
                                            :text="getStatusText(photasa.status)"
                                        />
                                    </div>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">{{ t("imageInfo.scanDate") }}</span>
                                    <span class="info-value">{{
                                        formatDateTime(photasa.lastModified)
                                    }}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">{{
                                        t("imageInfo.configVersion")
                                    }}</span>
                                    <span class="info-value">{{
                                        photasa.config?.version || "1.0"
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 配置信息卡片 -->
                    <div class="info-card">
                        <div class="info-card-header">
                            <PhGear class="w-5 h-5" />
                            <h4>{{ t("imageInfo.configuration") }}</h4>
                            <button
                                @click="showRawConfig = !showRawConfig"
                                class="toggle-button"
                                :class="{ active: showRawConfig }"
                            >
                                <PhCode class="w-4 h-4" />
                                {{
                                    showRawConfig ? t("imageInfo.hideRaw") : t("imageInfo.showRaw")
                                }}
                            </button>
                        </div>
                        <div class="info-card-content">
                            <div v-if="!showRawConfig" class="config-summary">
                                <div class="config-stats">
                                    <div class="config-stat">
                                        <PhImages class="w-5 h-5 text-blue-500" />
                                        <div>
                                            <span class="config-stat-label">{{
                                                t("imageInfo.totalImages")
                                            }}</span>
                                            <span class="config-stat-value">{{
                                                getImageCount()
                                            }}</span>
                                        </div>
                                    </div>
                                    <div class="config-stat">
                                        <PhVideoCamera class="w-5 h-5 text-purple-500" />
                                        <div>
                                            <span class="config-stat-label">{{
                                                t("imageInfo.totalVideos")
                                            }}</span>
                                            <span class="config-stat-value">{{
                                                getVideoCount()
                                            }}</span>
                                        </div>
                                    </div>
                                    <div class="config-stat">
                                        <PhFolder class="w-5 h-5 text-green-500" />
                                        <div>
                                            <span class="config-stat-label">{{
                                                t("imageInfo.scannedFolders")
                                            }}</span>
                                            <span class="config-stat-value">{{
                                                getFolderCount()
                                            }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="raw-config">
                                <div class="raw-config-header">
                                    <span>{{ t("imageInfo.rawConfiguration") }}</span>
                                    <button
                                        @click="copyConfig"
                                        class="copy-button"
                                        :title="t('imageInfo.copyConfig')"
                                    >
                                        <PhCopy class="w-4 h-4" />
                                    </button>
                                </div>
                                <div class="config-viewer">
                                    <JsonTreeView
                                        :data="
                                            typeof photasa.config === 'string'
                                                ? JSON.parse(photasa.config)
                                                : photasa.config
                                        "
                                        :max-depth="3"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 操作历史卡片 -->
                    <div class="info-card">
                        <div class="info-card-header">
                            <PhClock class="w-5 h-5" />
                            <h4>{{ t("imageInfo.operationHistory") }}</h4>
                        </div>
                        <div class="info-card-content">
                            <div class="history-timeline">
                                <div class="history-item">
                                    <div class="history-icon">
                                        <PhCheckCircle class="w-4 h-4 text-green-500" />
                                    </div>
                                    <div class="history-content">
                                        <span class="history-title">{{
                                            t("imageInfo.lastScan")
                                        }}</span>
                                        <span class="history-time">{{
                                            formatDateTime(photasa.lastModified)
                                        }}</span>
                                    </div>
                                </div>
                                <div class="history-item">
                                    <div class="history-icon">
                                        <PhFileText class="w-4 h-4 text-blue-500" />
                                    </div>
                                    <div class="history-content">
                                        <span class="history-title">{{
                                            t("imageInfo.configCreated")
                                        }}</span>
                                        <span class="history-time">{{
                                            formatDateTime(photasa.config?.createdAt)
                                        }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </BaseSpinContainer>
    </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { BaseModal, BaseSpinContainer, BaseButton, BaseBadge } from "@renderer/components/ui";
import { JsonTreeView } from "json-tree-view-vue3";
import {
    PhImage,
    PhVideo,
    PhFile,
    PhInfo,
    PhGear,
    PhCode,
    PhImages,
    PhVideoCamera,
    PhFolder,
    PhClock,
    PhCheckCircle,
    PhFileText,
    PhCopy,
    PhFolderOpen,
    PhWrench,
} from "@phosphor-icons/vue";
import { useZhangSunWuJi } from "@renderer/composables/useZhangSunWuJi";
// ✅ RFC 0058: 使用服务而不是直接 API 调用
import { loggers } from "@common/logger";

// 定义组件属性
interface PhotasaInfo {
    path: string;
    status: string;
    lastModified: Date;
    config: {
        version?: string;
        createdAt?: Date;
        photoList?: any[];
        [key: string]: any;
    };
    maxDepth?: number;
}

interface EnhancedImageInfoModalProps {
    modelValue: boolean;
    photasa?: PhotasaInfo | null;
    loading?: boolean;
}

// 定义组件事件
const emit = defineEmits<{
    "update:modelValue": [value: boolean];
    "fix-config": [];
}>();

// 组件属性
const props = withDefaults(defineProps<EnhancedImageInfoModalProps>(), {
    loading: false,
});

// 计算属性用于v-model
const modelValue = computed({
    get: () => props.modelValue,
    set: (value: boolean) => emit("update:modelValue", value),
});

// 国际化
const { t } = useI18n();
const logger = loggers.renderer;
// ✅ RFC 0058: 使用长孙无忌服务
const zhangSunWuJi = useZhangSunWuJi();

// 响应式数据
const showRawConfig = ref(false);
const fixing = ref(false);

// 计算属性
const isImage = computed(() => {
    if (!props.photasa?.path) return false;
    const ext = props.photasa.path.toLowerCase().split(".").pop();
    return ["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif"].includes(ext || "");
});

const isVideo = computed(() => {
    if (!props.photasa?.path) return false;
    const ext = props.photasa.path.toLowerCase().split(".").pop();
    return ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv"].includes(ext || "");
});

// 工具函数
function getFileName(path: string | undefined): string {
    if (!path) return "";
    return path.split("/").pop() || path;
}

function getFileCount(): number {
    return props.photasa?.config?.photoList?.length || 0;
}

function getImageCount(): number {
    if (!props.photasa?.config?.photoList) return 0;
    return props.photasa.config.photoList.filter(
        (item: any) =>
            item.type === "image" ||
            ["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif"].includes(
                item.path?.toLowerCase().split(".").pop() || "",
            ),
    ).length;
}

function getVideoCount(): number {
    if (!props.photasa?.config?.photoList) return 0;
    return props.photasa.config.photoList.filter(
        (item: any) =>
            item.type === "video" ||
            ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv"].includes(
                item.path?.toLowerCase().split(".").pop() || "",
            ),
    ).length;
}

function getFolderCount(): number {
    // 这里可以根据实际需求计算扫描的文件夹数量
    return 1; // 简化实现
}

function formatFolderSize(): string {
    // 这里可以根据实际需求计算文件夹大小
    return "N/A"; // 简化实现
}

function getStatusType(status: string | undefined): "success" | "warning" | "error" | "info" {
    switch (status) {
        case "completed":
        case "success":
            return "success";
        case "warning":
        case "partial":
            return "warning";
        case "error":
        case "failed":
            return "error";
        default:
            return "info";
    }
}

function getStatusText(status: string | undefined): string {
    switch (status) {
        case "completed":
            return t("imageInfo.statusTypes.completed");
        case "success":
            return t("imageInfo.statusTypes.success");
        case "warning":
            return t("imageInfo.statusTypes.warning");
        case "partial":
            return t("imageInfo.statusTypes.partial");
        case "error":
            return t("imageInfo.statusTypes.error");
        case "failed":
            return t("imageInfo.statusTypes.failed");
        default:
            return t("imageInfo.statusTypes.unknown");
    }
}

function formatDateTime(date: Date | string | undefined): string {
    if (!date) return t("imageInfo.never");
    const d = new Date(date);
    return d.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

// 事件处理
function handleClose() {
    emit("update:modelValue", false);
}

async function handleOpenInFinder() {
    if (props.photasa?.path) {
        try {
            // ✅ RFC 0058: 服务层统一处理 file:// URL 转换，组件直接传递原始路径
            zhangSunWuJi.openInFinder(props.photasa.path);
        } catch (error) {
            logger.error("Failed to open in finder:", error);
        }
    }
}

async function handleFixConfig() {
    fixing.value = true;
    try {
        emit("fix-config");
        // 这里可以添加修复成功的提示
    } catch (error) {
        logger.error("Failed to fix config:", error);
    } finally {
        fixing.value = false;
    }
}

async function copyPath() {
    if (props.photasa?.path) {
        try {
            await navigator.clipboard.writeText(props.photasa.path);
            // 这里可以添加复制成功的提示
        } catch (error) {
            logger.error("Failed to copy path:", error);
        }
    }
}

async function copyConfig() {
    if (props.photasa?.config) {
        try {
            const configString =
                typeof props.photasa.config === "string"
                    ? props.photasa.config
                    : JSON.stringify(props.photasa.config, null, 2);
            await navigator.clipboard.writeText(configString);
            // 这里可以添加复制成功的提示
        } catch (error) {
            logger.error("Failed to copy config:", error);
        }
    }
}
</script>

<style scoped>
.enhanced-image-info {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.preview-section {
    margin-bottom: 8px;
}

.preview-card {
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: 0 2px 8px var(--color-card-shadow);
}

.preview-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-card-bg) 100%);
}

.file-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
    border: 2px solid var(--color-border);
}

.file-info {
    flex: 1;
    min-width: 0;
}

.file-name {
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 8px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-path {
    font-size: 14px;
    color: var(--color-text-secondary);
    font-family: monospace;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-stats {
    display: flex;
    gap: 24px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}

.stat-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.stat-value {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-primary);
}

.details-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.info-card {
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: all 0.2s ease;
}

.info-card:hover {
    box-shadow: 0 4px 12px var(--color-card-shadow);
    border-color: var(--color-primary);
}

.info-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
}

.info-card-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
    flex: 1;
}

.toggle-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.toggle-button:hover {
    background: var(--color-bg-hover);
    color: var(--color-text);
}

.toggle-button.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
}

.info-card-content {
    padding: 20px;
}

.info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.info-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.info-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.info-value {
    font-size: 14px;
    color: var(--color-text);
    word-break: break-all;
}

.path-value {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--color-bg-secondary);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
}

.path-value code {
    flex: 1;
    font-family: monospace;
    font-size: 13px;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.copy-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--color-bg-hover);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
}

.copy-button:hover {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
}

.config-summary {
    margin-top: 8px;
}

.config-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
}

.config-stat {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
}

.config-stat-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.config-stat-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text);
}

.raw-config {
    margin-top: 8px;
}

.raw-config-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border);
}

.raw-config-header span {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
}

.config-viewer {
    max-height: 300px;
    overflow: auto;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
}

.history-timeline {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.history-item {
    display: flex;
    align-items: center;
    gap: 12px;
}

.history-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-bg-secondary);
    border-radius: 50%;
    border: 2px solid var(--color-border);
}

.history-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.history-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
}

.history-time {
    font-size: 12px;
    color: var(--color-text-secondary);
}

/* 动画效果 */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes bounce {
    0%,
    20%,
    50%,
    80%,
    100% {
        transform: translateY(0);
    }
    40% {
        transform: translateY(-10px);
    }
    60% {
        transform: translateY(-5px);
    }
}

@keyframes counter {
    from {
        transform: scale(0.8);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

.fade-in-up {
    animation: fadeInUp 0.6s ease-out forwards;
    opacity: 0;
}

.delay-100 {
    animation-delay: 0.1s;
}

.delay-200 {
    animation-delay: 0.2s;
}

.delay-300 {
    animation-delay: 0.3s;
}

.icon-bounce {
    animation: bounce 1s ease-in-out;
}

.counter-animation {
    animation: counter 0.5s ease-out forwards;
    transform: scale(0.8);
    opacity: 0;
}

/* 卡片悬停效果 */
.info-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.info-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px var(--color-card-shadow);
}

/* 按钮悬停效果 */
.copy-button {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.copy-button:hover {
    transform: scale(1.1);
}

/* 状态徽章动画 */
.config-stat {
    transition: all 0.3s ease;
}

.config-stat:hover {
    transform: translateX(4px);
    background: var(--color-bg-hover);
}

/* 历史时间线动画 */
.history-item {
    transition: all 0.3s ease;
}

.history-item:hover {
    transform: translateX(8px);
}

.history-icon {
    transition: all 0.3s ease;
}

.history-item:hover .history-icon {
    transform: scale(1.1);
    box-shadow: 0 4px 12px var(--color-card-shadow);
}

@media (max-width: 768px) {
    .info-grid {
        grid-template-columns: 1fr;
    }

    .file-stats {
        flex-direction: column;
        gap: 16px;
    }

    .config-stats {
        grid-template-columns: 1fr;
    }

    .preview-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }

    .file-stats {
        align-self: stretch;
        justify-content: space-around;
    }
}
</style>
