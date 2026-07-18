/**
 * 虞世南（YuShiNan）- 扫描进度展示服务
 * RFC 0057: 负责扫描进度的 UI 实时展示
 *
 * 职责：
 * 1. 接收李世民的 update_scan_progress 圣旨
 * 2. 通过 photoStore 更新扫描进度
 * 3. 提供 getter 供 UI 访问（通过房玄龄）
 * 4. 记录扫描活动到监控系统
 *
 * 架构原则：
 * - ❌ 虞世南不持有响应式状态
 * - ✅ 虞世南更新 photoStore
 * - ✅ 虞世南提供 getter 通过房玄龄访问数据
 * - ✅ UI 通过 useYuShiNan() → 虞世南 → 房玄龄 → photoStore
 *
 * 历史背景：
 * 虞世南，唐朝秘书监，主持编纂《北堂书钞》
 * 在架构中负责实时记录和展示扫描状态
 */

import type {
    IYuShiNanService,
    ScanProgressShengzhiContent,
    StatusNotificationShengzhiContent,
    ScanMonitorConfig,
    ScanHealthStatus,
} from "@renderer/interfaces/yu-shinan.interface";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import { IService } from "@renderer/interfaces/service.interface";
import { scanMonitoringService } from "./scan-monitoring-service";
import { loggers, globalLogInterceptor } from "@photasa/common";

const logger = loggers.yushinan;

/**
 * 虞世南服务实现
 * RFC 0057: 负责扫描进度的 UI 实时展示
 *
 * 职责：
 * 1. 接收李世民的 update_scan_progress 圣旨
 * 2. 通过 photoStore 更新扫描进度
 * 3. 提供 getter 供 UI 访问（通过房玄龄）
 * 4. 记录扫描活动到监控系统
 *
 * 架构原则：
 * - ❌ 虞世南不持有响应式状态
 * - ✅ 虞世南更新 photoStore
 * - ✅ 虞世南提供 getter 供 UI 访问（通过房玄龄）
 * - ✅ UI 通过 useYuShiNan() → 虞世南 → 房玄龄 → photoStore
 *
 * 历史背景：
 * 虞世南，唐朝秘书监，主持编纂《北堂书钞》
 * 在架构中负责实时记录和展示扫描状态
 */
export class YuShiNanService implements IService, IYuShiNanService {
    /** 房玄龄宰相服务（用于访问 photoStore） */

    constructor(private readonly fangXuanLingService: IFangXuanLingService) {
        logger.info("📜 虞世南就任秘书监，准备记录扫描状态");
    }

    get name(): string {
        return "虞世南";
    }

    /**
     * ✅ 通过房玄龄访问当前扫描文件
     */
    get currentScanningFile(): string {
        if (!this.fangXuanLingService) {
            logger.warn("📜 虞世南：房玄龄服务未注入，返回空字符串");
            return "";
        }
        return this.fangXuanLingService.photos.processingFile;
    }

    /**
     * ✅ 通过房玄龄访问扫描进度
     */
    get scanProgress(): number {
        if (!this.fangXuanLingService) {
            logger.warn("📜 虞世南：房玄龄服务未注入，返回0");
            return 0;
        }
        return this.fangXuanLingService.photos.scanProgress;
    }

    /**
     * ✅ RFC 0057: 访问状态栏当前任务（通过房玄龄）
     */
    get currentTask(): string {
        return this.fangXuanLingService.statusBar.currentTask;
    }

    /**
     * ✅ RFC 0057: 访问状态栏状态（通过房玄龄）
     */
    get status(): string {
        return this.fangXuanLingService.statusBar.status;
    }

    /**
     * ✅ RFC 0057: 访问状态栏进度（通过房玄龄）
     */
    get progress(): number | undefined {
        return this.fangXuanLingService.statusBar.progress;
    }

    /**
     * ✅ RFC 0057: 访问状态栏错误信息（通过房玄龄）
     */
    get error(): string | undefined {
        return this.fangXuanLingService.statusBar.error;
    }

    /**
     * ✅ RFC 0057: 判断是否正在扫描
     * 从 StatusBar.vue 移入，统一由 yuShiNan 管理
     */
    get isScanning(): boolean {
        const file = this.currentScanningFile;
        if (!file) {
            return false;
        }
        // 如果有 processingFile，说明正在扫描
        return file.length > 0;
    }

    /**
     * ✅ RFC 0057: 获取扫描路径显示文本（带"扫描中"前缀）
     * 从 StatusBar.vue 移入，统一由 yuShiNan 管理
     * 注意：此方法返回纯路径，UI 层负责添加 i18n 前缀
     */
    get scanningPath(): string {
        return this.currentScanningFile;
    }

    setShengzhiPort(port: MessagePort): void {
        logger.info("📜 虞世南建立圣旨接收通道");

        port.onmessage = async (event: MessageEvent): Promise<void> => {
            const shengzhi: Shengzhi = event.data;
            logger.debug(`📜 虞世南奉旨: ${shengzhi.command} [圣旨ID: ${shengzhi.id}]`);

            await this.processShengzhi(shengzhi);
        };
    }

    /**
     * 处理圣旨（核心状态机）
     */
    async processShengzhi(shengzhi: Shengzhi): Promise<void> {
        try {
            switch (shengzhi.command) {
                case "update_scan_progress":
                    await this.handleUpdateScanProgress(shengzhi);
                    break;
                case "update_status_notification":
                    await this.handleUpdateStatusNotification(shengzhi);
                    break;
                default:
                    logger.warn(`📜 虞世南：未知圣旨命令 ${shengzhi.command}`);
            }
        } catch (error) {
            logger.error(`📜 虞世南：处理圣旨失败`, error);
        }
    }

    /**
     * 处理扫描进度更新圣旨
     */
    private async handleUpdateScanProgress(shengzhi: Shengzhi): Promise<void> {
        const content = shengzhi.content as ScanProgressShengzhiContent;

        logger.debug(
            `📜 虞世南：更新扫描进度 - 文件: ${content.filePath}, 进度: ${content.progress}, 类型: ${content.type}`,
        );

        // ✅ 通过房玄龄访问 photoStore
        const photosStore = this.fangXuanLingService.photos;

        // ✅ 根据类型处理：progress 更新进度，complete 清空进度
        if (content.type === "complete") {
            // ✅ 扫描完成，清空扫描进度
            photosStore.clearScanProgress();
            logger.info(`📜 虞世南：扫描完成，已清空扫描状态`);
        } else {
            // ✅ 扫描进行中，更新扫描进度
            photosStore.updateScanProgress(content.filePath, content.progress);
            logger.info(`📜 虞世南：已记录扫描状态 - ${content.filePath}`);
        }

        // ✅ 记录扫描活动到监控系统
        scanMonitoringService.recordActivity();
    }

    /**
     * ✅ RFC 0057: 处理状态通知更新圣旨
     * 更新 statusBarStore，管理状态栏显示（通过房玄龄）
     */
    private async handleUpdateStatusNotification(shengzhi: Shengzhi): Promise<void> {
        const content = shengzhi.content as unknown as StatusNotificationShengzhiContent;

        logger.debug(
            `📜 虞世南：更新状态通知 - 类型: ${content.type}, 状态: ${content.status}, 任务: ${content.task}`,
        );

        // ✅ 通过房玄龄访问 statusBarStore
        const statusBar = this.fangXuanLingService.statusBar;

        // ✅ 更新状态栏 Store
        statusBar.update({
            type: content.type,
            task: content.task,
            status: content.status,
            error: content.error,
            timestamp: content.timestamp,
            data: content.data,
        });

        logger.info(`📜 虞世南：已更新状态栏 - ${content.type}/${content.status}`);
    }

    /**
     * ✅ RFC 0057: 更新状态栏（供 Vue 组件调用）
     * Vue 组件通过此方法更新状态栏，而不是直接访问房玄龄
     */
    updateStatus(payload: {
        type: string;
        task: string;
        status: string;
        error?: string;
        timestamp: number;
        data?: unknown;
    }): void {
        // ✅ 通过房玄龄访问 statusBarStore
        const statusBar = this.fangXuanLingService.statusBar;

        // ✅ 更新状态栏 Store
        statusBar.update(payload);

        logger.debug(`📜 虞世南：已更新状态栏 - ${payload.type}/${payload.status}`);
    }

    /**
     * ✅ 初始化日志拦截器
     * 激活 renderer 日志拦截器，将日志直接发送到 log viewer
     */
    initializeLogInterceptor(): void {
        logger.info("📜 虞世南：初始化日志拦截器");
        globalLogInterceptor.activate();
        logger.info("📜 虞世南：日志拦截器已激活");
    }

    /**
     * ✅ 获取扫描监控状态
     * 通过 yuShiNan 访问 scanMonitoringService，而不是直接导入
     */
    getMonitoringStatus(): {
        isMonitoring: boolean;
        config: ScanMonitorConfig;
        healthStatus: ScanHealthStatus;
    } {
        return scanMonitoringService.getMonitoringStatus();
    }

    /**
     * ✅ 获取扫描健康状态（响应式）
     * 通过 yuShiNan 访问 scanMonitoringService.healthStatus
     */
    get healthStatus(): ScanHealthStatus {
        return scanMonitoringService.healthStatus.value;
    }

    /**
     * ✅ 更新扫描监控配置
     * 通过 yuShiNan 访问 scanMonitoringService.updateConfig
     */
    updateMonitoringConfig(config: Partial<ScanMonitorConfig>): void {
        scanMonitoringService.updateConfig(config);
    }

    /**
     * ✅ 立即检查健康状态
     * 通过 yuShiNan 访问 scanMonitoringService.checkHealthNow
     */
    checkHealthNow(): ScanHealthStatus {
        return scanMonitoringService.checkHealthNow();
    }

    /**
     * ✅ 重置监控状态
     * 通过 yuShiNan 访问 scanMonitoringService.reset
     */
    resetMonitoring(): void {
        scanMonitoringService.reset();
    }
}
