/**
 * 袁天罡钦天监服务实现
 * 负责与天界(Main进程)通信，处理房玄龄的诏令
 */

import type {
    IYuanTianGangService,
    Fulu,
    FuluResponse,
} from "../interfaces/yuan-tian-gang.interface";
import type { Zhaoling, ZhaolingResponse } from "../interfaces/fang-xuan-ling.interface";
import { ZOUZHE_MATTERS } from "../interfaces/fang-xuan-ling.interface";
import { loggers } from "@common/logger";

const logger = loggers.yuantiangang || loggers.main;

/**
 * 袁天罡钦天监服务实现
 * 接收房玄龄诏令，与天枢引擎通信
 */
export class YuanTianGangService implements IYuanTianGangService {
    private progressCleanupFn?: () => void;
    private statusCleanupFn?: () => void;

    constructor() {
        logger.info("🔮 就任，开始处理天界通信");
        this.setupTianshuEventListening();
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
     * 清理事件监听（在服务销毁时调用）
     */
    destroy(): void {
        if (this.progressCleanupFn) {
            this.progressCleanupFn();
        }
        if (this.statusCleanupFn) {
            this.statusCleanupFn();
        }
        logger.info("🔮 事件监听已清理");
    }

    async executeZhaoling(zhaoling: Zhaoling): Promise<ZhaolingResponse> {
        logger.info("🔮 接收房玄龄诏令", zhaoling);

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
            const tianshuResponse = {
                status: fuluResponse.success ? "天界已批准" : "天界暂缓",
                blessing: fuluResponse.blessing,
                tianShuResponse: fuluResponse.response,
            };

            logger.info("🔮 天枢回馈符箓响应", fuluResponse);

            const response: ZhaolingResponse = {
                acknowledged: true,
                command: zhaoling.command,
                context: zhaoling.context,
                timestamp: Date.now(),
                result: {
                    message: "袁天罡已执行诏令",
                    details: `已处理来自${zhaoling.source}的${zhaoling.command}请求`,
                },
                tianshuResponse,
            };

            logger.info(`🔮 完成诏令执行: ${zhaoling.command}`, response);
            return response;
        } catch (error) {
            logger.error(`🔮 诏令执行失败: ${zhaoling.command}`, error);

            return {
                acknowledged: false,
                command: zhaoling.command,
                context: zhaoling.context,
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
        logger.info("🔮 向天枢发送符箓", fulu);

        try {
            // 符箓到UICommand的转换
            const uiCommand = this.convertFuluToUICommand(fulu);
            logger.info("🔮 符箓转换为天枢命令", uiCommand);

            // 通过IPC调用天枢引擎
            const tianshuResponse = await (window as any).tianshu.processCommand(uiCommand);
            logger.info("🔮 天枢响应", tianshuResponse);

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
            [ZOUZHE_MATTERS.THEME_CHANGE]: "update_config",
            [ZOUZHE_MATTERS.LANGUAGE_CHANGE]: "update_config",
            [ZOUZHE_MATTERS.NOTIFICATION_SHOW]: "get_status",
            [ZOUZHE_MATTERS.PHOTO_SWITCH]: "scan_folder",
            scan_folder: "scan_folder",
            update_config: "update_config",
            get_status: "get_status",
        };

        // 紧急程度到命令优先级的映射
        const priorityMapping = {
            critical: "system" as const,
            high: "user" as const,
            normal: "background" as const,
        };

        const intent = intentMapping[fulu.intent] || "custom";
        const priority = priorityMapping[fulu.urgency];

        // 根据不同的诏令命令，构造相应的参数
        let params = fulu.context ? { ...fulu.context } : {};

        // 针对偏好变更类命令，需要添加action参数
        if (
            fulu.intent === ZOUZHE_MATTERS.THEME_CHANGE ||
            fulu.intent === ZOUZHE_MATTERS.LANGUAGE_CHANGE
        ) {
            params = {
                action: "update",
                delta: fulu.context,
                source: fulu.source,
                ...params,
            };
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
