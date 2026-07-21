export interface ILishiminService {
    /** 同步就位：注入百官与启奏系统（须在 Vue mount 之前调用） */
    prepareCourt(): void;
    /** 异步初始化各部门（可在首屏与 Splash 关闭之后再执行，避免天枢 IPC 阻塞启动） */
    initializeDepartments(): Promise<void>;
    /** 等价于 prepareCourt + await initializeDepartments（测试或单段启动用） */
    startZhengguan(): Promise<void>;
}

export const LISSHIMING_TOKEN = Symbol("LISSHIMING");
