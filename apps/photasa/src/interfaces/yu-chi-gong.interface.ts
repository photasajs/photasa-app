import type { InjectionKey } from "vue";
import type { FileOperation } from "@photasa/common";
import type { ScanQueueItem } from "@renderer/stores/scanning-types";
// ✅ RFC 0042 Step 2.5: folderTree管理已迁移到魏征服务，不再需要FolderNode导入

/**
 * 尉迟恭服务接口
 *
 * 职责定位（RFC 0042）：
 * - ✅ UI层的扫描队列业务接口（UI只通过useYuChiGong访问）
 * - ✅ 接收李世民圣旨，协调扫描任务添加/移除
 * - ✅ 通过启奏向李世民汇报任务结果
 * - ✅ 委托房玄龄访问ScanningStore（不直接持有队列）
 *
 * 架构原则：
 * - UI组件 → useYuChiGong() → 尉迟恭 → 房玄龄 → ScanningStore
 * - UI组件永远不知道房玄龄的存在
 * - 业务层返回原始数据，UI层用computed做转换
 * - Getter用于查询，方法用于CRUD操作
 */
export interface IYuChiGongService {
    /**
     * 服务名称（IService接口要求）
     */
    readonly name: string;

    /**
     * 扫描队列（只读属性）
     * 返回原始ScanAction[]数组，UI层使用computed做转换
     *
     * @example
     * // 业务层：返回原始数据
     * const yuChiGong = useYuChiGong();
     * const queue = yuChiGong.scanningQueue;  // ScanAction[]
     *
     * // UI层：使用computed做转换
     * const scanningPaths = computed(() =>
     *     yuChiGong.scanningQueue.map(action => action.path)
     * );
     */
    readonly scanningQueue: ScanQueueItem[];

    // ✅ RFC 0042 Step 2.5: folderTree已迁移到魏征服务，使用useWeiZheng()访问

    /**
     * 扫描队列长度（只读属性）
     * @example
     * const yuChiGong = useYuChiGong();
     * const size = yuChiGong.queueSize;  // 5
     */
    readonly queueSize: number;

    /**
     * 检查路径是否在扫描队列中
     * @param path 路径
     * @returns 是否在队列中
     * @example
     * const yuChiGong = useYuChiGong();
     * const inQueue = yuChiGong.isInQueue('/test/path');
     */
    isInQueue(path: string): boolean;

    // ✅ RFC 0048 v3 Phase 4: addScanTask() 和 addScanTasks() 已删除
    // 原因：违反 "Store as SSOT" 原则，应使用 Qizou-Shengzhi-FangXuanLing 流程

    /**
     * 移除扫描任务从队列
     * @param path 要移除的路径
     * @returns Promise<void>
     * @example
     * const yuChiGong = useYuChiGong();
     * await yuChiGong.removeScanTask('/test/path');
     */
    removeScanTask(path: string): Promise<void>;

    /**
     * 用户触发的目录重新扫描（清空缓存后全量扫描）
     * @param path 目录绝对路径
     */
    requestRescan(path: string): Promise<void>;

    /**
     * 文件监视批量事件触发的扫描任务
     * @param operations Rust watch 合并后的文件操作
     * @param thumbnailSize 当前缩略图大小
     */
    scheduleFileOperationsFromWatch(
        operations: FileOperation[],
        thumbnailSize: number,
    ): Promise<void>;

    /**
     * 初始化扫描队列（应用启动时调用）
     * 从天界恢复持久化的扫描队列
     *
     * CRUD分类：Read操作
     */
    initializeScanningQueue(): Promise<void>;
}

/**
 * 尉迟恭服务注入令牌
 */
export const YU_CHI_GONG_TOKEN: InjectionKey<IYuChiGongService> = Symbol("YuChiGongService");
