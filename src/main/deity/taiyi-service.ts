/**
 * 太乙服务 - 太乙真人化身
 * 作为天庭协调神祇，统御万仙，协调诸天引擎，管理适配器仙班
 *
 * 神话背景：
 * 太乙真人，又称太乙救苦天尊，乃元始天尊门下十二金仙之一
 * 掌管天庭协调事务，统御万仙，协调诸天万界
 * 以慈悲为怀，救苦救难，协调各方势力，维护天庭秩序
 *
 * 核心能力：
 * - 统御万仙：管理所有引擎适配器，协调各仙班
 * - 协调诸天：统筹各引擎间的工作流程和资源分配
 * - 救苦救难：处理引擎故障，恢复系统正常运行
 * - 维护秩序：确保天庭各司其职，和谐运转
 */

import { Service } from "@main/tianting/decorators/service-decorators";
import { ServicePriority, IService } from "@main/tianting/core/service-types";
import { TaiyiEngine, TaiyiEngineConfig } from "../../engines/taiyi/core/TaiyiEngine";
import { loggers } from "@common/logger";
import { WorkflowStep, ExecutionContext } from "../../engines/tianshu/types/workflows";
import { IStepExecutor, StepExecutionResult } from "@engines/common/interfaces";

const logger = loggers.taiyi;

@Service({
    name: "taiyi",
    displayName: "太乙救苦天尊",
    priority: ServicePriority.Important,
    description: "太乙真人化身，统御万仙，协调诸天引擎，管理适配器仙班，救苦救难",
    dependencies: [],
    retryOnFailure: true,
    maxRetries: 3,
})
export default class TaiyiService implements IService, IStepExecutor {
    readonly name = "taiyi";
    private engine!: TaiyiEngine;

    /**
     * 初始化服务
     */
    async initialize(): Promise<void> {
        logger.info("🌌 初始化太乙服务");
        const config: TaiyiEngineConfig = {
            adapterArgs: [],
            enableHealthCheck: true,
            healthCheckInterval: 30000,
        };

        this.engine = new TaiyiEngine(config);
        await this.engine.initialize();
    }

    /**
     * 关闭服务
     */
    async shutdown(): Promise<void> {
        if (this.engine) {
            await this.engine.shutdown();
        }
        logger.info("🌌 太乙服务已关闭");
    }

    /**
     * 执行工作流步骤 - IStepExecutor接口实现
     * 天枢 → 太乙：接收执行命令，转发给太乙引擎
     *
     * 注意：根据RFC 0036规范，只处理action和builtin类型步骤
     * condition和loop步骤应由TianshuEngine内置处理器处理
     */
    async executeAction(
        step: WorkflowStep,
        _context: ExecutionContext,
    ): Promise<StepExecutionResult> {
        const startTime = Date.now();

        try {
            // 步骤类型检查 - 根据RFC 0036规范
            if (step.type === "condition") {
                throw new Error(
                    `Condition steps should be handled by TianshuEngine, not TaiyiService: ${step.id}`,
                );
            }

            if (step.type === "loop") {
                throw new Error(
                    `Loop steps should be handled by TianshuEngine, not TaiyiService: ${step.id}`,
                );
            }

            // 太乙服务作为薄包装层，根据步骤类型和service字段正确路由
            let engineResult: any;
            let routeInfo = "";

            if (step.type === "builtin" || step.service === "builtin") {
                // 内置操作：路由到builtin适配器
                routeInfo = `builtin.${step.action}`;
                engineResult = await this.engine.callEngine(
                    "builtin",
                    step.action || "unknown",
                    step.input || {},
                );
            } else if (step.type === "action") {
                // 动作步骤：根据service字段路由
                if (step.service === "taiyi" && step.action === "callEngine") {
                    // 太乙路由模式：从input中解析真实的目标引擎和方法
                    const engineName = step.input?.engineName || "system";
                    const methodName = step.input?.methodName || "execute";
                    const args = step.input?.args || (step.input ? [step.input] : []);

                    routeInfo = `taiyi-route:${engineName}.${methodName}`;
                    engineResult = await this.engine.callEngine(engineName, methodName, ...args);
                } else {
                    // 直接引擎调用：step.service直接指定目标引擎
                    const engineName = step.service || "unknown";
                    const methodName = step.action || "execute";
                    const args = step.input ? [step.input] : [];

                    routeInfo = `direct:${engineName}.${methodName}`;
                    engineResult = await this.engine.callEngine(engineName, methodName, ...args);
                }
            } else {
                // 未知步骤类型
                throw new Error(
                    `Unknown step type: ${step.type} in step ${step.id}. Supported types: action, builtin`,
                );
            }

            logger.info(`🌌 太乙路由成功: ${routeInfo} -> ${step.id}`);

            // 构造标准化结果
            const result: StepExecutionResult = {
                success: true,
                data: engineResult,
                metadata: {
                    duration: Date.now() - startTime,
                    stepId: step.id,
                    executedAt: Date.now(),
                    route: routeInfo,
                    stepType: step.type,
                },
            };

            return result;
        } catch (error) {
            logger.error(
                `🌌 太乙路由失败: ${step.type}/${step.service}.${step.action} -> ${step.id}`,
                error,
            );

            // 构造错误结果
            const errorResult: StepExecutionResult = {
                success: false,
                error: (error as Error).message,
                metadata: {
                    duration: Date.now() - startTime,
                    stepId: step.id,
                    failedAt: Date.now(),
                    stepType: step.type,
                },
            };

            return errorResult; // 返回错误结果而不是抛出异常
        }
    }

    /**
     * EventEmitter方法委托给TaiyiEngine
     * TaiyiService作为接口适配器，直接委托给引擎
     */
    on(event: string, callback: (data: any) => void): void {
        this.engine.on(event, callback);
    }

    off(event: string, callback: (data: any) => void): void {
        this.engine.off(event, callback);
    }

    once(event: string, callback: (data: any) => void): this {
        this.engine.once(event, callback);
        return this;
    }

    emit(event: string, data: any): void {
        this.engine.emit(event, data);
    }

    removeAllListeners(event?: string): void {
        this.engine.removeAllListeners(event);
    }
}
