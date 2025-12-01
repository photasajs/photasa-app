import type { Qizou } from "./qizou.interface";
import type { ScanProgressShengzhiContent } from "./yu-shinan.interface";
import type { MenuActionPayload } from "./zhang-sun-wu-ji.interface";

/**
 * 圣旨 - 李世民通过 MessageChannel 向各服务下达的指令
 */
export interface Shengzhi {
    /** 圣旨唯一标识（用于追踪和日志记录） */
    id: string;

    /** 圣旨命令 */
    command: string;

    /** 圣旨内容 */
    content: Record<string, unknown> | ScanProgressShengzhiContent | MenuActionPayload;

    /** 优先级 */
    priority: "urgent" | "normal";

    /** 来源（固定为李世民） */
    from: "李世民";

    /** 时间戳 */
    timestamp: number;

    /** 元数据 */
    metadata?: {
        originalQizou?: Qizou; // 触发此圣旨的启奏
        reason?: string; // 下旨原因
    };
}
