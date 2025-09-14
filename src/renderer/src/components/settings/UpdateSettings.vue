<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { usePreferenceStore } from "@renderer/stores/preference";
import {
    PhCircleNotch as LoadingIcon,
    PhCheckCircle as SuccessIcon,
    PhXCircle as ErrorIcon,
    PhInfo as InfoIcon,
} from "@phosphor-icons/vue";
import { BaseButton, BaseSwitch } from "@renderer/components/ui";
import { notification } from "@renderer/services/notification-manager";

defineOptions({
    name: "UpdateSettings",
});

const { t } = useI18n();

// 获取更新状态和配置的响应式数据
const updateStatus = ref<string>("idle"); // idle | checking | downloading | downloaded | error
const updateProgress = ref<number>(0);
const updateError = ref<string>("");
const currentVersion = ref<string>("1.5.0"); // 从主进程获取
const latestVersion = ref<string>("");
const updateInfo = ref<any>(null);

const preferenceStore = usePreferenceStore();
const { autoUpdate } = storeToRefs(preferenceStore);

// 计算属性用于标签
const label = computed(() => {
    return {
        autoUpdate: t("preference.autoUpdate.title"),
        autoUpdateDesc: t("preference.autoUpdate.description"),
        enabled: t("preference.autoUpdate.enabled"),
        checkInterval: t("preference.autoUpdate.checkInterval"),
        prerelease: t("preference.autoUpdate.prerelease"),
        prereleaseDesc: t("preference.autoUpdate.prereleaseDescription"),
        autoInstall: t("preference.autoUpdate.autoInstall"),
        autoInstallDesc: t("preference.autoUpdate.autoInstallDescription"),
        checkNow: t("preference.autoUpdate.checkNow"),
        downloadUpdate: t("preference.autoUpdate.downloadUpdate"),
        installUpdate: t("preference.autoUpdate.installUpdate"),
        currentVersion: t("preference.autoUpdate.currentVersion"),
        latestVersion: t("preference.autoUpdate.latestVersion"),
        lastCheck: t("preference.autoUpdate.lastCheck"),
    };
});

// 状态图标计算
const statusIcon = computed(() => {
    switch (updateStatus.value) {
        case "checking":
        case "downloading":
            return LoadingIcon;
        case "downloaded":
            return SuccessIcon;
        case "error":
            return ErrorIcon;
        default:
            return InfoIcon;
    }
});

// 状态文本计算
const statusText = computed(() => {
    switch (updateStatus.value) {
        case "checking":
            return t("preference.autoUpdate.status.checking");
        case "downloading":
            return t("preference.autoUpdate.status.downloading", {
                progress: updateProgress.value,
            });
        case "downloaded":
            return t("preference.autoUpdate.status.downloaded");
        case "error":
            return t("preference.autoUpdate.status.error");
        case "upToDate":
            return t("preference.autoUpdate.status.upToDate");
        default:
            return t("preference.autoUpdate.status.idle");
    }
});

// 检查间隔选项
const intervalOptions = [
    { value: 1, label: t("preference.autoUpdate.intervals.hourly") },
    { value: 6, label: t("preference.autoUpdate.intervals.sixHours") },
    { value: 24, label: t("preference.autoUpdate.intervals.daily") },
    { value: 168, label: t("preference.autoUpdate.intervals.weekly") },
];

// 处理配置更新
async function updateConfig<K extends keyof typeof autoUpdate.value>(
    key: K,
    value: (typeof autoUpdate.value)[K],
): Promise<void> {
    try {
        await window.api?.updateAutoUpdateConfig?.({ [key]: value });
        preferenceStore.updateAutoUpdateConfig({ [key]: value });
        notification.success({
            title: t("notification.configUpdated.title"),
            message: t("notification.configUpdated.message"),
        });
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : t("notification.unknownError");
        notification.error({
            title: t("notification.configUpdateError.title"),
            message: errorMessage,
        });
    }
}

// 手动检查更新
async function checkForUpdates(): Promise<void> {
    if (updateStatus.value === "checking") return;

    updateStatus.value = "checking";
    updateError.value = "";

    try {
        const result = await window.api?.checkForUpdates?.();
        if (result?.hasUpdate) {
            updateStatus.value = "idle";
            latestVersion.value = result.version;
            updateInfo.value = result.info;
            notification.info({
                title: t("notification.updateAvailable.title"),
                message: t("notification.updateAvailable.message", { version: result.version }),
            });
        } else {
            updateStatus.value = "upToDate";
            notification.success({
                title: t("notification.upToDate.title"),
                message: t("notification.upToDate.message"),
            });
        }
    } catch (error: unknown) {
        updateStatus.value = "error";
        const errorMessage =
            error instanceof Error ? error.message : t("notification.unknownError");
        updateError.value = errorMessage;
        notification.error({
            title: t("notification.updateCheckError.title"),
            message: errorMessage,
        });
    }
}

// 下载更新
async function downloadUpdate(): Promise<void> {
    if (!updateInfo.value) return;

    updateStatus.value = "downloading";
    updateProgress.value = 0;

    try {
        await window.api?.downloadUpdate?.();
        // 进度监听通过 IPC 事件处理
    } catch (error: unknown) {
        updateStatus.value = "error";
        const errorMessage =
            error instanceof Error ? error.message : t("notification.unknownError");
        updateError.value = errorMessage;
        notification.error({
            title: t("notification.downloadError.title"),
            message: errorMessage,
        });
    }
}

// 安装更新
async function installUpdate(): Promise<void> {
    if (updateStatus.value !== "downloaded") return;

    try {
        await window.api?.installUpdate?.();
        notification.info({
            title: t("notification.installing.title"),
            message: t("notification.installing.message"),
        });
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : t("notification.unknownError");
        notification.error({
            title: t("notification.installError.title"),
            message: errorMessage,
        });
    }
}

// 组件挂载时获取初始状态
onMounted(async () => {
    try {
        // 获取当前版本
        const version = await window.api?.getAppVersion?.();
        if (version) currentVersion.value = version;

        // 获取更新状态
        const status = await window.api?.getUpdateStatus?.();
        if (status) {
            updateStatus.value = status.status;
            updateProgress.value = status.progress || 0;
            if (status.error) updateError.value = status.error;
            if (status.version) latestVersion.value = status.version;
        }

        // 监听更新事件
        if (window.api?.onUpdateProgress) {
            window.api.onUpdateProgress((progress: number) => {
                updateProgress.value = progress;
            });
        }

        if (window.api?.onUpdateDownloaded) {
            window.api.onUpdateDownloaded(() => {
                updateStatus.value = "downloaded";
                notification.success({
                    title: t("notification.downloadComplete.title"),
                    message: t("notification.downloadComplete.message"),
                });
            });
        }

        if (window.api?.onUpdateError) {
            window.api.onUpdateError((error: string) => {
                updateStatus.value = "error";
                updateError.value = error;
                notification.error({
                    title: t("notification.updateError.title"),
                    message: error,
                });
            });
        }
    } catch (error) {
        console.warn("Failed to initialize update settings:", error);
    }
});
</script>

<template>
    <div class="update-settings">
        <!-- 标题区域 -->
        <div class="settings-header">
            <div class="header-title">{{ label.autoUpdate }}</div>
            <div class="header-desc">{{ label.autoUpdateDesc }}</div>
        </div>

        <!-- 主开关 -->
        <div class="settings-section">
            <div class="setting-item">
                <div class="setting-label">
                    <span>{{ label.enabled }}</span>
                    <span class="setting-desc">开启后应用将自动检查并安装更新</span>
                </div>
                <BaseSwitch
                    :modelValue="autoUpdate.enabled"
                    @update:modelValue="(value) => updateConfig('enabled', value)"
                />
            </div>
        </div>

        <!-- 配置设置 -->
        <transition name="fade">
            <div v-if="autoUpdate.enabled" class="settings-section">
                <h4 class="section-title">更新配置</h4>

                <div class="setting-item">
                    <span class="setting-label">{{ label.checkInterval }}</span>
                    <select
                        class="setting-select"
                        :value="autoUpdate.checkInterval"
                        @change="
                            (e) =>
                                updateConfig(
                                    'checkInterval',
                                    Number((e.target as HTMLSelectElement).value),
                                )
                        "
                    >
                        <option
                            v-for="option in intervalOptions"
                            :key="option.value"
                            :value="option.value"
                        >
                            {{ option.label }}
                        </option>
                    </select>
                </div>

                <div class="setting-item">
                    <div class="setting-label">
                        <span>{{ label.prerelease }}</span>
                        <span class="setting-desc">{{ label.prereleaseDesc }}</span>
                    </div>
                    <BaseSwitch
                        :modelValue="autoUpdate.allowPrerelease"
                        @update:modelValue="(value) => updateConfig('allowPrerelease', value)"
                    />
                </div>

                <div class="setting-item">
                    <div class="setting-label">
                        <span>{{ label.autoInstall }}</span>
                        <span class="setting-desc">{{ label.autoInstallDesc }}</span>
                    </div>
                    <BaseSwitch
                        :modelValue="autoUpdate.autoInstall"
                        @update:modelValue="(value) => updateConfig('autoInstall', value)"
                    />
                </div>
            </div>
        </transition>

        <!-- 版本信息 -->
        <div class="settings-section">
            <h4 class="section-title">版本信息</h4>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">{{ label.currentVersion }}</span>
                    <span class="info-value current">v{{ currentVersion }}</span>
                </div>
                <div class="info-item" v-if="latestVersion">
                    <span class="info-label">{{ label.latestVersion }}</span>
                    <span class="info-value latest">v{{ latestVersion }}</span>
                </div>
                <div class="info-item" v-if="autoUpdate.lastCheck">
                    <span class="info-label">{{ label.lastCheck }}</span>
                    <span class="info-value">{{
                        new Date(autoUpdate.lastCheck).toLocaleString()
                    }}</span>
                </div>
            </div>
        </div>

        <!-- 状态显示 -->
        <div class="settings-section" v-if="updateStatus !== 'idle'">
            <div class="status-container">
                <component
                    :is="statusIcon"
                    class="status-icon"
                    :class="{
                        loading: updateStatus === 'checking' || updateStatus === 'downloading',
                        success: updateStatus === 'downloaded' || updateStatus === 'upToDate',
                        error: updateStatus === 'error',
                    }"
                />
                <span class="status-text">{{ statusText }}</span>
            </div>

            <div v-if="updateStatus === 'downloading'" class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: `${updateProgress}%` }"></div>
                </div>
                <span class="progress-text">{{ updateProgress }}%</span>
            </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-section">
            <BaseButton
                @click="checkForUpdates"
                :loading="updateStatus === 'checking'"
                :disabled="updateStatus === 'checking'"
                class="action-button"
            >
                {{ label.checkNow }}
            </BaseButton>

            <BaseButton
                v-if="updateInfo && updateStatus !== 'downloaded'"
                type="primary"
                @click="downloadUpdate"
                :loading="updateStatus === 'downloading'"
                :disabled="updateStatus === 'downloading'"
                class="action-button primary"
            >
                {{ label.downloadUpdate }}
            </BaseButton>

            <BaseButton
                v-if="updateStatus === 'downloaded'"
                type="primary"
                @click="installUpdate"
                class="action-button primary"
            >
                {{ label.installUpdate }}
            </BaseButton>
        </div>
    </div>
</template>

<style scoped lang="scss">
.update-settings {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 0;
    max-height: 100%;
    overflow-y: auto;
}

// 标题区域
.settings-header {
    text-align: left;
    padding-bottom: 12px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
}

.header-title {
    font-size: 16px;
    font-weight: 500;
    color: var(--color-text, #fff);
    margin-bottom: 4px;
}

.header-desc {
    font-size: 12px;
    color: var(--color-text-secondary, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
}

// 设置区块
.settings-section {
    background: var(--color-bg-secondary, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 16px;
}

.section-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #fff);
    margin: 0 0 12px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
}

// 设置项
.setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;

    &:not(:last-child) {
        border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.05));
    }
}

.setting-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;

    > span:first-child {
        font-size: 14px;
        color: var(--color-text, #fff);
    }
}

.setting-desc {
    font-size: 12px;
    color: var(--color-text-secondary, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
}

.setting-select {
    min-width: 120px;
    padding: 6px 12px;
    background: var(--color-bg, rgba(0, 0, 0, 0.2));
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    color: var(--color-text, #fff);
    font-size: 13px;
    outline: none;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        border-color: var(--color-primary, #1890ff);
        background: var(--color-bg, rgba(0, 0, 0, 0.3));
    }

    &:focus {
        border-color: var(--color-primary, #1890ff);
        box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }

    option {
        background: var(--color-bg, #1a1a1a);
        color: var(--color-text, #fff);
    }
}

// 版本信息
.info-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
}

.info-label {
    font-size: 13px;
    color: var(--color-text-secondary, rgba(255, 255, 255, 0.65));
}

.info-value {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text, #fff);

    &.current {
        color: var(--color-success, #52c41a);
    }

    &.latest {
        color: var(--color-primary, #1890ff);
    }
}

// 状态显示
.status-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--color-bg, rgba(0, 0, 0, 0.2));
    border-radius: 6px;
}

.status-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;

    &.loading {
        color: var(--color-primary, #1890ff);
        animation: spin 1s linear infinite;
    }

    &.success {
        color: var(--color-success, #52c41a);
    }

    &.error {
        color: var(--color-error, #ff4d4f);
    }
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

.status-text {
    font-size: 13px;
    color: var(--color-text, #fff);
}

// 进度条
.progress-container {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
}

.progress-bar {
    flex: 1;
    height: 4px;
    background: var(--color-bg, rgba(255, 255, 255, 0.1));
    border-radius: 2px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: var(--color-primary, #1890ff);
    transition: width 0.3s ease;
}

.progress-text {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-primary, #1890ff);
    min-width: 35px;
}

// 操作按钮
.action-section {
    display: flex;
    gap: 12px;
    margin-top: auto;
    padding-top: 16px;
}

.action-button {
    flex: 1;
    height: 36px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;

    &:not(.primary) {
        background: var(--color-bg-secondary, rgba(255, 255, 255, 0.1));
        border: 1px solid var(--color-border, rgba(255, 255, 255, 0.2));
        color: var(--color-text, #fff);

        &:hover:not(:disabled) {
            background: var(--color-bg-secondary, rgba(255, 255, 255, 0.15));
            border-color: var(--color-primary, #1890ff);
        }
    }

    &.primary {
        background: var(--color-primary, #1890ff);
        border: none;
        color: white;

        &:hover:not(:disabled) {
            background: #40a9ff;
        }
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}

// 动画
.fade-enter-active,
.fade-leave-active {
    transition: all 0.3s ease;
}

.fade-enter-from {
    opacity: 0;
    transform: translateY(-8px);
}

.fade-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
</style>
