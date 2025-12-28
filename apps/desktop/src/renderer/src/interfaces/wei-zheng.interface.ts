import type { InjectionKey } from "vue";
import type { FolderNode } from "@photasa/common";

/**
 * 魏征服务接口
 * RFC 0042 Step 2.5: appState监察者
 *
 * 职责定位：
 * - ✅ UI层的appState业务接口（UI通过useWeiZheng访问）
 * - ✅ 管理应用运行时状态（folderTree + currentFolder + lastOpenedFolder）
 * - ✅ 接收李世民圣旨，协调appState更新
 * - ✅ 通过启奏向李世民汇报更新结果
 * - ✅ 委托房玄龄访问AppStateStore（不直接持有状态）
 * - ✅ 对接司命引擎进行持久化
 *
 * 架构原则：
 * - UI组件 → useWeiZheng() → 魏征 → 房玄龄 → AppStateStore
 * - UI组件永远不知道房玄龄的存在
 * - 业务层返回原始数据，UI层用computed做转换
 * - Getter用于查询，方法用于CRUD操作
 *
 * 历史背景：
 * 魏征，唐朝著名谏臣，以直言进谏、监察朝政著称
 * 在架构中负责监察和管理应用运行时状态
 */
export interface IWeiZhengService {
    /**
     * 服务名称（IService接口要求）
     */
    readonly name: string;

    /**
     * 文件夹树（只读属性）
     * 返回原始FolderNode[]数组，UI层使用computed做转换
     *
     * @example
     * // 业务层：返回原始数据
     * const weiZheng = useWeiZheng();
     * const tree = weiZheng.folderTree;  // FolderNode[]
     *
     * // UI层：使用computed做转换
     * const flattenedTree = computed(() =>
     *     flattenFolderTree(weiZheng.folderTree)
     * );
     */
    readonly folderTree: FolderNode[];

    /**
     * 当前文件夹路径（只读属性）
     * @example
     * const weiZheng = useWeiZheng();
     * const current = weiZheng.currentFolder;  // "/path/to/folder"
     */
    readonly currentFolder: string;

    /**
     * 最后打开的文件夹路径（只读属性）
     * @example
     * const weiZheng = useWeiZheng();
     * const last = weiZheng.lastOpenedFolder;  // "/path/to/last"
     */
    readonly lastOpenedFolder: string;

    /**
     * 文件夹树节点数量（只读属性）
     * @example
     * const weiZheng = useWeiZheng();
     * const count = weiZheng.folderTreeNodeCount;  // 42
     */
    readonly folderTreeNodeCount: number;

    /**
     * 初始化应用状态（应用启动时调用）
     * 从天界（司命引擎）恢复持久化的appState
     *
     * CRUD分类：Read操作
     */
    initializeAppState(): Promise<void>;

    /**
     * 添加文件夹路径到树
     * ✅ RFC 0042 Step 2.5: 魏征负责树的构建逻辑（使用buildDataNode）
     *
     * CRUD分类：Update操作
     * @param folderPath 文件夹路径
     * @example
     * const weiZheng = useWeiZheng();
     * await weiZheng.addFolderPath("/path/to/new/folder");
     */
    addFolderPath(folderPath: string): Promise<void>;

    /**
     * 从树中移除文件夹路径
     * ✅ RFC 0042 Step 2.5: 魏征负责树的清理逻辑（使用cleanDataNode）
     *
     * CRUD分类：Update操作
     * @param folderPath 文件夹路径
     * @example
     * const weiZheng = useWeiZheng();
     * await weiZheng.removeFolderPath("/path/to/old/folder");
     */
    removeFolderPath(folderPath: string): Promise<void>;

    /**
     * 更新文件夹树（直接替换）
     * 通过启奏-圣旨系统向天界发送update_folder_tree命令
     *
     * @deprecated ✅ RFC 0042 Step 2.5: 推荐使用 addFolderPath() 或 removeFolderPath()
     * CRUD分类：Update操作
     * @param tree 新的文件夹树
     */
    updateFolderTree(tree: FolderNode[]): Promise<void>;

    /**
     * 切换当前文件夹
     * 更新currentFolder和lastOpenedFolder
     *
     * CRUD分类：Update操作
     * @param folderPath 文件夹路径
     */
    switchFolder(folderPath: string): Promise<void>;
}

/**
 * 魏征服务注入令牌
 */
export const WEI_ZHENG_TOKEN: InjectionKey<IWeiZhengService> = Symbol("WeiZhengService");
