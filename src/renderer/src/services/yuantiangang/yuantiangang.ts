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
import type { Qizou } from "@common/interfaces/qizou.interface";
import type { Emitter } from "mitt";
import { loggers } from "@common/logger";
import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";

const logger = loggers.yuantiangang;

/**
 * 袁天罡钦天监服务实现
 * 接收房玄龄诏令，与天枢引擎通信
 */
export class YuanTianGangService implements IYuanTianGangService {
    private progressCleanupFn?: () => void;
    private statusCleanupFn?: () => void;
    private qianliyanCleanupFn?: () => void;
    private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;

    constructor() {
        logger.info("🔮 就任，开始处理天界通信");
        this.setupTianshuEventListening();
        this.setupQianliyanEventListening(); // ⏳ 临时：监听千里眼IPC事件
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
        try {
            // 监听天枢进度事件
            this.progressCleanupFn = (window as any).tianshu.onProgress((progress: any) => {
                logger.info("🔮 收到天枢进度更新", progress);
                // 可以在这里处理进度事件，比如转发给房玄龄
            });

            // 监听天枢状态事件
            this.statusCleanupFn = (window as any).tianshu.onStatus((status: any) => {
                logger.info("🔮 收到天枢状态变更", status);
                // 可以在这里处理状态事件，比如转发给房玄龄
            });

            logger.info("🔮 天枢事件监听已建立");
        } catch (error) {
            logger.warn("🔮 建立天枢事件监听失败", error);
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
        try {
            const ipc = (window as any).electron?.ipcRenderer;
            if (!ipc) {
                logger.warn("🔮 无法访问IPC，跳过千里眼事件监听");
                return;
            }

            // 监听千里眼扫描事件
            const handler = (_: any, args: any) => {
                this.handleQianliyanEvent(args);
            };

            ipc.on("picasa:find-photo", handler);

            // 保存清理函数
            this.qianliyanCleanupFn = () => {
                ipc.removeListener("picasa:find-photo", handler);
            };

            logger.info("🔮 千里眼事件监听已建立（临时方案）");
        } catch (error) {
            logger.warn("🔮 建立千里眼事件监听失败", error);
        }
    }

    /**
     * ⏳ 临时：处理千里眼扫描事件
     *
     * @param args 扫描事件参数
     * @private
     */
    private handleQianliyanEvent(args: any): void {
        logger.debug("🔮 收到千里眼事件:", args.type, args.action?.path);

        let paths: string[] = [];

        if (args.type === "complete" && Array.isArray(args.paths)) {
            paths = args.paths;
        } else if (args?.action?.path && args?.action?.isDirectory) {
            paths = [args.action.path as string];
        }

        // 批量发送启奏
        this.reportScanCompletion(paths);
    }

    /**
     * ⏳ 临时：向李世民发送扫描完成启奏
     *
     * @param paths 扫描完成的路径数组
     * @private
     */
    private reportScanCompletion(paths: string[]): void {
        try {
            if (!this._qizouBus) {
                logger.error("🔮 启奏通道未建立，无法发送启奏");
                return;
            }

            // 构建启奏
            const qizou: Qizou = {
                matter: QizouMatters.SCAN_READY,
                content: { paths },
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
        logger.info("🔮 事件监听已清理");
    }

    async executeZhaoling(zhaoling: Zhaoling): Promise<ZhaolingResponse> {
        logger.info(
            `🔮 接收房玄龄诏令: ${zhaoling.command}, 来源: ${zhaoling.source}, 优先级: ${zhaoling.priority}`,
        );

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

            const startTime = Date.now();
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
            const uiCommand = this.convertFuluToUICommand(fulu);
            logger.info(`🔮 符箓转换为天枢命令: ${uiCommand.intent}, ID: ${uiCommand.id}`);

            // 通过IPC调用天枢引擎
            const tianshuResponse = await (window as any).tianshu.processCommand(uiCommand);
            logger.info(
                `🔮 天枢响应: ${tianshuResponse.status}, 引擎: ${tianshuResponse.result?.engineName || "unknown"}`,
            );

            // 转换天枢响应为符箓响应
            const fuluResponse: FuluResponse = {
                success: tianshuResponse.status !== "failed",
                intent: fulu.intent,
                context: fulu.context,
                timestamp: Date.now(),
                response: {
                    approved:
                        tianshuResponse.status === "completed" ||
                        tianshuResponse.status === "accepted",
                    message: tianshuResponse.error
                        ? tianshuResponse.error.message
                        : "天枢已处理符箓请求",
                    result: tianshuResponse.result,
                    status: tianshuResponse.status,
                },
                blessing: this.generateBlessing(fulu.urgency, tianshuResponse.status),
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
    private convertFuluToUICommand(fulu: Fulu): any {
        // 符箓意图到天枢UserIntent的映射（使用ZOUZHE_MATTERS常量值）
        const intentMapping: Record<string, string> = {
            [ZOUZHE_MATTERS.THEME_CHANGE]: "update_preferences", // 修正：使用天枢实际工作流
            [ZOUZHE_MATTERS.LANGUAGE_CHANGE]: "update_preferences", // 修正：使用天枢实际工作流
            [ZOUZHE_MATTERS.THUMBNAIL_SIZE_CHANGE]: "update_preferences", // 缩略图大小变更
            [ZOUZHE_MATTERS.ADD_PATH]: "update_preferences", // 添加路径操作
            [ZOUZHE_MATTERS.REMOVE_PATH]: "update_preferences", // 移除路径操作
            [ZOUZHE_MATTERS.ADD_SCAN_FOLDER]: "update_preferences", // 添加扫描文件夹操作
            [ZOUZHE_MATTERS.NOTIFICATION_SHOW]: "get_status",
            [ZOUZHE_MATTERS.PHOTO_SWITCH]: "scan_folder",
            [ZOUZHE_MATTERS.GET_PREFERENCES]: "get_preferences", // 使用天枢实际工作流
            [ZOUZHE_MATTERS.SCAN_FOLDER]: "scan_folder",
            [ZOUZHE_MATTERS.UPDATE_PREFERENCES]: "update_preferences", // 添加直接映射
            [ZOUZHE_MATTERS.GET_STATUS]: "get_status",
            // ✅ RFC 0042 Phase 2.4: 扫描队列管理映射
            [ZOUZHE_MATTERS.GET_SCANNING_QUEUE]: "get_scanning_queue",
            [ZOUZHE_MATTERS.ADD_SCAN_ACTION]: "add_scan_action",
            [ZOUZHE_MATTERS.REMOVE_SCAN_ACTION]: "remove_scan_action",
            // ✅ RFC 0042 Step 2.5: appState管理映射
            [ZOUZHE_MATTERS.RESTORE_APP_STATE]: "restore_app_state",
            [ZOUZHE_MATTERS.UPDATE_FOLDER_TREE]: "update_folder_tree",
            [ZOUZHE_MATTERS.SWITCH_FOLDER]: "switch_current_folder",
        };

        // 紧急程度到命令优先级的映射
        const priorityMapping = {
            critical: "system" as const,
            high: "user" as const,
            normal: "background" as const,
        };

        const intent = intentMapping[fulu.intent];
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
            logger.error("🔮 天枢处理失败", fuluResponse.error);
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
