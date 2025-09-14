<template>
    <div class="scan-monitoring-settings settings-container">
        <div class="setting-group">
            <h3>{{ t("preference.scanMonitoring.title") }}</h3>
            <p class="setting-description">{{ t("preference.scanMonitoring.description") }}</p>

            <!-- 启用自动恢复 -->
            <div class="setting-item">
                <div class="setting-row">
                    <label class="setting-label">
                        <BaseCheckbox
                            v-model="localConfig.enableAutoRecovery"
                            @change="updateConfig"
                        />
                        {{ t("preference.scanMonitoring.enableAutoRecovery") }}
                    </label>
                </div>
                <p class="setting-help">
                    {{ t("preference.scanMonitoring.enableAutoRecoveryHelp") }}
                </p>
            </div>

            <!-- 健康检查间隔 -->
            <div class="setting-item">
                <div class="setting-row">
                    <label class="setting-label">{{
                        t("preference.scanMonitoring.healthCheckInterval")
                    }}</label>
                    <BaseSelect
                        v-model="localConfig.healthCheckInterval"
                        :options="healthCheckIntervalOptions"
                        @update:modelValue="updateConfig"
                    />
                </div>
                <p class="setting-help">
                    {{ t("preference.scanMonitoring.healthCheckIntervalHelp") }}
                </p>
            </div>

            <!-- 空闲超时时间 -->
            <div class="setting-item">
                <div class="setting-row">
                    <label class="setting-label">{{
                        t("preference.scanMonitoring.idleTimeout")
                    }}</label>
                    <BaseSelect
                        v-model="localConfig.idleTimeout"
                        :options="idleTimeoutOptions"
                        @update:modelValue="updateConfig"
                    />
                </div>
                <p class="setting-help">{{ t("preference.scanMonitoring.idleTimeoutHelp") }}</p>
            </div>

            <!-- 停滞超时时间 -->
            <div class="setting-item">
                <div class="setting-row">
                    <label class="setting-label">{{
                        t("preference.scanMonitoring.staleTimeout")
                    }}</label>
                    <BaseSelect
                        v-model="localConfig.staleTimeout"
                        :options="staleTimeoutOptions"
                        @update:modelValue="updateConfig"
                    />
                </div>
                <p class="setting-help">{{ t("preference.scanMonitoring.staleTimeoutHelp") }}</p>
            </div>

            <!-- 最大重试次数 -->
            <div class="setting-item">
                <div class="setting-row">
                    <label class="setting-label">{{
                        t("preference.scanMonitoring.maxRetries")
                    }}</label>
                    <BaseSelect
                        v-model="localConfig.maxRetries"
                        :options="maxRetriesOptions"
                        @update:modelValue="updateConfig"
                    />
                </div>
                <p class="setting-help">{{ t("preference.scanMonitoring.maxRetriesHelp") }}</p>
            </div>
        </div>

        <!-- 监控状态显示 -->
        <div class="setting-group">
            <h3>{{ t("preference.scanMonitoring.currentStatus") }}</h3>
            <div class="status-display">
                <div class="status-item">
                    <span class="status-label"
                        >{{ t("preference.scanMonitoring.isMonitoring") }}:</span
                    >
                    <span
                        :class="[
                            'status-value',
                            monitoringStatus.isMonitoring ? 'active' : 'inactive',
                        ]"
                    >
                        {{ monitoringStatus.isMonitoring ? t("common.yes") : t("common.no") }}
                    </span>
                </div>
                <div class="status-item">
                    <span class="status-label"
                        >{{ t("preference.scanMonitoring.healthStatus") }}:</span
                    >
                    <span
                        :class="['status-value', healthStatus.isHealthy ? 'healthy' : 'unhealthy']"
                    >
                        {{ healthStatus.isHealthy ? t("common.healthy") : t("common.unhealthy") }}
                    </span>
                </div>
                <div class="status-item">
                    <span class="status-label"
                        >{{ t("preference.scanMonitoring.queueLength") }}:</span
                    >
                    <span class="status-value">{{ healthStatus.queueLength }}</span>
                </div>
                <div class="status-item">
                    <span class="status-label"
                        >{{ t("preference.scanMonitoring.scanStatus") }}:</span
                    >
                    <span class="status-value">
                        {{ healthStatus.isIdle ? t("common.idle") : t("common.running") }}
                    </span>
                </div>
                <div class="status-item">
                    <span class="status-label"
                        >{{ t("preference.scanMonitoring.consecutiveFailures") }}:</span
                    >
                    <span class="status-value">{{ healthStatus.consecutiveFailures }}</span>
                </div>
                <div class="status-message">
                    <strong>{{ t("preference.scanMonitoring.statusMessage") }}:</strong>
                    <span>{{ healthStatus.message }}</span>
                </div>
            </div>

            <!-- 操作按钮 -->
            <div class="action-buttons">
                <button class="btn btn-primary" @click="checkHealthNow">
                    {{ t("preference.scanMonitoring.checkNow") }}
                </button>
                <button class="btn btn-secondary" @click="resetMonitoring">
                    {{ t("preference.scanMonitoring.reset") }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
    scanMonitoringService,
    type ScanMonitorConfig,
} from "@renderer/services/scan-monitoring-service";
import { BaseSelect, BaseCheckbox } from "@renderer/components/ui";
import { notification } from "@renderer/services/notification-manager";

const { t } = useI18n();

// 本地配置副本
const localConfig = reactive<ScanMonitorConfig>({
    healthCheckInterval: 5 * 60 * 1000,
    staleTimeout: 30 * 60 * 1000,
    idleTimeout: 5 * 60 * 1000,
    maxRetries: 3,
    enableAutoRecovery: true,
});

// 监控状态
const monitoringStatus = computed(() => scanMonitoringService.getMonitoringStatus());
const healthStatus = computed(() => scanMonitoringService.healthStatus.value);

// 下拉选项配置
const healthCheckIntervalOptions = computed(() => [
    { value: 1 * 60 * 1000, label: `1 ${t("common.minute")}` },
    { value: 2 * 60 * 1000, label: `2 ${t("common.minutes")}` },
    { value: 5 * 60 * 1000, label: `5 ${t("common.minutes")}` },
    { value: 10 * 60 * 1000, label: `10 ${t("common.minutes")}` },
    { value: 15 * 60 * 1000, label: `15 ${t("common.minutes")}` },
    { value: 30 * 60 * 1000, label: `30 ${t("common.minutes")}` },
]);

const idleTimeoutOptions = computed(() => [
    { value: 1 * 60 * 1000, label: `1 ${t("common.minute")}` },
    { value: 2 * 60 * 1000, label: `2 ${t("common.minutes")}` },
    { value: 5 * 60 * 1000, label: `5 ${t("common.minutes")}` },
    { value: 10 * 60 * 1000, label: `10 ${t("common.minutes")}` },
    { value: 15 * 60 * 1000, label: `15 ${t("common.minutes")}` },
]);

const staleTimeoutOptions = computed(() => [
    { value: 10 * 60 * 1000, label: `10 ${t("common.minutes")}` },
    { value: 15 * 60 * 1000, label: `15 ${t("common.minutes")}` },
    { value: 30 * 60 * 1000, label: `30 ${t("common.minutes")}` },
    { value: 45 * 60 * 1000, label: `45 ${t("common.minutes")}` },
    { value: 60 * 60 * 1000, label: `1 ${t("common.hour")}` },
]);

const maxRetriesOptions = [
    { value: 1, label: "1" },
    { value: 2, label: "2" },
    { value: 3, label: "3" },
    { value: 5, label: "5" },
    { value: 10, label: "10" },
];

// 初始化配置
const initConfig = () => {
    const currentStatus = scanMonitoringService.getMonitoringStatus();
    Object.assign(localConfig, currentStatus.config);
};

// 更新配置
const updateConfig = async () => {
    try {
        scanMonitoringService.updateConfig(localConfig);
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
};

// 立即检查健康状态
const checkHealthNow = () => {
    scanMonitoringService.checkHealthNow();
};

// 重置监控状态
const resetMonitoring = () => {
    scanMonitoringService.reset();
};

// 组件挂载时初始化
initConfig();
</script>

<style lang="scss" scoped>
.scan-monitoring-settings {
    padding: 0;
    max-width: 100%;

    .setting-group {
        margin-bottom: 16px;
        padding: 16px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-card-bg);

        h3 {
            margin: 0 0 8px 0;
            color: var(--color-text);
            font-size: 15px;
            font-weight: 600;
        }

        .setting-description {
            margin: 0 0 12px 0;
            color: var(--color-text-secondary);
            font-size: 13px;
            line-height: 1.4;
        }
    }

    .setting-item {
        margin-bottom: 12px;

        .setting-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 4px;
        }

        .setting-label {
            flex: 0 0 auto;
            min-width: 180px;
            color: var(--color-text);
            font-size: 13px;
            font-weight: 500;
            display: flex;
            align-items: center;
        }

        .setting-help {
            margin: 3px 0 0 0;
            color: var(--color-text-secondary);
            font-size: 11px;
            line-height: 1.3;
        }
    }

    .status-display {
        .status-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid var(--color-border);

            .status-label {
                color: var(--color-text-secondary);
                font-size: 13px;
            }

            .status-value {
                color: var(--color-text);
                font-size: 13px;
                font-weight: 500;

                &.active,
                &.healthy {
                    color: var(--color-success);
                }

                &.inactive,
                &.unhealthy {
                    color: var(--color-danger);
                }
            }
        }

        .status-message {
            margin-top: 8px;
            padding: 8px;
            background: var(--color-bg-secondary);
            border-radius: 4px;
            font-size: 12px;
            line-height: 1.4;

            strong {
                color: var(--color-text);
                font-size: 12px;
            }

            span {
                color: var(--color-text-secondary);
            }
        }
    }

    .action-buttons {
        margin-top: 8px;
        display: flex;
        gap: 8px;

        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;

            &.btn-primary {
                background: var(--color-primary);
                color: white;

                &:hover {
                    background: var(--color-primary-dark);
                }
            }

            &.btn-secondary {
                background: var(--color-card-bg);
                color: var(--color-text);
                border: 1px solid var(--color-border);

                &:hover {
                    background: var(--color-card-hover);
                }
            }
        }
    }
}
</style>
