import type { InjectionKey } from "vue";

/**
 * 尉迟恭服务接口
 * 扫描队列UI状态管理
 */
export interface IYuChiGongService {
    /**
     * 服务名称
     */
    readonly name: string;

    /**
     * 获取当前扫描队列状态
     * @returns 扫描队列的路径列表
     */
    getScanningTasks(): string[];

    /**
     * 获取扫描队列长度
     * @returns 队列中的任务数量
     */
    getQueueSize(): number;

    /**
     * 检查路径是否在扫描队列中
     * @param path 路径
     * @returns 是否在队列中
     */
    isScanning(path: string): boolean;

    /**
     * 更新扫描进度（由袁天罡直接调用）
     * @param path 扫描路径
     * @param progress 进度信息
     */
    updateScanProgress(path: string, progress: { current: number; total: number }): void;

    /**
     * 清理所有扫描任务（应用退出时调用）
     */
    cleanup(): void;
}

/**
 * 尉迟恭服务注入令牌
 */
export const YU_CHI_GONG_TOKEN: InjectionKey<IYuChiGongService> = Symbol("YuChiGongService");
