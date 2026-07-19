/**
 * 虞世南服务 Composable
 * RFC 0057: 提供扫描进度和状态栏的响应式状态
 *
 * 架构原则：
 * - UI 通过 useYuShiNan() → 虞世南 → Store
 * - 虞世南管理 photoStore（扫描进度）和 statusBarStore（状态栏）
 */

import { computed, inject } from "vue";
import {
    IYuShiNanService,
    YU_SHINAN_TOKEN,
    type ScanMonitorConfig,
} from "@renderer/interfaces/yu-shinan.interface";

/**
 * 虞世南服务 Composable
 * 提供扫描进度和状态栏数据的访问
 */
export function useYuShiNan() {
    const yuShiNanService = inject<IYuShiNanService>(YU_SHINAN_TOKEN);

    if (!yuShiNanService) {
        return {
            currentScanningFile: computed(() => ""),
            scanProgress: computed(() => 0),
            currentTask: computed(() => ""),
            status: computed(() => ""),
            progress: computed(() => undefined),
            error: computed(() => undefined),
            isScanning: computed(() => false),
            scanningPath: computed(() => ""),
            updateStatus: () => {
                // No-op if service is not available
            },
            getMonitoringStatus: () => ({
                isMonitoring: false,
                config: {
                    healthCheckInterval: 5 * 60 * 1000,
                    staleTimeout: 30 * 60 * 1000,
                    idleTimeout: 5 * 60 * 1000,
                    maxRetries: 3,
                    enableAutoRecovery: true,
                },
                healthStatus: {
                    isHealthy: true,
                    queueLength: 0,
                    isIdle: true,
                    lastActivityTime: Date.now(),
                    idleDuration: 0,
                    isStale: false,
                    consecutiveFailures: 0,
                    message: "",
                },
            }),
            healthStatus: computed(() => ({
                isHealthy: true,
                queueLength: 0,
                isIdle: true,
                lastActivityTime: Date.now(),
                idleDuration: 0,
                isStale: false,
                consecutiveFailures: 0,
                message: "",
            })),
            updateMonitoringConfig: () => {
                // No-op if service is not available
            },
            checkHealthNow: () => ({
                isHealthy: true,
                queueLength: 0,
                isIdle: true,
                lastActivityTime: Date.now(),
                idleDuration: 0,
                isStale: false,
                consecutiveFailures: 0,
                message: "",
            }),
            resetMonitoring: () => {
                // No-op if service is not available
            },
        };
    }

    return {
        /** 当前正在扫描的文件路径 */
        currentScanningFile: computed(() => yuShiNanService.currentScanningFile),

        /** 当前扫描进度 */
        scanProgress: computed(() => yuShiNanService.scanProgress),

        /** ✅ RFC 0057: 状态栏当前任务 */
        currentTask: computed(() => yuShiNanService.currentTask),

        /** ✅ RFC 0057: 状态栏状态 */
        status: computed(() => yuShiNanService.status),

        /** ✅ RFC 0057: 状态栏进度 */
        progress: computed(() => yuShiNanService.progress),

        /** ✅ RFC 0057: 状态栏错误信息 */
        error: computed(() => yuShiNanService.error),

        /** ✅ RFC 0057: 判断是否正在扫描（从扫描队列派生） */
        isScanning: computed(() => yuShiNanService.isScanning),

        /** ✅ RFC 0057: 获取扫描路径（从扫描队列派生） */
        scanningPath: computed(() => yuShiNanService.scanningPath),

        /** ✅ RFC 0057: 更新状态栏（供 Vue 组件调用） */
        updateStatus: (payload: {
            type: string;
            task: string;
            status: string;
            error?: string;
            timestamp: number;
            data?: unknown;
        }) => {
            yuShiNanService.updateStatus(payload);
        },

        /** ✅ 获取扫描监控状态 */
        getMonitoringStatus: () => {
            return yuShiNanService.getMonitoringStatus();
        },

        /** ✅ 获取扫描健康状态（响应式） */
        healthStatus: computed(() => yuShiNanService.healthStatus),

        /** ✅ 更新扫描监控配置 */
        updateMonitoringConfig: (config: Partial<ScanMonitorConfig>) => {
            yuShiNanService.updateMonitoringConfig(config);
        },

        /** ✅ 立即检查健康状态 */
        checkHealthNow: () => {
            return yuShiNanService.checkHealthNow();
        },

        /** ✅ 重置监控状态 */
        resetMonitoring: () => {
            yuShiNanService.resetMonitoring();
        },
    };
}
