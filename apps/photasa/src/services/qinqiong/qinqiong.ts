import { IService } from "@/interfaces/service.interface";
import { IQinQiongService } from "@renderer/interfaces/qin-qiong.interface";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type { Emitter } from "mitt";
import { loggers, type PhotasaConfig } from "@photasa/common";
import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import {
    GUANYUAN_NAMES,
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
} from "@renderer/interfaces/fang-xuan-ling.interface";

const logger = loggers.qinqiong;

/**
 * 秦琼（QinQiong）- 文件系统事件守护者
 * RFC 0042 Step 2.5: 文件系统事件监听和路由
 *
 * 职责：
 * 1. 通过qizou启奏向李世民汇报处理结果
 *
 * **架构原则**（RFC 0042 Step 2.5）：
 * - ✅ 不维护本地状态 - 文件系统事件即时路由
 * - ✅ 委托魏征处理folderTree更新
 * - ✅ 使用启奏-圣旨架构进行通信
 *
 * **协调链路**：
 * 袁天罡扫描完成 → 启奏李世民 → 李世民下旨秦琼 →
 * 秦琼协调魏征更新树 → 魏征发奏折给房玄龄 →
 * 房玄龄 → 袁天罡 → 天枢工作流 → 司命引擎持久化
 *
 * 历史背景：
 * 秦琼，唐朝开国名将，以守门神身份著称
 * 在架构中负责守护文件系统边界，监听和路由文件系统事件
 *
 * @class QinQiongService
 * @implements {IService}
 * @since RFC 0042 Step 2.5
 * @date 2025-10-30
 */
export class QinQiongService implements IService, IQinQiongService {
    /**
     * 启奏事件总线
     * 用于向李世民发送qizou启奏
     */
    private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;
    private watchLifecycle: Promise<void> = Promise.resolve();

    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("🛡️ 秦琼就任，守护文件系统边界");
    }

    /**
     * IService接口实现 - 服务名称标识
     */
    get name(): string {
        return "秦琼";
    }

    async startWatching(paths: string[], thumbnailSize: number): Promise<void> {
        return this.enqueueWatchLifecycle(() =>
            this.submitWatchMatter(ZOUZHE_MATTERS.START_FILE_WATCH, {
                paths,
                recursive: true,
                thumbnailSize,
            }),
        );
    }

    async stopWatching(): Promise<void> {
        return this.enqueueWatchLifecycle(() =>
            this.submitWatchMatter(ZOUZHE_MATTERS.STOP_FILE_WATCH, {}),
        );
    }

    async restartWatching(paths: string[], thumbnailSize: number): Promise<void> {
        return this.enqueueWatchLifecycle(async () => {
            await this.submitWatchMatter(ZOUZHE_MATTERS.STOP_FILE_WATCH, {});
            if (paths.length > 0) {
                await this.submitWatchMatter(ZOUZHE_MATTERS.START_FILE_WATCH, {
                    paths: [...paths],
                    recursive: true,
                    thumbnailSize,
                });
            }
        });
    }

    private enqueueWatchLifecycle(operation: () => Promise<void>): Promise<void> {
        const result = this.watchLifecycle.then(operation);
        this.watchLifecycle = result.catch(() => undefined);
        return result;
    }

    private async submitWatchMatter(
        matter: string,
        content: Record<string, unknown>,
    ): Promise<void> {
        const response = await this.fangXuanLingService.processZouzhe({
            department: GUANYUAN_NAMES.QIN_QIONG,
            matter,
            content,
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        });
        if (!response.approved) {
            throw new Error(response.instruction);
        }
    }

    /**
     * IService接口实现 - 设置圣旨接收通道（单向）
     * @param port MessageChannel的port2端，用于接收圣旨
     */
    setShengzhiPort(port: MessagePort): void {
        logger.info("🛡️ 秦琼建立圣旨接收通道");

        // 监听圣旨
        port.onmessage = async (event: MessageEvent): Promise<void> => {
            const shengzhi: Shengzhi = event.data;
            logger.info(`🛡️ 秦琼奉旨: ${shengzhi.command} [圣旨ID: ${shengzhi.id}]`);
            logger.debug("🛡️ 秦琼奉旨详情:", shengzhi);

            // 处理圣旨
            await this.processShengzhi(shengzhi);
        };
    }

    /**
     * 设置启奏事件总线
     * @param qizouBus mitt事件总线，用于发送qizou启奏
     */
    setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void {
        logger.info("🛡️ 秦琼建立启奏通道");
        this._qizouBus = qizouBus;
    }

    /**
     * 处理圣旨（核心状态机）
     *
     * @param _shengzhi 圣旨内容（当前未使用）
     *
     * @description
     * ⏳ RFC 0043: 秦琼目前不处理任何圣旨命令
     * 秦琼的三个公开方法（handleFolderDiscovered/Removed/ScanCompleted）
     * 由外部直接调用，不通过圣旨系统
     */
    private async processShengzhi(shengzhi: Shengzhi): Promise<void> {
        if (shengzhi.command !== "handle_watch_path_removed") {
            return;
        }
        const content = (shengzhi.content ?? {}) as Record<string, unknown>;
        await this.handleWatchPathRemoved(String(content.path ?? ""), content.isFile === true);
    }

    /**
     * 发送启奏给李世民
     */
    private emitQizou(matter: string, content: Record<string, unknown>): void {
        if (!this._qizouBus) {
            logger.warn("🛡️ 秦琼：启奏通道未建立，无法发送启奏");
            return;
        }

        const qizou: Qizou = {
            matter,
            content,
            from: this.name,
            timestamp: Date.now(),
            metadata: { type: "report" },
        };

        logger.debug("🛡️ 秦琼启奏:", qizou);
        this._qizouBus.emit("qizou", qizou);
    }

    async handleWatchPathRemoved(path: string, isFile: boolean): Promise<void> {
        if (!path) {
            return;
        }
        if (!isFile) {
            await this.removePath(path);
            return;
        }

        const response = await this.fangXuanLingService.processZouzhe({
            department: GUANYUAN_NAMES.QIN_QIONG,
            matter: ZOUZHE_MATTERS.REMOVE_WATCH_FILE,
            content: { path },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        });
        if (!response.approved) {
            throw new Error(response.instruction);
        }
        const data = (response.data ?? {}) as Record<string, unknown>;
        const folder = data.folder;
        const config = data.config;
        if (typeof folder === "string" && config) {
            this.fangXuanLingService.preference.replaceCurrentFolderConfig(
                folder,
                config as PhotasaConfig,
            );
        }
    }

    /**
     * 处理文件夹发现事件（公开方法）
     * 协调魏征添加文件夹到树
     */
    async addPath(folderPath: string): Promise<void> {
        if (!folderPath || typeof folderPath !== "string") {
            throw new Error("folderPath must be a non-empty string");
        }

        logger.info(`🛡️ 秦琼：处理文件夹发现 ${folderPath}`);

        // ✅ 使用常量发起启奏
        this.emitQizou(QizouMatters.FOLDER_DISCOVERED, { folderPath });

        logger.info("🛡️ 秦琼：文件夹发现处理完成");
    }

    /**
     * 处理文件夹移除事件（公开方法）
     * 协调魏征从树中移除文件夹
     */
    async removePath(folderPath: string): Promise<void> {
        if (!folderPath || typeof folderPath !== "string") {
            throw new Error("folderPath must be a non-empty string");
        }

        logger.info(`🛡️ 秦琼：处理文件夹移除 ${folderPath}`);

        // ✅ 使用常量发起启奏
        this.emitQizou(QizouMatters.FOLDER_REMOVED, { folderPath });

        logger.info("🛡️ 秦琼：文件夹移除处理完成");
    }

    /**
     * 处理扫描完成事件（公开方法）
     * 批量更新folderTree
     */
    async addPaths(paths: string[]): Promise<void> {
        if (!Array.isArray(paths)) {
            throw new Error("paths must be an array");
        }

        if (paths.length === 0) {
            logger.info("🛡️ 秦琼：扫描完成但路径为空，无需更新");
            return;
        }

        logger.info(`🛡️ 秦琼：处理扫描完成，共${paths.length}个路径`);

        // ✅ 使用常量发起启奏
        this.emitQizou(QizouMatters.SCAN_READY, { paths });

        logger.info(`🛡️ 秦琼：扫描完成处理完成，已更新${paths.length}个路径`);
    }
}
