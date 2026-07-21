/**
 * 袁天罡钦天监服务实现
 * 负责与天界(Main进程)通信，处理房玄龄的诏令
 */

import type {
    IYuanTianGangService,
    Fulu,
    FuluResponse,
} from "../../interfaces/yuan-tian-gang.interface";
import type { Zhaoling, ZhaolingResponse } from "../../interfaces/fang-xuan-ling.interface";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type { Emitter } from "mitt";
import { IService } from "@renderer/interfaces/service.interface";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import { loggers } from "@photasa/common";
import { listen } from "@tauri-apps/api/event";
import { tianshuAdapter, type Fulu as TianshuCommand } from "@renderer/api/tianshu.adapter";
import { scanAdapter, type ScanResult } from "@renderer/api/scan.adapter";
import { isTauri } from "@renderer/api/env";
import { QizouMatters, ShengzhiCommands } from "@renderer/constants/qizou-shengzhi-commands";
import { ScanActionEvent } from "@photasa/common";
import type { NotifyPayload } from "@photasa/common";
import type { MenuActionPayload } from "@renderer/interfaces/zhang-sun-wu-ji.interface";
import { computeScannedFilePaths } from "./utils";
import { IntentToFuluMapping } from "./intent";
import {
    FOLDER_TREE_COMMANDS,
    PREFERENCES_COMMANDS,
    SCAN_QUEUE_COMMANDS,
} from "./tauri-command-names";
import { extractFolderTreeFromContext } from "./folder-tree-payload";
import { buildPreferencesDelta, PREFERENCE_ZHAOLING_MATTERS } from "./preferences-delta";
import {
    extractActionsFromContext,
    normalizeRestoredQueue,
    scanActionToPersistedEntry,
} from "./scan-queue-payload";
import type { ScanQueueItem } from "@renderer/stores/scanning-types";

const logger = loggers.yuantiangang;

/**
 * 袁天罡钦天监服务实现
 * 接收房玄龄诏令，与天枢引擎通信
 */
export class YuanTianGangService implements IService, IYuanTianGangService {
    readonly name = "袁天罡";
    private progressCleanupFn?: () => void;
    private statusCleanupFn?: () => void;
    private qianliyanCleanupFn?: () => void;
    private notifyStatusCleanupFn?: () => void;
    private menuActionCleanupFn?: () => void; // ✅ RFC 0058: 菜单点击事件清理函数
    private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;
    /** 圣旨接收通道 */
    private shengzhiPort?: MessagePort;

    constructor() {
        logger.info("🔮 就任，开始处理天界通信");
        this.setupTianshuEventListening();
        this.setupQianliyanEventListening(); // ⏳ 临时：监听千里眼IPC事件
        this.setupNotifyStatusEventListening(); // ✅ RFC 0057: 监听 notify:status IPC 事件
        this.setupMenuActionEventListening(); // ✅ RFC 0058: 监听 menu:action IPC 事件
    }

    /**
     * 设置圣旨接收通道（IService 接口要求）
     * 由杜如晦调用，建立与李世民的通信通道
     *
     * @param port MessageChannel的port2端，用于接收圣旨
     */
    setShengzhiPort(port: MessagePort): void {
        logger.info("🔮 袁天罡建立圣旨接收通道");
        this.shengzhiPort = port;
        this.shengzhiPort.onmessage = async (event: MessageEvent) => {
            const shengzhi: Shengzhi = event.data;
            await this.processShengzhi(shengzhi);
        };
    }

    /**
     * 处理圣旨（由 setShengzhiPort 中的 onmessage 调用）
     * 对于 Shell 操作，将圣旨转换为诏令，通过 executeZhaoling 发送到天枢引擎工作流
     *
     * @param shengzhi 圣旨内容
     * @private
     */
    private async processShengzhi(shengzhi: Shengzhi): Promise<void> {
        try {
            switch (shengzhi.command) {
                case ShengzhiCommands.MENU_ACTION:
                    // 菜单点击事件已通过 IPC 处理，这里不需要处理
                    logger.warn("🔮 袁天罡：收到 MENU_ACTION 圣旨，但菜单点击应通过 IPC 处理");
                    break;
                case ShengzhiCommands.OPEN_EXTERNAL:
                case ShengzhiCommands.OPEN_IN_FINDER:
                    // ✅ RFC 0058: Shell 操作通过天枢引擎工作流处理
                    // 将圣旨转换为诏令，通过 executeZhaoling 发送到天枢引擎
                    // 注意：圣旨的 command 是 ShengzhiCommands.OPEN_EXTERNAL/OPEN_IN_FINDER (值为 "open_external"/"open_in_finder")
                    // 这与 ZOUZHE_MATTERS.OPEN_EXTERNAL/OPEN_IN_FINDER 的值相同，可以直接用作符箓的 intent
                    const zhaoling: Zhaoling = {
                        command: shengzhi.command, // "open_external" 或 "open_in_finder"
                        context: (shengzhi.content as Record<string, unknown>) || {},
                        timestamp: Date.now(),
                        source: shengzhi.from || "袁天罡",
                        priority: shengzhi.priority === "urgent" ? "urgent" : "normal",
                        requiresTianshuApproval: true,
                    };
                    await this.executeZhaoling(zhaoling);
                    break;
                default:
                    logger.warn(`🔮 袁天罡：未知圣旨命令 ${shengzhi.command}`);
            }
        } catch (error) {
            logger.error(`🔮 袁天罡：处理圣旨失败`, error);
        }
    }

    /**
     * 设置启奏事件总线
     * @param qizouBus mitt事件总线，用于发送qizou启奏
     */
    setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void {
        logger.info("🔮 袁天罡建立启奏通道");
        this._qizouBus = qizouBus;
    }

    /**
     * 设置天枢事件监听
     * 袁天罡持续监听天界动态，以便及时回报房玄龄
     */
    private setupTianshuEventListening(): void {
        // 在 Tauri 环境下，天枢事件通过 Tauri event system 传递
        // 在 Electron 环境下，通过 window.tianshu IPC 监听
        if ((window as any).tianshu) {
            try {
                this.progressCleanupFn = (window as any).tianshu.onProgress((progress: any) => {
                    logger.info("🔮 收到天枢进度更新", progress);
                });
                this.statusCleanupFn = (window as any).tianshu.onStatus((status: any) => {
                    logger.info("🔮 收到天枢状态变更", status);
                });
                logger.info("🔮 天枢事件监听已建立（Electron模式）");
            } catch (error) {
                logger.warn("🔮 建立天枢事件监听失败", error);
            }
        } else {
            // Tauri 模式：事件通过 picasa:tianshu-* 传递，暂不需要主动监听
            logger.info("🔮 天枢事件监听已建立（Tauri模式）");
        }
    }

    /**
     * ⏳ 临时：监听千里眼IPC事件（picasa:find-photo）
     *
     * RFC 0042 临时方案：
     * - 当前千里眼还未统一到天枢架构
     * - 扫描完成事件通过 IPC "picasa:find-photo" 发送
     * - 袁天罡临时监听这个事件并发送启奏给李世民
     *
     * 未来：千里眼统一后，此方法将被移除
     *
     * @private
     */
    private setupQianliyanEventListening(): void {
        // Tauri 模式：通过 scan adapter 监听 picasa:find-photo 事件
        if (!(window as any).electron) {
            scanAdapter
                .onScanResult((result) => {
                    this.handleQianliyanEvent(result as unknown as ScanActionEvent);
                })
                .then((unlisten) => {
                    this.qianliyanCleanupFn = unlisten;
                })
                .catch((error: Error | unknown) => {
                    logger.warn(
                        "🔮 建立千里眼事件监听失败（Tauri模式）",
                        error instanceof Error ? error.message : String(error),
                    );
                });
            logger.info("🔮 千里眼事件监听已建立（Tauri模式）");
            return;
        }

        // Electron 模式：通过 IPC 监听
        try {
            const ipc = (window as any).electron.ipcRenderer;
            if (!ipc) {
                logger.warn("🔮 无法访问IPC，跳过千里眼事件监听");
                return;
            }

            const handler = (_: unknown, args: ScanActionEvent) => {
                this.handleQianliyanEvent(args);
            };

            this.qianliyanCleanupFn = ipc.on("picasa:find-photo", handler);
            logger.info("🔮 千里眼事件监听已建立（Electron模式）");
        } catch (error: Error | unknown) {
            logger.warn(
                "🔮 建立千里眼事件监听失败",
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    /**
     * ✅ RFC 0057: 处理千里眼扫描事件
     *
     * @param args 扫描事件参数（FindPhotoEvent）
     * @private
     */
    private handleQianliyanEvent(args: ScanResult): void {
        logger.debug(
            "🔮 收到千里眼事件:",
            args.type,
            args.action?.path || args.directory?.path || args.file?.path,
        );

        if (args.type === "directory") {
            // ✅ RFC 0136: 收到目录报告，发送 scan_directory_discovered 启奏
            const directoryPath = args.directory?.path || args.action?.path;
            if (directoryPath) {
                this.reportScanDirectoryDiscovered(directoryPath, args.rootPath || directoryPath);
            }
        } else if (args.type === "progress" || args.type === "file") {
            // ✅ RFC 0057 / RFC 0136: 发送 SCAN_PROGRESS qizou 给虞世南
            this.reportScanProgress(args);
        } else if (args.type === "complete") {
            // ✅ RFC 0057: 发送 SCAN_PROGRESS qizou 给虞世南（type: "complete"）以清空进度
            this.reportScanProgress(args);
            // ✅ 保留：发送 SCAN_READY qizou 给魏征
            this.reportScanCompletion(computeScannedFilePaths(args), args);
        }
    }

    /**
     * 路径 preference 持久化成功后向李世民启奏（跨部门协调由李世民路由）
     */
    private reportPathPreferenceCompleted(matter: string, path: string): void {
        try {
            if (!this._qizouBus) {
                logger.error("🔮 启奏通道未建立，无法汇报路径持久化完成");
                return;
            }

            const qizou: Qizou = {
                matter,
                content: { path },
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: { type: "report" },
            };

            this._qizouBus.emit("qizou", qizou);
            logger.info(`🔮 启奏李世民: ${matter} (${path})`);
        } catch (error) {
            logger.error(`🔮 发送 ${matter} 启奏失败:`, error);
        }
    }

    /**
     * ✅ RFC 0136: 向李世民发送发现直属子目录启奏
     */
    private reportScanDirectoryDiscovered(directoryPath: string, rootPath: string): void {
        try {
            if (!this._qizouBus) {
                logger.error("🔮 启奏通道未建立，无法发送启奏");
                return;
            }

            const qizou: Qizou = {
                matter: QizouMatters.SCAN_DIRECTORY_DISCOVERED,
                content: {
                    directoryPath,
                    rootPath,
                },
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: {
                    type: "report",
                    priority: "normal",
                },
            };

            this._qizouBus.emit("qizou", qizou);
            logger.info(`🔮 启奏发送成功: scan_directory_discovered -> ${directoryPath}`);
        } catch (error) {
            logger.error("🔮 发送 scan_directory_discovered 启奏失败:", error);
        }
    }

    /**
     * ✅ RFC 0057 / RFC 0136: 向李世民发送扫描进度启奏
     * 简化逻辑：所有处理由 yuShiNan 负责
     *
     * @param scanEvent ScanResult 事件（统一类型）
     * @private
     */
    private reportScanProgress(scanEvent: ScanResult): void {
        try {
            if (!this._qizouBus) {
                logger.error("🔮 启奏通道未建立，无法发送启奏");
                return;
            }

            // 支持新 ScanFileReport (file.path, rootPath) 与旧 ScanActionEvent (action.path, currentFile)
            const fileObj = scanEvent.file || scanEvent.action;
            const rootPath = scanEvent.rootPath || scanEvent.action?.path || "";

            let filePath = "";
            if (fileObj?.path && fileObj.isDirectory === false) {
                filePath = fileObj.path;
            } else if (rootPath && scanEvent.currentFile) {
                filePath = `${rootPath}/${scanEvent.currentFile}`.replace(/\/+/g, "/");
            } else if (fileObj?.path) {
                filePath = fileObj.path;
            } else if (rootPath) {
                filePath = rootPath;
            }

            const scanPath = rootPath || filePath;

            // 获取进度值（已处理的文件数）
            const progress = scanEvent.progress?.processed ?? 0;
            const total = scanEvent.progress?.total ?? 0;

            // ✅ 构建启奏，类型直接使用 scanEvent.type（progress 或 complete）
            // yuShiNan 会处理 complete 类型的清空逻辑
            const qizou: Qizou = {
                matter: QizouMatters.SCAN_PROGRESS,
                content: {
                    filePath: scanEvent.type === "complete" ? "" : filePath, // complete 时清空路径
                    scanPath: scanEvent.type === "complete" ? "" : scanPath,
                    progress: scanEvent.type === "complete" ? 0 : progress, // complete 时清空进度
                    total: scanEvent.type === "complete" ? 0 : total,
                    type: scanEvent.type === "complete" ? "complete" : "progress", // ✅ 保持类型一致
                },
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: {
                    type: "report",
                    priority: "normal",
                },
            };

            this._qizouBus.emit("qizou", qizou);
            logger.debug(
                `🔮 启奏李世民: 扫描${scanEvent.type === "complete" ? "完成" : "进度更新"} - ${filePath} (进度: ${progress})`,
            );
        } catch (error) {
            logger.error(`🔮 发送扫描进度启奏失败:`, error);
        }
    }

    /**
     * ⏳ 临时：向李世民发送扫描完成启奏
     *
     * @param paths 扫描完成的路径数组
     * @private
     */
    private reportScanCompletion(paths: string[], scanAction: ScanActionEvent): void {
        try {
            if (!this._qizouBus) {
                logger.error("🔮 启奏通道未建立，无法发送启奏");
                return;
            }

            // 构建启奏
            const qizou: Qizou = {
                matter: QizouMatters.SCAN_READY,
                content: { paths, scanAction },
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: {
                    type: "report",
                    priority: "normal",
                },
            };

            // 通过mitt发送启奏给李世民
            this._qizouBus.emit("qizou", qizou);
            logger.info(`🔮 启奏李世民: 批量扫描完成 (${paths.length}个路径)`, paths);
        } catch (error) {
            logger.error(`🔮 发送启奏失败:`, error);
        }
    }

    /**
     * ✅ RFC 0057: 设置 notify:status IPC 事件监听
     * 监听主进程发送的状态通知，通过 qizou 流程发送给虞世南
     *
     * @private
     */
    private setupNotifyStatusEventListening(): void {
        try {
            if (!(window as any).electron) {
                listen<NotifyPayload>("notify:status", (event) => {
                    this.reportStatusNotification(event.payload);
                })
                    .then((unlisten) => {
                        this.notifyStatusCleanupFn = unlisten;
                    })
                    .catch((error: Error | unknown) => {
                        logger.warn(
                            "🔮 建立 notify:status 事件监听失败（Tauri模式）",
                            error instanceof Error ? error.message : String(error),
                        );
                    });
                logger.info("🔮 notify:status 事件监听已建立（Tauri模式）");
                return;
            }

            const ipc = window.electron?.ipcRenderer;
            if (!ipc) {
                logger.warn("🔮 无法访问IPC，跳过 notify:status 事件监听");
                return;
            }

            // 监听主进程的状态通知
            const handler = (_: unknown, payload: NotifyPayload) => {
                this.reportStatusNotification(payload);
            };

            this.notifyStatusCleanupFn = ipc.on("notify:status", handler);

            logger.info("🔮 notify:status 事件监听已建立");
        } catch (error: Error | unknown) {
            logger.warn(
                "🔮 建立 notify:status 事件监听失败",
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    /**
     * ✅ RFC 0058: 设置菜单点击事件监听
     * 监听主进程的 menu:action IPC 事件，发送 MENU_ACTION qizou
     *
     * @private
     */
    private setupMenuActionEventListening(): void {
        // Tauri 模式：通过 legacy-api onMenuAction 监听 picasa:menu-action
        if (!(window as any).electron) {
            const off = (window as any).api?.onMenuAction?.((payload: MenuActionPayload) => {
                this.reportMenuAction(payload);
            });
            if (typeof off === "function") {
                this.menuActionCleanupFn = off;
            }
            logger.info("🔮 袁天罡：已建立 menu:action 事件监听（Tauri模式）");
            return;
        }

        // Electron 模式
        try {
            const ipc = (window as any).electron?.ipcRenderer;
            if (!ipc) {
                logger.warn("🔮 无法访问IPC，跳过 menu:action 事件监听");
                return;
            }

            const handler = (_: unknown, payload: MenuActionPayload) => {
                this.reportMenuAction(payload);
            };

            this.menuActionCleanupFn = ipc.on("menu:action", handler);
            logger.info("🔮 袁天罡：已建立 menu:action 事件监听，可接收主进程菜单点击");
        } catch (error: Error | unknown) {
            logger.warn(
                "🔮 建立 menu:action 事件监听失败",
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    /**
     * ✅ RFC 0058: 向李世民发送菜单点击事件启奏
     *
     * @param payload 菜单点击事件载荷
     * @private
     */
    private reportMenuAction(payload: MenuActionPayload): void {
        try {
            if (!this._qizouBus) {
                logger.error("🔮 启奏通道未建立，无法发送启奏");
                return;
            }

            // 构建启奏
            const qizou: Qizou = {
                matter: QizouMatters.MENU_ACTION,
                content: {
                    key: payload.key,
                    label: payload.label,
                    shortcut: payload.shortcut,
                    role: payload.role,
                    url: payload.url,
                },
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: {
                    type: "report",
                    priority: "normal",
                },
            };

            // 发送启奏
            this._qizouBus.emit("qizou", qizou);
            logger.info(`🔮 袁天罡：已将菜单点击事件启奏上报陛下 (${payload.key})`);
        } catch (error) {
            logger.error("🔮 袁天罡：发送菜单点击事件启奏失败", error);
        }
    }

    /**
     * ✅ RFC 0057: 向李世民发送状态通知启奏
     *
     * @param payload 状态通知载荷
     * @private
     */
    private reportStatusNotification(payload: NotifyPayload): void {
        try {
            if (!this._qizouBus) {
                logger.error("🔮 启奏通道未建立，无法发送启奏");
                return;
            }

            // 构建启奏
            const qizou: Qizou = {
                matter: QizouMatters.STATUS_NOTIFICATION,
                content: {
                    type: payload.type,
                    task: payload.task,
                    status: payload.status,
                    error: payload.error,
                    timestamp: payload.timestamp,
                    data: payload.data,
                },
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: {
                    type: "report",
                    priority: "normal",
                },
            };

            this._qizouBus.emit("qizou", qizou);
            logger.debug(`🔮 启奏李世民: 状态通知 - ${payload.type}/${payload.status}`);
        } catch (error) {
            logger.error(`🔮 发送状态通知启奏失败:`, error);
        }
    }

    /**
     * 清理事件监听（在服务销毁时调用）
     */
    destroy(): void {
        if (this.progressCleanupFn) {
            this.progressCleanupFn();
        }
        if (this.statusCleanupFn) {
            this.statusCleanupFn();
        }
        if (this.qianliyanCleanupFn) {
            this.qianliyanCleanupFn();
        }
        if (this.notifyStatusCleanupFn) {
            this.notifyStatusCleanupFn();
        }
        if (this.menuActionCleanupFn) {
            this.menuActionCleanupFn();
        }
        logger.info("🔮 事件监听已清理");
    }

    async executeZhaoling(zhaoling: Zhaoling): Promise<ZhaolingResponse> {
        logger.info(
            `🔮 接收房玄龄诏令: ${zhaoling.command}, 来源: ${zhaoling.source}, 优先级: ${zhaoling.priority}`,
        );

        const startTime = Date.now();

        // RFC 0136/0143：扫描队列 — 袁天罡 executeZhaoling 内唯一 invoke（无 *-bridge.ts）
        if (
            zhaoling.command === ZOUZHE_MATTERS.GET_SCANNING_QUEUE ||
            zhaoling.command === ZOUZHE_MATTERS.ADD_SCAN_ACTION ||
            zhaoling.command === ZOUZHE_MATTERS.REMOVE_SCAN_ACTION ||
            zhaoling.command === ZOUZHE_MATTERS.UPDATE_SCAN_ACTION_STATUS
        ) {
            try {
                if (!isTauri()) {
                    throw new Error("扫描队列持久化仅支持 Tauri 环境");
                }
                const { invoke } = await import("@tauri-apps/api/core");
                const context = (zhaoling.context ?? {}) as Record<string, unknown>;
                let rawQueue: Record<string, unknown>[];

                if (zhaoling.command === ZOUZHE_MATTERS.GET_SCANNING_QUEUE) {
                    rawQueue = await invoke<Record<string, unknown>[]>(SCAN_QUEUE_COMMANDS.GET);
                } else if (zhaoling.command === ZOUZHE_MATTERS.ADD_SCAN_ACTION) {
                    const actions = extractActionsFromContext(context).map(
                        scanActionToPersistedEntry,
                    );
                    rawQueue = await invoke<Record<string, unknown>[]>(SCAN_QUEUE_COMMANDS.ADD, {
                        actions,
                    });
                } else if (zhaoling.command === ZOUZHE_MATTERS.REMOVE_SCAN_ACTION) {
                    const path = String(context.path ?? "");
                    rawQueue = await invoke<Record<string, unknown>[]>(SCAN_QUEUE_COMMANDS.REMOVE, {
                        path,
                    });
                } else {
                    const path = String(context.path ?? "");
                    const status = String(context.status ?? "pending");
                    const updates = (context.updates ?? {}) as Record<string, unknown>;
                    rawQueue = await invoke<Record<string, unknown>[]>(SCAN_QUEUE_COMMANDS.UPDATE, {
                        path,
                        status,
                        updates,
                    });
                }

                const data: { queue: ScanQueueItem[] } = {
                    queue: normalizeRestoredQueue(rawQueue),
                };
                logger.info(`🔮 扫描队列已同步: ${zhaoling.command}，${data.queue.length} 项`);
                return {
                    acknowledged: true,
                    command: zhaoling.command,
                    data,
                    blessing: "扫描队列持久化成功",
                    timestamp: Date.now(),
                    metadata: {
                        engineName: "scan-queue-direct",
                        processTime: Date.now() - startTime,
                        urgency:
                            zhaoling.priority === "imperial"
                                ? "critical"
                                : zhaoling.priority === "urgent"
                                  ? "high"
                                  : "normal",
                    },
                };
            } catch (error) {
                logger.error(`🔮 扫描队列持久化失败: ${zhaoling.command}`, error);
                return {
                    acknowledged: false,
                    command: zhaoling.command,
                    data: null,
                    blessing: "扫描队列持久化失败",
                    timestamp: Date.now(),
                    error: error instanceof Error ? error.message : "队列持久化异常",
                };
            }
        }

        // RFC 0145：folder tree — 袁天罡 executeZhaoling 内 invoke（无 siming-bridge）
        if (
            zhaoling.command === ZOUZHE_MATTERS.UPDATE_FOLDER_TREE ||
            zhaoling.command === ZOUZHE_MATTERS.RESTORE_APP_STATE
        ) {
            try {
                if (!isTauri()) {
                    throw new Error("folder tree 持久化仅支持 Tauri 环境");
                }
                const { invoke } = await import("@tauri-apps/api/core");
                const context = (zhaoling.context ?? {}) as Record<string, unknown>;
                let data: unknown;

                if (zhaoling.command === ZOUZHE_MATTERS.UPDATE_FOLDER_TREE) {
                    const tree = extractFolderTreeFromContext(context);
                    data = await invoke(FOLDER_TREE_COMMANDS.UPDATE, { tree });
                } else {
                    data = await invoke(FOLDER_TREE_COMMANDS.RESTORE_APP_STATE);
                }

                logger.info(`🔮 folder tree 持久化成功: ${zhaoling.command}`);
                return {
                    acknowledged: true,
                    command: zhaoling.command,
                    data,
                    blessing: "folder tree 已更新",
                    timestamp: Date.now(),
                    metadata: {
                        engineName: "folder-tree-direct",
                        processTime: Date.now() - startTime,
                        urgency:
                            zhaoling.priority === "imperial"
                                ? "critical"
                                : zhaoling.priority === "urgent"
                                  ? "high"
                                  : "normal",
                    },
                };
            } catch (error) {
                logger.error(`🔮 folder tree 持久化失败: ${zhaoling.command}`, error);
                return {
                    acknowledged: false,
                    command: zhaoling.command,
                    data: null,
                    blessing: "folder tree 更新失败",
                    timestamp: Date.now(),
                    error: error instanceof Error ? error.message : "folder tree 持久化异常",
                };
            }
        }

        // RFC 0147：preference 域 — 袁天罡 executeZhaoling 内唯一 invoke（无 *-bridge.ts）
        if (PREFERENCE_ZHAOLING_MATTERS.has(zhaoling.command)) {
            try {
                if (!isTauri()) {
                    throw new Error("偏好持久化仅支持 Tauri 环境");
                }
                const { invoke } = await import("@tauri-apps/api/core");
                const context = (zhaoling.context ?? {}) as Record<string, unknown>;
                let data: unknown;

                if (zhaoling.command === ZOUZHE_MATTERS.GET_PREFERENCES) {
                    data = await invoke(PREFERENCES_COMMANDS.GET);
                } else {
                    const delta = buildPreferencesDelta(zhaoling.command, context);
                    data = await invoke(PREFERENCES_COMMANDS.UPDATE, {
                        delta,
                        source: zhaoling.source,
                    });
                }

                logger.info(`🔮 偏好持久化成功: ${zhaoling.command}`);

                if (zhaoling.command === ZOUZHE_MATTERS.ADD_PATH) {
                    const path = String(context.path ?? "");
                    if (path) {
                        this.reportPathPreferenceCompleted(QizouMatters.ADD_PATH_COMPLETED, path);
                    }
                } else if (zhaoling.command === ZOUZHE_MATTERS.REMOVE_PATH) {
                    const path = String(context.path ?? "");
                    if (path) {
                        this.reportPathPreferenceCompleted(
                            QizouMatters.REMOVE_PATH_COMPLETED,
                            path,
                        );
                    }
                }

                return {
                    acknowledged: true,
                    command: zhaoling.command,
                    data,
                    blessing: "偏好已同步",
                    timestamp: Date.now(),
                    metadata: {
                        engineName: "preferences-direct",
                        processTime: Date.now() - startTime,
                        urgency:
                            zhaoling.priority === "imperial"
                                ? "critical"
                                : zhaoling.priority === "urgent"
                                  ? "high"
                                  : "normal",
                    },
                };
            } catch (error) {
                logger.error(`🔮 偏好持久化失败: ${zhaoling.command}`, error);
                return {
                    acknowledged: false,
                    command: zhaoling.command,
                    data: null,
                    blessing: "偏好持久化失败",
                    timestamp: Date.now(),
                    error: error instanceof Error ? error.message : "偏好持久化异常",
                };
            }
        }

        // ✅ RFC 0142: 魏征监管的文件夹配置事务直连天界 (不经过Tianshu workflow)
        if (
            zhaoling.command === ZOUZHE_MATTERS.GET_FOLDER_CONFIG ||
            zhaoling.command === ZOUZHE_MATTERS.FIX_FOLDER_CONFIG ||
            zhaoling.command === ZOUZHE_MATTERS.RESET_FOLDER_CONFIG ||
            zhaoling.command === ZOUZHE_MATTERS.ADD_PHOTO_TO_LIST ||
            zhaoling.command === ZOUZHE_MATTERS.REMOVE_PHOTO_FROM_LIST ||
            zhaoling.command === ZOUZHE_MATTERS.TO_DIR_NAME ||
            zhaoling.command === ZOUZHE_MATTERS.SCAN_PHOTOS
        ) {
            try {
                let data: any = null;
                const { invoke } = await import("@tauri-apps/api/core");
                if (zhaoling.command === ZOUZHE_MATTERS.GET_FOLDER_CONFIG) {
                    data = await invoke("get_photasa_config", { folder: zhaoling.context.folder });
                } else if (zhaoling.command === ZOUZHE_MATTERS.FIX_FOLDER_CONFIG) {
                    data = await invoke("fix_photasa_config", { folder: zhaoling.context.folder });
                } else if (zhaoling.command === ZOUZHE_MATTERS.RESET_FOLDER_CONFIG) {
                    data = await invoke("reset_photasa_config", {
                        folder: zhaoling.context.folder,
                    });
                } else if (zhaoling.command === ZOUZHE_MATTERS.ADD_PHOTO_TO_LIST) {
                    data = await invoke("add_to_photo_list", {
                        photoPath: zhaoling.context.photoPath,
                    });
                } else if (zhaoling.command === ZOUZHE_MATTERS.REMOVE_PHOTO_FROM_LIST) {
                    data = await invoke("remove_from_photo_list", {
                        photoPath: zhaoling.context.photoPath,
                    });
                } else if (zhaoling.command === ZOUZHE_MATTERS.TO_DIR_NAME) {
                    data = await invoke("to_dir_name", { path: zhaoling.context.path });
                } else if (zhaoling.command === ZOUZHE_MATTERS.SCAN_PHOTOS) {
                    const { path, action, thumbnailSize } = zhaoling.context as any;
                    const requestId = `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    const scanAction = {
                        path,
                        action,
                        thumbnailSize,
                        operationType: "directory" as const,
                    };

                    data = await new Promise<any>((resolve, reject) => {
                        let unlistenFn: (() => void) | null = null;

                        listen<any>("picasa:find-photo", (event) => {
                            const result = event.payload;
                            if (result.requestId !== requestId) return;
                            if (result.type === "complete") {
                                if (unlistenFn) unlistenFn();
                                resolve(result);
                            } else if (result.type === "error") {
                                if (unlistenFn) unlistenFn();
                                reject(new Error(result.error || "扫描失败"));
                            }
                        })
                            .then((unlisten) => {
                                unlistenFn = unlisten;
                                invoke("scan_photos", { requestId, scanAction }).catch((err) => {
                                    if (unlistenFn) unlistenFn();
                                    reject(err);
                                });
                            })
                            .catch(reject);
                    });
                }

                logger.info(`🔮 钦天监直连文书上报成功: ${zhaoling.command}`);
                return {
                    acknowledged: true,
                    command: zhaoling.command,
                    data,
                    blessing: "钦天监直连上报成功",
                    timestamp: Date.now(),
                    metadata: {
                        engineName: "tauri",
                        processTime: Date.now() - startTime,
                        urgency:
                            zhaoling.priority === "imperial"
                                ? "critical"
                                : zhaoling.priority === "urgent"
                                  ? "high"
                                  : "normal",
                    },
                };
            } catch (error) {
                logger.error(`🔮 钦天监直连上报失败: ${zhaoling.command}`, error);
                return {
                    acknowledged: false,
                    command: zhaoling.command,
                    data: null,
                    blessing: "天界暂时无法响应",
                    timestamp: Date.now(),
                    error: error instanceof Error ? error.message : "直连上报异常",
                };
            }
        }

        try {
            // 房玄龄既然发诏令给袁天罡，必定需要天界通信
            // 袁天罡作为钦天监，职责是执行通信，无需再次判断
            const fulu: Fulu = {
                intent: zhaoling.command, // 直接使用诏令命令，不包装
                context: zhaoling.context,
                timestamp: Date.now(),
                source: zhaoling.source,
                urgency:
                    zhaoling.priority === "imperial"
                        ? "critical"
                        : zhaoling.priority === "urgent"
                          ? "high"
                          : "normal",
            };

            const fuluResponse = await this.sendFuluToTianshu(fulu);
            const processTime = Date.now() - startTime;

            // 袁天罡职责：拆箱天枢结果，装箱为钦天监格式
            const unboxedData = this.unboxTianshuResponse(fuluResponse);
            const reboxedResponse = this.reboxAsZhaolingResponse(
                zhaoling,
                unboxedData,
                fuluResponse,
                processTime,
            );

            logger.info(
                `🔮 天枢响应: ${fuluResponse.success ? "成功" : "失败"}, 意图: ${fuluResponse.intent}`,
            );
            logger.debug(`🔮 拆箱结果: ${unboxedData ? "有数据" : "无数据"}`);
            logger.debug(
                `🔮 装箱完成: 确认=${reboxedResponse.acknowledged}, 加持=${reboxedResponse.blessing}`,
            );

            const response: ZhaolingResponse = reboxedResponse;

            logger.info(`🔮 完成诏令执行: ${zhaoling.command}`, response);
            return response;
        } catch (error) {
            logger.error(`🔮 诏令执行失败: ${zhaoling.command}`, error);

            return {
                acknowledged: false,
                command: zhaoling.command,
                data: null,
                blessing: "天界暂时无法响应",
                timestamp: Date.now(),
                error: error instanceof Error ? error.message : "诏令处理异常",
            };
        }
    }

    /**
     * 向天枢发送符箓（内部方法）
     * 实现符箓到UICommand的转换并调用天枢引擎
     */
    private async sendFuluToTianshu(fulu: Fulu): Promise<FuluResponse> {
        logger.info(`🔮 向天枢发送符箓: ${fulu.intent}, 紧急程度: ${fulu.urgency}`);

        try {
            // 符箓到UICommand的转换
            const uiCommand = this.convertFuluToUICommand(fulu) as TianshuCommand & {
                id: string;
                intent: string;
                params: Record<string, unknown>;
                priority: string;
                context: unknown;
                createdAt: number;
            };
            logger.info(`🔮 符箓转换为天枢命令: ${uiCommand.intent}, ID: ${uiCommand.id}`);

            // 通过适配器调用天枢引擎（兼容 Tauri invoke 和 Electron IPC）
            const tianshuResponse = await tianshuAdapter.processCommand(uiCommand);
            const status = tianshuResponse.success ? "completed" : "failed";
            logger.info(
                `🔮 天枢响应: ${status}, 引擎: ${(tianshuResponse.result as any)?.engineName || "unknown"}`,
            );

            // 转换天枢响应为符箓响应
            const errorMessage =
                tianshuResponse.error ?? (tianshuResponse.success ? undefined : "天枢处理失败");

            const fuluResponse: FuluResponse = {
                success: tianshuResponse.success,
                intent: fulu.intent,
                context: fulu.context,
                timestamp: Date.now(),
                error: errorMessage,
                response: {
                    approved: tianshuResponse.success,
                    message: errorMessage ?? "天枢已处理符箓请求",
                    result: tianshuResponse.result,
                    status,
                },
                blessing: this.generateBlessing(fulu.urgency, status),
            };

            logger.info(`🔮 天枢回馈符箓: ${fulu.intent}`, fuluResponse);
            return fuluResponse;
        } catch (error) {
            logger.error(`🔮 符箓发送失败: ${fulu.intent}`, error);

            return {
                success: false,
                intent: fulu.intent,
                context: fulu.context,
                timestamp: Date.now(),
                error: error instanceof Error ? error.message : "天枢通信失败",
            };
        }
    }

    /**
     * 将符箓转换为天枢UICommand
     */
    private convertFuluToUICommand(fulu: Fulu): unknown {
        // 紧急程度到命令优先级的映射
        const priorityMapping = {
            critical: "system" as const,
            high: "user" as const,
            normal: "background" as const,
        };

        const intent = IntentToFuluMapping[fulu.intent];
        if (!intent) {
            throw new Error(
                `🏛️ 袁天罡：符箓意图"${fulu.intent}"未列入典籍，无法转换为天界诏令。请检查intentMapping是否包含此matter的映射。`,
            );
        }
        const priority = priorityMapping[fulu.urgency];

        // 根据不同的诏令命令，构造相应的参数
        let params = fulu.context ? { ...fulu.context } : {};

        // 针对偏好变更类命令，需要添加action参数和格式转换
        if (
            fulu.intent === ZOUZHE_MATTERS.THEME_CHANGE ||
            fulu.intent === ZOUZHE_MATTERS.LANGUAGE_CHANGE ||
            fulu.intent === ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE ||
            fulu.intent === ZOUZHE_MATTERS.ADD_PATH ||
            fulu.intent === ZOUZHE_MATTERS.REMOVE_PATH ||
            fulu.intent === ZOUZHE_MATTERS.ADD_SCAN_FOLDER
        ) {
            // 转换人界格式到天界统一偏好格式
            let convertedDelta: Record<string, unknown> = {};

            if (fulu.intent === ZOUZHE_MATTERS.THEME_CHANGE && fulu.context?.themeId) {
                convertedDelta = {
                    ui: {
                        theme: fulu.context.themeId,
                    },
                };
            } else if (fulu.intent === ZOUZHE_MATTERS.LANGUAGE_CHANGE && fulu.context?.locale) {
                convertedDelta = {
                    ui: {
                        language: fulu.context.locale,
                    },
                };
            } else if (fulu.intent === ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE && fulu.context?.size) {
                convertedDelta = {
                    display: {
                        thumbnailSize: fulu.context.size,
                    },
                };
            } else if (
                fulu.intent === ZOUZHE_MATTERS.ADD_PATH ||
                fulu.intent === ZOUZHE_MATTERS.REMOVE_PATH ||
                fulu.intent === ZOUZHE_MATTERS.ADD_SCAN_FOLDER
            ) {
                // ✅ 路径操作：context已经是完整的delta格式 { scanning: { paths: [...] } }
                // 由FangXuanLing.computePreferenceDelta计算好的
                convertedDelta = fulu.context || {};
            } else {
                // 如果已经是统一格式，直接使用
                convertedDelta = fulu.context || {};
            }

            params = {
                action: "update",
                delta: convertedDelta,
                source: fulu.source,
                ...params,
            };

            logger.debug("🔮 [调试] 转换后的params:", JSON.stringify(params, null, 2));
        }

        return {
            id: `fulu-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            intent,
            params,
            priority,
            context: {
                source: "api" as const,
                metadata: {
                    originalFuluIntent: fulu.intent,
                    fuluSource: fulu.source,
                    fuluTimestamp: fulu.timestamp,
                },
            },
            createdAt: Date.now(),
        };
    }

    /**
     * 拆箱天枢响应 - 严格按契约提取业务数据
     * 袁天罡职责：理解天枢的数据结构，提取纯业务数据
     *
     * 天枢标准格式优先级：
     * 1. response.result.data (标准格式)
     * 2. response.result (简化格式)
     * 3. response (原始格式)
     */
    private unboxTianshuResponse(fuluResponse: FuluResponse): unknown {
        logger.info("🔮 开始拆箱天枢响应");

        // 早返回：检查基本状态
        if (!fuluResponse.success) {
            const response = fuluResponse.response as Record<string, unknown> | undefined;
            const failureMessage =
                fuluResponse.error ??
                (typeof response?.message === "string" ? response.message : "天枢处理失败");
            logger.error("🔮 天枢处理失败", failureMessage);
            return null;
        }

        if (!fuluResponse.response) {
            logger.error("🔮 天枢无响应数据");
            return null;
        }

        const response = fuluResponse.response as Record<string, unknown>;

        // 早返回：按优先级尝试提取数据
        const result = response.result as Record<string, unknown> | undefined;

        if (result?.data) {
            logger.info("🔮 提取路径: response.result.data");
            return result.data;
        }

        if (result) {
            logger.info("🔮 提取路径: response.result");
            return result;
        }

        logger.info("🔮 提取路径: response (原始)");
        return response;
    }

    /**
     * 装箱为钦天监格式 - 严格按ZhaolingResponse契约
     * 袁天罡职责：将业务数据包装为自己的响应格式
     */
    private reboxAsZhaolingResponse(
        originalZhaoling: Zhaoling,
        businessData: unknown,
        fuluResponse: FuluResponse,
        processTime: number,
    ): ZhaolingResponse {
        logger.info(`🔮 开始装箱为钦天监格式: ${originalZhaoling.command}`);

        // 映射优先级（避免重复代码）
        const urgency =
            originalZhaoling.priority === "imperial"
                ? "critical"
                : originalZhaoling.priority === "urgent"
                  ? "high"
                  : "normal";

        const hasData = businessData !== null && businessData !== undefined;
        const responseObj = fuluResponse.response as Record<string, unknown> | undefined;
        const engineName =
            (responseObj?.engineName as string) ||
            ((responseObj?.result as Record<string, unknown>)?.engineName as string) ||
            "unknown";

        const response: ZhaolingResponse = {
            acknowledged: fuluResponse.success,
            command: originalZhaoling.command,
            data: businessData,
            blessing:
                fuluResponse.blessing ||
                this.generateBlessing(urgency, fuluResponse.success ? "completed" : "failed"),
            timestamp: Date.now(),
            metadata: {
                engineName,
                processTime,
                urgency,
            },
        };

        logger.info(
            `🔮 装箱完成: 确认=${response.acknowledged}, 数据=${hasData ? "有" : "无"}, 引擎=${engineName}, 耗时=${processTime}ms`,
        );

        return response;
    }

    /**
     * 根据紧急程度和天枢状态生成加持祝福
     */
    private generateBlessing(urgency: string, status: string): string {
        if (status === "failed") {
            return "天枢暂时忙碌，需再次祈请";
        }

        switch (urgency) {
            case "critical":
                return "天枢特别加持，星君庇佑";
            case "high":
                return "天枢恩典降临，诸事顺遂";
            default:
                return "天枢常规庇佑，平安吉祥";
        }
    }
}
