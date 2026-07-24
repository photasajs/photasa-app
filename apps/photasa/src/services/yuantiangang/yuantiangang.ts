/**
 * 袁天罡钦天监服务实现
 * 负责与天界(Main进程)通信，处理房玄龄的诏令
 */

import type { IYuanTianGangService } from "../../interfaces/yuan-tian-gang.interface";
import type { Zhaoling, ZhaolingResponse } from "../../interfaces/fang-xuan-ling.interface";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type { Emitter } from "mitt";
import { IService } from "@renderer/interfaces/service.interface";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import { loggers } from "@photasa/common";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { scanAdapter, type ScanResult } from "@renderer/api/scan.adapter";
import { isTauri } from "@renderer/api/env";
import { QizouMatters, ShengzhiCommands } from "@renderer/constants/qizou-shengzhi-commands";
import { ScanActionEvent } from "@photasa/common";
import type { NotifyPayload } from "@photasa/common";
import type { MenuActionPayload } from "@renderer/interfaces/zhang-sun-wu-ji.interface";
import { computeScannedFilePaths } from "./utils";
import {
    FOLDER_TREE_COMMANDS,
    MENU_COMMANDS,
    PREFERENCES_COMMANDS,
    SCAN_QUEUE_COMMANDS,
    SHELL_COMMANDS,
    WATCH_EVENTS,
} from "./tauri-command-names";
import { extractFolderTreeFromContext } from "./folder-tree-payload";
import { buildPreferencesDelta, PREFERENCE_ZHAOLING_MATTERS } from "./preferences-delta";
import {
    applyScanQueueAdd,
    applyScanQueueRemove,
    applyScanQueueUpdate,
    extractActionsFromContext,
    normalizeRestoredQueue,
    scanActionToPersistedEntry,
    type ScanQueueAck,
} from "./scan-queue-payload";
import { useScanningStore } from "@renderer/services/fangxuanling/stores/scanning-store";
import type { ScanQueueItem } from "@renderer/stores/scanning-types";
import type { FileOperation } from "@photasa/common";

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
    private scanQueueAddCleanupFn?: () => void; // ✅ RFC 0137: 文件监视合并批次
    private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;
    /** 圣旨接收通道 */
    private shengzhiPort?: MessagePort;

    constructor() {
        logger.info("🔮 就任，开始处理天界通信");
        this.setupTianshuEventListening();
        this.setupQianliyanEventListening(); // ⏳ 临时：监听千里眼IPC事件
        this.setupNotifyStatusEventListening(); // ✅ RFC 0057: 监听 notify:status IPC 事件
        this.setupMenuActionEventListening(); // ✅ RFC 0058: 监听 menu:action IPC 事件
        this.setupScanQueueAddEventListening(); // ✅ RFC 0137: 监听 picasa:add-to-scan-queue
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
                    // RFC 0149/0150: Shell 操作经 executeZhaoling 直连 Rust command
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
        // Tauri：天枢事件经 picasa:tianshu-* 传递，暂不需要主动监听
        logger.info("🔮 天枢事件监听已建立（Tauri模式）");
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
        scanAdapter
            .onScanResult((result) => {
                this.handleQianliyanEvent(result);
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
            this.reportScanCompletion(
                computeScannedFilePaths(args as unknown as ScanActionEvent),
                args as unknown as ScanActionEvent,
            );
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
        try {
            listen<MenuActionPayload>("picasa:menu-action", (event) => {
                this.reportMenuAction(event.payload);
            })
                .then((unlisten) => {
                    this.menuActionCleanupFn = unlisten;
                })
                .catch((error: Error | unknown) => {
                    logger.warn(
                        "🔮 建立 menu:action 事件监听失败（Tauri模式）",
                        error instanceof Error ? error.message : String(error),
                    );
                });
            logger.info("🔮 袁天罡：已建立 menu:action 事件监听（Tauri 直连）");
        } catch (error: Error | unknown) {
            logger.warn(
                "🔮 建立 menu:action 事件监听失败",
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    /**
     * ✅ RFC 0137: 监听文件监视合并批次，启奏李世民协调尉迟恭入队
     * @private
     */
    private setupScanQueueAddEventListening(): void {
        try {
            if (!isTauri()) {
                return;
            }

            listen<FileOperation[]>(WATCH_EVENTS.SCAN_QUEUE_ADD, (event) => {
                const operations = Array.isArray(event.payload) ? event.payload : [];
                this.reportWatchScanQueueAdd(operations);
            })
                .then((unlisten) => {
                    this.scanQueueAddCleanupFn = unlisten;
                })
                .catch((error: Error | unknown) => {
                    logger.warn(
                        "🔮 建立 picasa:add-to-scan-queue 事件监听失败（Tauri模式）",
                        error instanceof Error ? error.message : String(error),
                    );
                });
            logger.info("🔮 袁天罡：已建立 picasa:add-to-scan-queue 事件监听（RFC 0137）");
        } catch (error: Error | unknown) {
            logger.warn(
                "🔮 建立 picasa:add-to-scan-queue 事件监听失败",
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    /**
     * ✅ RFC 0137: 向李世民启奏文件监视合并批次
     * @private
     */
    private reportWatchScanQueueAdd(operations: FileOperation[]): void {
        try {
            if (!this._qizouBus) {
                logger.error("🔮 启奏通道未建立，无法发送 watch 扫描队列启奏");
                return;
            }

            const qizou: Qizou = {
                matter: QizouMatters.WATCH_SCAN_QUEUE_ADD,
                content: { operations },
                from: "袁天罡",
                timestamp: Date.now(),
                metadata: {
                    type: "report",
                    priority: "normal",
                },
            };

            this._qizouBus.emit("qizou", qizou);
            logger.debug(`🔮 启奏李世民: watch 扫描队列批次 (${operations.length} 项)`);
        } catch (error) {
            logger.error("🔮 发送 watch 扫描队列启奏失败:", error);
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
        if (this.scanQueueAddCleanupFn) {
            this.scanQueueAddCleanupFn();
        }
        logger.info("🔮 事件监听已清理");
    }

    async executeZhaoling(zhaoling: Zhaoling): Promise<ZhaolingResponse> {
        logger.info(
            `🔮 接收房玄龄诏令: ${zhaoling.command}, 来源: ${zhaoling.source}, 优先级: ${zhaoling.priority}`,
        );

        const startTime = Date.now();

        // RFC 0136/0143/0162：扫描队列 — Ack IPC + 本地 patch（禁止突变回传全表）
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
                const context = (zhaoling.context ?? {}) as Record<string, unknown>;
                let queue: ScanQueueItem[];

                if (zhaoling.command === ZOUZHE_MATTERS.GET_SCANNING_QUEUE) {
                    const rawQueue = await invoke<Record<string, unknown>[]>(
                        SCAN_QUEUE_COMMANDS.GET,
                    );
                    queue = normalizeRestoredQueue(rawQueue);
                } else {
                    const scanningStore = useScanningStore();
                    if (zhaoling.command === ZOUZHE_MATTERS.ADD_SCAN_ACTION) {
                        const actions = extractActionsFromContext(context);
                        const persisted = actions.map(scanActionToPersistedEntry);
                        const ack = await invoke<ScanQueueAck>(SCAN_QUEUE_COMMANDS.ADD, {
                            actions: persisted,
                        });
                        queue = applyScanQueueAdd(scanningStore.queue, actions);
                        logger.debug(
                            `🔮 扫描队列入队 ack: len=${ack.queueLen} revision=${ack.revision}`,
                        );
                    } else if (zhaoling.command === ZOUZHE_MATTERS.REMOVE_SCAN_ACTION) {
                        const path = String(context.path ?? "");
                        const ack = await invoke<ScanQueueAck>(SCAN_QUEUE_COMMANDS.REMOVE, {
                            path,
                        });
                        queue = applyScanQueueRemove(scanningStore.queue, path);
                        logger.debug(
                            `🔮 扫描队列移除 ack: len=${ack.queueLen} revision=${ack.revision}`,
                        );
                    } else {
                        const path = String(context.path ?? "");
                        const status = String(
                            context.status ?? "pending",
                        ) as ScanQueueItem["status"];
                        const updates = (context.updates ?? {}) as Record<string, unknown>;
                        const ack = await invoke<ScanQueueAck>(SCAN_QUEUE_COMMANDS.UPDATE, {
                            path,
                            status,
                            updates,
                        });
                        queue = applyScanQueueUpdate(scanningStore.queue, path, status, updates);
                        logger.debug(
                            `🔮 扫描队列更新 ack: len=${ack.queueLen} revision=${ack.revision}`,
                        );
                    }
                }

                const data: { queue: ScanQueueItem[] } = { queue };
                logger.debug(`🔮 扫描队列已同步: ${zhaoling.command}，${data.queue.length} 项`);
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

        // RFC 0149/0150：shell + menu — 袁天罡 executeZhaoling 内直连 invoke（不经 zouwu）
        if (
            zhaoling.command === ZOUZHE_MATTERS.UPDATE_MENU ||
            zhaoling.command === ZOUZHE_MATTERS.OPEN_EXTERNAL ||
            zhaoling.command === ZOUZHE_MATTERS.OPEN_IN_FINDER
        ) {
            try {
                if (!isTauri()) {
                    throw new Error("shell/menu 仅支持 Tauri 环境");
                }
                const context = (zhaoling.context ?? {}) as Record<string, unknown>;

                if (zhaoling.command === ZOUZHE_MATTERS.UPDATE_MENU) {
                    await invoke(MENU_COMMANDS.APPLY, { menus: context.menus ?? [] });
                } else if (zhaoling.command === ZOUZHE_MATTERS.OPEN_EXTERNAL) {
                    await invoke(SHELL_COMMANDS.OPEN_EXTERNAL, {
                        url: String(context.url ?? ""),
                    });
                } else {
                    await invoke(SHELL_COMMANDS.SHOW_IN_FOLDER, {
                        path: String(context.path ?? ""),
                    });
                }

                logger.info(`🔮 shell/menu 直连成功: ${zhaoling.command}`);
                return {
                    acknowledged: true,
                    command: zhaoling.command,
                    data: { success: true },
                    blessing: "shell/menu 已执行",
                    timestamp: Date.now(),
                    metadata: {
                        engineName: "shell-menu-direct",
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
                logger.error(`🔮 shell/menu 直连失败: ${zhaoling.command}`, error);
                return {
                    acknowledged: false,
                    command: zhaoling.command,
                    data: null,
                    blessing: "shell/menu 执行失败",
                    timestamp: Date.now(),
                    error: error instanceof Error ? error.message : "shell/menu 异常",
                };
            }
        }

        // RFC 0147：preference 域 — 袁天罡 executeZhaoling 内唯一 invoke（无 *-bridge.ts）
        if (PREFERENCE_ZHAOLING_MATTERS.has(zhaoling.command)) {
            try {
                if (!isTauri()) {
                    throw new Error("偏好持久化仅支持 Tauri 环境");
                }
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

        // RFC 0137/0139：切换当前文件夹 — 直连 get_photasa_config（不经 zouwu switch_current_folder workflow）
        if (zhaoling.command === ZOUZHE_MATTERS.SWITCH_FOLDER) {
            try {
                if (!isTauri()) {
                    throw new Error("切换文件夹仅支持 Tauri 环境");
                }
                const context = (zhaoling.context ?? {}) as Record<string, unknown>;
                const folderPath = String(context.folderPath ?? context.folder ?? "");
                if (!folderPath) {
                    throw new Error("folderPath 不能为空");
                }

                const config = await invoke<Record<string, unknown> | null>("get_photasa_config", {
                    folder: folderPath,
                });

                const data = {
                    currentFolder: folderPath,
                    currentFolderConfig: config,
                };

                logger.info(`🔮 文件夹切换成功: ${folderPath}`);
                return {
                    acknowledged: true,
                    command: zhaoling.command,
                    data,
                    blessing: "文件夹已切换",
                    timestamp: Date.now(),
                    metadata: {
                        engineName: "config-direct",
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
                logger.error(`🔮 文件夹切换失败: ${zhaoling.command}`, error);
                return {
                    acknowledged: false,
                    command: zhaoling.command,
                    data: null,
                    blessing: "文件夹切换失败",
                    timestamp: Date.now(),
                    error: error instanceof Error ? error.message : "文件夹切换异常",
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
                const context = (zhaoling.context ?? {}) as Record<string, unknown>;
                let data: any = null;
                if (zhaoling.command === ZOUZHE_MATTERS.GET_FOLDER_CONFIG) {
                    data = await invoke("get_photasa_config", { folder: context.folder });
                } else if (zhaoling.command === ZOUZHE_MATTERS.FIX_FOLDER_CONFIG) {
                    data = await invoke("fix_photasa_config", { folder: context.folder });
                } else if (zhaoling.command === ZOUZHE_MATTERS.RESET_FOLDER_CONFIG) {
                    data = await invoke("reset_photasa_config", {
                        folder: context.folder,
                    });
                } else if (zhaoling.command === ZOUZHE_MATTERS.ADD_PHOTO_TO_LIST) {
                    data = await invoke("add_to_photo_list", {
                        photoPath: context.photoPath,
                    });
                } else if (zhaoling.command === ZOUZHE_MATTERS.REMOVE_PHOTO_FROM_LIST) {
                    data = await invoke("remove_from_photo_list", {
                        photoPath: context.photoPath,
                    });
                } else if (zhaoling.command === ZOUZHE_MATTERS.TO_DIR_NAME) {
                    data = await invoke("to_dir_name", { path: context.path });
                } else if (zhaoling.command === ZOUZHE_MATTERS.SCAN_PHOTOS) {
                    const { path, action, thumbnailSize } = context as {
                        path: string;
                        action: string;
                        thumbnailSize: number;
                    };
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

        // RFC 0153：zouwu / TianshuService 已物理移除；未直连的 matter 明确失败
        logger.error(`🔮 诏令无贞观直连 handler: ${zhaoling.command}`);
        return {
            acknowledged: false,
            command: zhaoling.command,
            data: null,
            blessing: "诏令已退役",
            timestamp: Date.now(),
            error: `未支持的诏令: ${zhaoling.command}（zouwu 已移除，RFC 0153）`,
        };
    }
}
