import type { InjectionKey } from "vue";

/**
 * 秦琼服务接口
 * RFC 0042 Step 2.5: 文件系统事件监听者
 *
 * 职责定位：
 * - ✅ 监听文件系统事件（folder_discovered, folder_removed）
 * - ✅ 接收袁天罡的扫描完成通知
 * - ✅ 触发魏征更新folderTree
 * - ✅ 通过启奏向李世民汇报文件系统变化
 *
 * 架构原则：
 * - 袁天罡 → 秦琼监听事件 → 魏征更新树 → 天界持久化
 * - 秦琼作为文件系统事件的第一响应者
 * - 不维护本地状态，只负责事件路由和协调
 *
 * 历史背景：
 * 秦琼，唐朝开国名将，以守门神著称
 * 在架构中负责守护文件系统边界，监听文件系统事件
 */
export interface IQinQiongService {
    /**
     * 服务名称（IService接口要求）
     */
    readonly name: string;

    /**
     * 处理文件夹发现事件
     * 当扫描到新文件夹时调用
     *
     * @param folderPath 发现的文件夹路径
     */
    addPath(folderPath: string): Promise<void>;

    /**
     * 处理文件夹移除事件
     * 当文件夹被删除时调用
     *
     * @param folderPath 移除的文件夹路径
     */
    removePath(folderPath: string): Promise<void>;

    /**
     * 处理扫描完成事件
     * 当扫描任务完成时，批量更新folderTree
     *
     * @param paths 扫描完成的路径数组
     */
    addPaths(paths: string[]): Promise<void>;
}

/**
 * 秦琼服务注入令牌
 */
export const QIN_QIONG_TOKEN: InjectionKey<IQinQiongService> = Symbol("QinQiongService");
