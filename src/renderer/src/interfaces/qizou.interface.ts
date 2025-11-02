/**
 * 启奏 - 服务通过mitt事件总线向李世民报告事项
 */
export interface Qizou {
    /** 启奏事项 */
    matter: string;

    /** 启奏内容 */
    content: Record<string, unknown>;

    /** 来源服务 */
    from: string;

    /** 时间戳 */
    timestamp: number;

    /** 元数据 */
    metadata?: {
        type?: "request" | "report"; // 请求执行 或 报告完成
        relatedMatter?: string; // 关联的matter（report时使用）
        priority?: "urgent" | "normal";
    };
}
