import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import type { IService } from "@renderer/interfaces/service.interface";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import { QizouMatters } from "@renderer/constants/qizou-shengzhi-commands";
import { EventNames } from "@renderer/constants/event-names";
import type { Emitter } from "mitt";
import { loggers } from "@photasa/common";

const logger = loggers.duruhui;

/**
 * 杜如晦（DuRuHui）- MessageChannel 管理器
 *
 * 职责：
 * 1. 为每个服务创建专属MessageChannel通道
 * 2. 持有所有通道的port1端（李世民端）
 * 3. 将port2端交给服务（setShengzhiPort）
 * 4. 提供统一的下旨接口（issueShengzhi）
 * 5. ✅ RFC 0058: 监听百姓上书 DOM 事件，转换为 qizou
 *
 * **不负责**：
 * - ❌ 不做路由决策 - 这是李世民的职责
 * - ❌ 不监听服务回复（port.onmessage）- 服务通过qizou启奏汇报
 *
 * @class DuRuHuiService
 * @since RFC 0038 Phase 7 - qizou-shengzhi架构
 * @date 2025-10-16
 */
export class DuRuHuiService {
    /**
     * 服务通道映射表
     * key: 服务名称（如"褚遂良"、"尉迟恭"）
     * value: MessageChannel的port1端（李世民持有）
     */
    private serviceChannels = new Map<string, MessagePort>();

    /**
     * qizou 事件总线
     * 用于发送百姓上书转换的 qizou
     */
    private qizouBus?: Emitter<{ qizou: Qizou }>;

    constructor() {
        logger.info("📋 杜如晦中书侍郎就任，负责圣旨通道管理");
    }

    /**
     * 设置 qizou 事件总线
     * 供李世民调用，用于发送百姓上书转换的 qizou
     *
     * 设置后自动初始化百姓上书言路监听
     *
     * @param qizouBus qizou 事件总线
     */
    setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void {
        this.qizouBus = qizouBus;
    }

    /**
     * 初始化 DOM 事件监听系统
     * ✅ RFC 0058: 监听百姓上书言路（百姓上书DOM事件），转换为 qizou
     *
     * 架构：
     * ```
     * 百姓（UI 组件） → dispatchEvent('picasa:shangshu', { action, ...params })
     *   → 杜如晦监听 → 转换为 qizou → 通过 qizouBus 发送 → 路由器处理 → 下旨给服务
     * ```
     *
     * @public
     */
    public initializeBaiXingShangshuYanLu(): void {
        if (!this.qizouBus) {
            logger.warn("📋 杜如晦：qizouBus 未设置，无法监听百姓上书事件");
            return;
        }

        logger.info("📋 杜如晦：初始化 DOM 事件监听系统，监听百姓上书事件");

        // 监听统一的上书事件
        window.addEventListener(EventNames.BAIXING_SHANGSHU, ((
            event: CustomEvent<{ action: string; [key: string]: unknown }>,
        ) => {
            const { action, ...params } = event.detail;
            logger.info(`📋 杜如晦收到百姓上书: ${action}`, params);

            // 将百姓上书转换为 qizou，通过 qizouBus 发送
            this.convertShangshuToQizou(action, params);
        }) as EventListener);

        logger.info("📋 杜如晦：DOM 事件监听系统初始化完成，可接收百姓上书");
    }

    /**
     * 将百姓上书转换为 qizou，通过 qizouBus 发送
     *
     * @param action 操作类型
     * @param params 操作参数
     * @private
     */
    private convertShangshuToQizou(action: string, params: Record<string, unknown>): void {
        if (!this.qizouBus) {
            logger.error("📋 杜如晦：qizouBus 未设置，无法发送 qizou");
            return;
        }

        let matter: string;
        let content: Record<string, unknown>;

        switch (action) {
            case QizouMatters.OPEN_EXTERNAL: {
                matter = QizouMatters.OPEN_EXTERNAL;
                content = { url: params.url as string };
                break;
            }

            case QizouMatters.OPEN_IN_FINDER: {
                matter = QizouMatters.OPEN_IN_FINDER;
                content = { path: params.path as string };
                break;
            }

            case QizouMatters.REQUEST_RESCAN: {
                matter = QizouMatters.REQUEST_RESCAN;
                content = { path: params.path as string };
                break;
            }

            default:
                logger.warn(`📋 杜如晦：未知的百姓上书操作 ${action}，忽略`);
                return;
        }

        // 转换为 qizou
        const qizou: Qizou = {
            matter,
            content,
            from: "百姓", // 标记来源为百姓（UI 层）
            timestamp: Date.now(),
            metadata: {
                type: "request",
                priority: "normal",
            },
        };

        // 通过 qizouBus 发送，由路由器统一处理（与官员启奏走同一流程）
        logger.info(`📋 杜如晦发送 qizou: ${qizou.matter} from ${qizou.from}`, qizou);
        this.qizouBus.emit("qizou", qizou);
    }

    /**
     * 连接服务，建立单向圣旨通道
     *
     * @param service 实现IService接口的服务实例
     *
     * @description
     * MessageChannel 生命周期管理：
     * ```
     * 步骤1：创建通道
     * ┌─────────────────────────────┐
     * │ new MessageChannel()        │
     * │   - port1: 李世民持有       │
     * │   - port2: 服务持有         │
     * └─────────────────────────────┘
     *         ↓
     * 步骤2：注册通道
     * ┌─────────────────────────────┐
     * │ serviceChannels.set()       │
     * │   key: 服务名称             │
     * │   value: port1              │
     * └─────────────────────────────┘
     *         ↓
     * 步骤3：交付port2
     * ┌─────────────────────────────┐
     * │ service.setShengzhiPort()   │
     * │ 服务设置port.onmessage      │
     * └─────────────────────────────┘
     *         ↓
     * 通道就绪，可接收圣旨
     * ```
     *
     * 并发安全说明：
     * - 每个服务独立MessageChannel，无共享状态
     * - 单向通信（李世民→服务），无回复竞争
     * - 服务通过qizou启奏汇报，不使用port1.onmessage
     * - Map操作有重复检查，防止通道泄漏
     *
     * @example
     * ```typescript
     * const chusuiliangService = new ChusuiliangService();
     * duruhui.connect(chusuiliangService);
     * // 褚遂良现在可以接收圣旨了
     * ```
     */
    connect(service: IService): void {
        const serviceName = service.name;

        if (this.serviceChannels.has(serviceName)) {
            logger.warn(`📋 杜如晦：服务${serviceName}已建立通道，跳过重复连接`);
            return;
        }

        logger.info(`📋 杜如晦为${serviceName}建立圣旨通道`);

        // 创建MessageChannel
        const channel = new MessageChannel();

        // 李世民持有port1
        this.serviceChannels.set(serviceName, channel.port1);

        // 服务持有port2
        service.setShengzhiPort(channel.port2);

        logger.info(`📋 杜如晦：${serviceName}圣旨通道已就绪`);
    }

    /**
     * 下发圣旨（核心下旨接口）
     *
     * @param serviceName 目标服务名称
     * @param shengzhi 圣旨内容
     *
     * @description
     * 圣旨传递流程：
     * ```
     * 李世民路由器决策
     *         ↓
     * 调用 duruhui.issueShengzhi()
     *         ↓
     * 查找目标服务的port1
     *         ↓
     * port1.postMessage(shengzhi)
     *         ↓
     * MessageChannel 传递
     *         ↓
     * port2.onmessage 触发
     *         ↓
     * 服务接收并处理圣旨
     * ```
     *
     * 错误处理：
     * - 服务未注册 → 记录错误日志 → 直接返回（不抛异常）
     * - postMessage失败 → 浏览器内部处理（通常不会失败）
     *
     * 性能说明：
     * - MessageChannel 是零拷贝传递（结构化克隆）
     * - 适合传递复杂对象，无序列化开销
     * - 异步传递，不阻塞调用线程
     *
     * @example
     * ```typescript
     * duruhui.issueShengzhi("尉迟恭", {
     *     id: "shengzhi-001",
     *     command: "add_scan_task",
     *     content: { path: "/photos" },
     *     priority: "normal",
     *     from: "李世民",
     *     timestamp: Date.now()
     * });
     * ```
     */
    issueShengzhi(serviceName: string, shengzhi: Shengzhi): void {
        const port = this.serviceChannels.get(serviceName);

        if (!port) {
            logger.error(`📋 杜如晦无法下旨：服务${serviceName}未登记，请先调用connect()`);
            return;
        }

        logger.info(`📋 杜如晦传旨：${serviceName} - ${shengzhi.command} [圣旨ID: ${shengzhi.id}]`);
        logger.debug(`📋 杜如晦传旨详情：`, shengzhi);

        // 通过MessageChannel发送圣旨
        port.postMessage(shengzhi);
    }

    /**
     * 获取所有已注册服务列表
     *
     * @returns 已连接服务名称数组
     * @description 用于调试和状态检查
     */
    getRegisteredServices(): string[] {
        return Array.from(this.serviceChannels.keys());
    }

    /**
     * 断开服务连接
     *
     * @param serviceName 服务名称
     * @description 关闭MessageChannel连接并从注册表移除
     */
    disconnect(serviceName: string): void {
        const port = this.serviceChannels.get(serviceName);

        if (port) {
            port.close();
            this.serviceChannels.delete(serviceName);
            logger.info(`📋 杜如晦：${serviceName}圣旨通道已关闭`);
        }
    }

    /**
     * 清理所有通道
     *
     * @description 关闭所有MessageChannel连接，用于应用退出时清理
     */
    cleanup(): void {
        logger.info("📋 杜如晦：开始清理所有圣旨通道");

        for (const [serviceName, port] of this.serviceChannels.entries()) {
            port.close();
            logger.debug(`📋 杜如晦：${serviceName}通道已关闭`);
        }

        this.serviceChannels.clear();
        logger.info("📋 杜如晦：所有圣旨通道已清理完毕");
    }
}
