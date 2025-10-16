import mitt, { type Emitter } from "mitt";
import type { Qizou } from "@common/interfaces/qizou.interface";
import type { Shengzhi } from "@common/interfaces/shengzhi.interface";
import { loggers } from "@common/logger";
import { DuRuHuiService } from "../duruhui/duruhui";
import eventRoutingConfig from "./event-routing.yml";

const logger = loggers.lishiming;

/**
 * YAML路由规则接口
 */
interface RouteRule {
    when: {
        /** 启奏类型 (request | report) */
        type?: "request" | "report";
        /** 启奏来源服务名称 */
        from?: string;
        /** 总是匹配 */
        always?: boolean;
    };
    then: {
        /** 目标服务名称 */
        service: string;
        /** 圣旨内容 */
        shengzhi: {
            /** 圣旨命令 */
            command: string;
            /** 圣旨内容（支持变量替换）*/
            content: Record<string, string>;
            /** 圣旨优先级 */
            priority: "urgent" | "normal";
        };
        /** 路由规则描述 */
        description?: string;
    };
}

interface EventRoutingConfig {
    metadata: {
        version: string;
        description: string;
        lastUpdated: string;
        rfc: string;
    };
    qizou_routes: Record<string, RouteRule[]>;
}

/**
 * 启奏路由器（QiZouRouter）- 中央事件路由决策者
 *
 * 职责：
 * 1. 创建并持有mitt事件总线
 * 2. 监听所有启奏事件（mitt.on('qizou')）
 * 3. 加载event-routing.yml配置
 * 4. 根据配置进行路由决策
 * 5. 委托杜如晦下发圣旨（duruhui.issueShengzhi）
 *
 * @class QiZouRouter
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @date 2025-10-16
 */
export class QiZouRouter {
    /**
     * mitt事件总线 - 用于接收所有qizou启奏
     */
    private qizouBus: Emitter<{ qizou: Qizou }>;

    /**
     * 杜如晦服务 - MessageChannel管理器
     */
    private duruhui: DuRuHuiService;

    /**
     * 路由配置
     */
    private routingConfig: EventRoutingConfig;

    /**
     * 圣旨计数器 - 用于生成唯一ID
     */
    private shengzhiCounter = 0;

    constructor(duruhui: DuRuHuiService) {
        logger.info("👑 李世民中央路由器启动");

        this.duruhui = duruhui;

        // 创建mitt事件总线
        this.qizouBus = mitt<{ qizou: Qizou }>();

        // 加载路由配置
        this.routingConfig = eventRoutingConfig as EventRoutingConfig;
        logger.info(
            `👑 李世民加载路由配置: v${this.routingConfig.metadata.version} - ${this.routingConfig.metadata.description}`,
        );

        // 注册启奏事件监听器
        this.registerQizouListener();
    }

    /**
     * 注册启奏事件监听器
     */
    private registerQizouListener(): void {
        logger.info("👑 李世民开始监听所有启奏事件");

        this.qizouBus.on("qizou", (qizou: Qizou) => {
            logger.info(`👑 李世民收到启奏: ${qizou.from} - ${qizou.matter}`);
            logger.debug("👑 李世民收到启奏详情:", qizou);

            // 查找路由规则并执行
            this.routeQizou(qizou);
        });
    }

    /**
     * 路由启奏事件（核心路由决策逻辑）
     *
     * @param qizou 启奏内容
     *
     * @description
     * 决策流程图：
     * ```
     * 步骤1：查找路由规则
     * ┌──────────────────────────────┐
     * │ 根据 qizou.matter 查找规则   │
     * │ 配置文件：event-routing.yml │
     * │ 示例：add_path_completed     │
     * └──────────────────────────────┘
     *         ↓
     * 步骤2：遍历规则并匹配条件
     * ┌──────────────────────────────┐
     * │ when.from === qizou.from?    │
     * │ when.type === metadata.type? │
     * │ when.always === true?        │
     * └──────────────────────────────┘
     *         ↓ (匹配成功)
     * 步骤3：构建圣旨对象
     * ┌──────────────────────────────┐
     * │ 生成唯一ID                   │
     * │ 解析content模板变量          │
     * │ 附加元数据（原始启奏）       │
     * └──────────────────────────────┘
     *         ↓
     * 步骤4：委托杜如晦下发圣旨
     * ┌──────────────────────────────┐
     * │ duruhui.issueShengzhi()      │
     * │ 通过MessageChannel发送       │
     * └──────────────────────────────┘
     * ```
     *
     * @example
     * ```typescript
     * // 褚遂良启奏：路径添加完成
     * const qizou = {
     *   matter: "add_path_completed",
     *   from: "褚遂良",
     *   content: { path: "/photos" },
     *   metadata: { type: "report" }
     * };
     *
     * // 李世民路由器匹配规则并下旨
     * routeQizou(qizou);
     *
     * // 结果：尉迟恭收到圣旨
     * // command: "add_scan_task"
     * // content: { path: "/photos" }
     * ```
     */
    private routeQizou(qizou: Qizou): void {
        const { matter, metadata, from } = qizou;

        // 查找对应的路由规则
        const routes = this.routingConfig.qizou_routes[matter];

        if (!routes || routes.length === 0) {
            logger.info(`👑 李世民：无路由规则，启奏${matter}无需处理`);
            return;
        }

        // 遍历所有路由规则，匹配条件
        for (const route of routes) {
            if (this.matchRouteCondition(route.when, { metadata, from })) {
                logger.info(
                    `👑 李世民匹配路由规则: ${matter} → ${route.then.service} (${route.then.shengzhi.command})`,
                );

                // 构建圣旨
                const shengzhi: Shengzhi = {
                    id: this.generateShengzhiId(),
                    command: route.then.shengzhi.command,
                    content: this.resolveContent(route.then.shengzhi.content, qizou),
                    priority: route.then.shengzhi.priority,
                    from: "李世民",
                    timestamp: Date.now(),
                    metadata: {
                        originalQizou: qizou,
                        reason: route.then.description || `响应启奏: ${matter}`,
                    },
                };

                // 委托杜如晦下发圣旨
                this.duruhui.issueShengzhi(route.then.service, shengzhi);

                // 只执行第一个匹配的规则
                break;
            }
        }
    }

    /**
     * 匹配路由条件
     *
     * @param condition 路由条件
     * @param context 匹配上下文
     * @returns 是否匹配
     */
    private matchRouteCondition(
        condition: RouteRule["when"],
        context: { metadata?: Qizou["metadata"]; from: string },
    ): boolean {
        // always: true 总是匹配
        if (condition.always === true) {
            return true;
        }

        // 匹配 from（启奏来源）
        if (condition.from && condition.from !== context.from) {
            return false;
        }

        // 匹配 type（启奏类型）
        if (condition.type && context.metadata?.type !== condition.type) {
            return false;
        }

        // 所有条件都匹配
        return true;
    }

    /**
     * 解析圣旨内容（支持模板变量）
     *
     * @param content 原始内容
     * @param qizou 启奏对象
     * @returns 解析后的内容
     * @description
     * 支持模板语法：{{qizou.content.path}} → 实际值
     */
    private resolveContent(content: Record<string, string>, qizou: Qizou): Record<string, unknown> {
        const resolved: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(content)) {
            // 解析模板变量 {{qizou.content.path}}
            if (typeof value === "string" && value.startsWith("{{") && value.endsWith("}}")) {
                const path = value.slice(2, -2).trim(); // 去除 {{ 和 }}
                const parts = path.split("."); // ['qizou', 'content', 'path']

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let current: any = { qizou };
                for (const part of parts) {
                    current = current[part];
                    if (current === undefined) {
                        logger.warn(`👑 李世民：无法解析模板变量 ${value}`);
                        break;
                    }
                }

                resolved[key] = current !== undefined ? current : value;
            } else {
                resolved[key] = value;
            }
        }

        return resolved;
    }

    /**
     * 生成圣旨唯一ID
     *
     * @returns 格式：shengzhi-{timestamp}-{counter}
     */
    private generateShengzhiId(): string {
        this.shengzhiCounter++;
        return `shengzhi-${Date.now()}-${this.shengzhiCounter}`;
    }

    /**
     * 获取qizou事件总线
     *
     * @returns mitt事件总线实例
     * @description 供服务使用，发送qizou启奏
     */
    getQizouBus(): Emitter<{ qizou: Qizou }> {
        return this.qizouBus;
    }
}
