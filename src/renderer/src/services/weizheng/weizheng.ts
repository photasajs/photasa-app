import { IService } from "@/interfaces/service.interface";
import { IWeiZhengService } from "@renderer/interfaces/wei-zheng.interface";
import type { Shengzhi } from "@renderer/interfaces/shengzhi.interface";
import type { Qizou } from "@renderer/interfaces/qizou.interface";
import type { Emitter } from "mitt";
import { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    GUANYUAN_NAMES,
    type Zouzhe,
} from "@renderer/interfaces/fang-xuan-ling.interface";
import type { FolderNode } from "@common/folder-types";
import { loggers } from "@common/logger";
import { addRoot, removeRoot, addFolderToTree, cleanDataNode } from "@renderer/utils/folder-tree";
import { QizouMatters, ShengzhiCommands } from "@renderer/constants/qizou-shengzhi-commands";
import { deepClone } from "@common/object/clone";

const logger = loggers.weizheng;

/**
 * 魏征（WeiZheng）- appState监察者
 * RFC 0042 Step 2.5: 应用状态管理服务
 *
 * 职责：
 * 1. 管理应用运行时状态（folderTree + currentFolder + lastOpenedFolder）
 * 2. 接收李世民圣旨（update_folder_tree / switch_folder）
 * 3. 创建奏折发送给房玄龄，触发天界工作流
 * 4. 通过FangXuanLing.appState Accessor访问状态（不维护本地状态）
 * 5. 通过qizou启奏向李世民汇报结果
 *
 * **架构原则**（RFC 0042 Step 2.5）：
 * - ✅ 不维护本地状态 - 所有状态访问委托给FangXuanLing.appState Accessor
 * - ✅ 发送奏折触发天界工作流 - 更新通过司命引擎持久化
 * - ✅ 房玄龄负责Store Automation自动同步（matter-sync.yml）
 *
 * **协调链路**：
 * UI组件 → 魏征 → 发送奏折给房玄龄 → 袁天罡 → 天枢工作流 →
 * 司命引擎执行持久化 → 天枢返回结果 → 房玄龄Store Automation自动同步
 *
 * 历史背景：
 * 魏征，唐朝著名谏臣，以直言进谏、监察朝政著称
 * 在架构中负责监察和管理应用运行时状态
 *
 * @class WeiZhengService
 * @implements {IService}
 * @since RFC 0042 Step 2.5
 * @date 2025-10-30
 */
export class WeiZhengService implements IService, IWeiZhengService {
    /**
     * 启奏事件总线
     * 用于向李世民发送qizou启奏
     */
    private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;

    constructor(private fangXuanLingService: IFangXuanLingService) {
        logger.info("🏛️ 魏征上朝，负责监察应用状态");
    }

    /**
     * IService接口实现 - 服务名称标识
     */
    get name(): string {
        return "魏征";
    }

    /**
     * 文件夹树（只读属性）
     * 通过房玄龄Accessor访问AppStateStore
     */
    get folderTree(): FolderNode[] {
        return this.fangXuanLingService.appState.folderTree;
    }

    /**
     * 当前文件夹路径（只读属性）
     */
    get currentFolder(): string {
        return this.fangXuanLingService.appState.currentFolder;
    }

    /**
     * 最后打开的文件夹路径（只读属性）
     */
    get lastOpenedFolder(): string {
        return this.fangXuanLingService.appState.lastOpenedFolder;
    }

    /**
     * 文件夹树节点数量（只读属性）
     */
    get folderTreeNodeCount(): number {
        // 🔧 防御性编程：确保folderTree不为undefined或null
        const tree = this.folderTree;
        if (!tree || !Array.isArray(tree)) {
            return 0;
        }

        const countNodes = (nodes: FolderNode[]): number => {
            // 🔧 防御性编程：确保nodes不为undefined或null
            if (!nodes || !Array.isArray(nodes)) {
                return 0;
            }

            let count = nodes.length;
            for (const node of nodes) {
                if (node?.children) {
                    count += countNodes(node.children);
                }
            }
            return count;
        };
        return countNodes(tree);
    }

    /**
     * IService接口实现 - 设置圣旨接收通道（单向）
     * @param port MessageChannel的port2端，用于接收圣旨
     */
    setShengzhiPort(port: MessagePort): void {
        logger.info("🏛️ 魏征建立圣旨接收通道");

        // 监听圣旨
        port.onmessage = async (event: MessageEvent): Promise<void> => {
            const shengzhi: Shengzhi = event.data;
            logger.info(`🏛️ 魏征奉旨: ${shengzhi.command} [圣旨ID: ${shengzhi.id}]`);
            logger.debug("🏛️ 魏征奉旨详情:", shengzhi);

            // 处理圣旨
            await this.processShengzhi(shengzhi);
        };
    }

    /**
     * 设置启奏事件总线
     * @param qizouBus mitt事件总线，用于发送qizou启奏
     */
    setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void {
        logger.info("🏛️ 魏征建立启奏通道");
        this._qizouBus = qizouBus;
    }

    /**
     * 处理圣旨（核心状态机）
     *
     * @param shengzhi 圣旨内容
     *
     * @description
     * 状态转换图：
     * ```
     *        收到圣旨
     *           ↓
     *    ┌─────────────┐
     *    │ 解析command │
     *    └─────────────┘
     *           ↓
     *    ┌──────┴──────────┐
     *    │                 │
     * update_folder_tree  switch_folder
     *    │                 │
     *    ↓                 ↓
     * 更新文件夹树       切换当前文件夹
     *    │                 │
     *    ↓                 ↓
     * 发送奏折          发送奏折
     *    │                 │
     *    ↓                 ↓
     * 启奏成功          启奏成功
     * ```
     */
    private async processShengzhi(shengzhi: Shengzhi): Promise<void> {
        try {
            switch (shengzhi.command) {
                case ShengzhiCommands.ADD_ROOT:
                    await this.handleAddRoot(shengzhi);
                    break;
                case ShengzhiCommands.REMOVE_ROOT:
                    await this.handleRemoveRoot(shengzhi);
                    break;
                case ShengzhiCommands.FOLDER_DISCOVERED:
                    await this.handleFolderDiscovered(shengzhi);
                    break;
                case ShengzhiCommands.FOLDER_REMOVED:
                    await this.handleFolderRemoved(shengzhi);
                    break;
                case ShengzhiCommands.ADD_PATHS:
                    await this.handleAddPaths(shengzhi);
                    break;
                case ShengzhiCommands.UPDATE_FOLDER_TREE:
                    await this.handleUpdateFolderTree(shengzhi);
                    break;
                case ShengzhiCommands.CHECK_AND_ADD_PATH:
                    await this.handleCheckAndAddPath(shengzhi);
                    break;
                case "switch_folder":
                    await this.handleSwitchFolder(shengzhi);
                    break;
                default:
                    logger.warn(`🏛️ 魏征收到未知圣旨命令: ${shengzhi.command}`);
                    this.emitQizou("shengzhi_unknown", {
                        shengzhiId: shengzhi.id,
                        command: shengzhi.command,
                        error: "未知圣旨命令",
                    });
            }
        } catch (error) {
            logger.error(`🏛️ 魏征处理圣旨失败: ${shengzhi.command}`, error);
            this.emitQizou("shengzhi_failed", {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * 处理add_root圣旨
     * 用户主动添加监控路径，创建根节点
     */
    private async handleAddRoot(shengzhi: Shengzhi): Promise<void> {
        const rootPath = shengzhi.content?.rootPath as string;

        if (!rootPath) {
            logger.warn("🏛️ 魏征：add_root圣旨参数无效，rootPath必须提供");
            this.emitQizou("shengzhi_failed", {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                error: "rootPath参数无效",
            });
            return;
        }

        logger.info(`🏛️ 魏征：添加根节点到树：${rootPath}`);

        // 1. 获取当前文件夹树
        const currentTree = this.folderTree;

        // 2. 深拷贝避免直接修改store
        const newTree: FolderNode[] = deepClone(currentTree);

        // 3. 使用addRoot添加根节点
        addRoot(newTree, rootPath);

        // 4. 发送奏折给房玄龄，触发天界持久化
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
            content: { tree: newTree },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        await this.fangXuanLingService.processZouzhe(zouzhe);

        logger.info(`🏛️ 魏征：根节点添加完成：${rootPath}`);
    }

    /**
     * 处理remove_root圣旨
     * 用户主动移除监控路径，删除根节点
     */
    private async handleRemoveRoot(shengzhi: Shengzhi): Promise<void> {
        const rootPath = shengzhi.content?.rootPath as string;

        if (!rootPath) {
            logger.warn("🏛️ 魏征：remove_root圣旨参数无效，rootPath必须提供");
            this.emitQizou("shengzhi_failed", {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                error: "rootPath参数无效",
            });
            return;
        }

        logger.info(`🏛️ 魏征：从树中移除根节点：${rootPath}`);

        // 1. 获取当前文件夹树
        const currentTree = this.folderTree;

        // 2. 深拷贝避免直接修改store
        const newTree: FolderNode[] = deepClone(currentTree);

        // 3. 使用removeRoot移除根节点
        removeRoot(newTree, rootPath);

        // 4. 发送奏折给房玄龄，触发天界持久化
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
            content: { tree: newTree },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        await this.fangXuanLingService.processZouzhe(zouzhe);

        logger.info(`🏛️ 魏征：根节点移除完成：${rootPath}`);
    }

    /**
     * 处理folder_discovered圣旨
     * 添加文件夹到树
     */
    private async handleFolderDiscovered(shengzhi: Shengzhi): Promise<void> {
        const folderPath = shengzhi.content?.folderPath as string;
        await this.addFolderPath(folderPath);
    }

    /**
     * 处理check_and_add_path圣旨
     * ✅ 智能检查并添加路径：根据路径在树中的状态决定添加根节点或子节点
     *
     * 逻辑：
     * 1. 如果路径已经是根节点 → 静默跳过（避免重复）
     * 2. 如果路径在某个根节点下 → 调用 addFolderPath() 添加子节点
     * 3. 如果路径不在树中 → 调用 handleAddRoot() 添加根节点
     *
     * 使用场景：
     * - 扫描任务添加后，需要确保路径在文件夹树中
     * - 避免重复添加，同时正确处理根节点和子节点
     */
    private async handleCheckAndAddPath(shengzhi: Shengzhi): Promise<void> {
        const folderPath = shengzhi.content?.folderPath as string;

        if (!folderPath || typeof folderPath !== "string") {
            logger.warn("🏛️ 魏征：check_and_add_path圣旨参数无效，folderPath必须提供");
            this.emitQizou("shengzhi_failed", {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                error: "folderPath参数无效",
            });
            return;
        }

        logger.info(`🏛️ 魏征：智能检查并添加路径：${folderPath}`);

        // 1. 获取当前文件夹树
        const currentTree = this.folderTree;

        // 2. 检查路径是否已经是根节点
        const isRoot = currentTree.some((node) => node.key === folderPath);
        if (isRoot) {
            logger.debug(`🏛️ 魏征：路径已是根节点，跳过添加：${folderPath}`);
            this.emitQizou(QizouMatters.FOLDER_DISCOVERED_HANDLED, {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                result: { folderPath, action: "skipped", reason: "already_root" },
            });
            return;
        }

        // 3. 检查路径是否在某个根节点下（路径以根节点key开头）
        const parentRoot = currentTree.find((node) => {
            const rootKey = node.key as string;
            // 使用规范化路径比较，避免大小写和斜杠问题
            const normalizedPath = folderPath.replace(/\\/g, "/");
            const normalizedRoot = rootKey.replace(/\\/g, "/");
            return (
                normalizedPath.startsWith(normalizedRoot + "/") || normalizedPath === normalizedRoot
            );
        });

        if (parentRoot) {
            // 路径在某个根节点下，添加子节点
            logger.info(
                `🏛️ 魏征：路径在根节点下，添加子节点：${folderPath}（父节点：${parentRoot.key}）`,
            );
            await this.addFolderPath(folderPath);
            this.emitQizou(QizouMatters.FOLDER_DISCOVERED_HANDLED, {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                result: { folderPath, action: "added_as_child", parentRoot: parentRoot.key },
            });
            return;
        }

        // 4. 路径不在树中，添加根节点
        logger.info(`🏛️ 魏征：路径不在树中，添加根节点：${folderPath}`);
        await this.handleAddRoot({
            ...shengzhi,
            content: { ...shengzhi.content, rootPath: folderPath },
        });
        this.emitQizou(QizouMatters.FOLDER_DISCOVERED_HANDLED, {
            shengzhiId: shengzhi.id,
            command: shengzhi.command,
            result: { folderPath, action: "added_as_root" },
        });
    }

    /**
     * 处理folder_removed圣旨
     * 从树中移除文件夹
     */
    private async handleFolderRemoved(shengzhi: Shengzhi): Promise<void> {
        const folderPath = shengzhi.content?.folderPath as string;
        await this.removeFolderPath(folderPath);
    }

    /**
     * 处理add_paths圣旨
     * 批量添加文件夹到树
     */
    private async handleAddPaths(shengzhi: Shengzhi): Promise<void> {
        const paths = shengzhi.content?.paths as string[];

        // 🔧 防御性编程：确保paths是有效数组
        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            logger.warn("🏛️ 魏征：add_paths圣旨参数无效，paths必须是非空数组");
            this.emitQizou("shengzhi_failed", {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                error: "paths参数无效",
            });
            return;
        }

        logger.info(`🏛️ 魏征：批量添加${paths.length}个路径到树`);

        // ✅ 使用for...of确保异步操作按顺序完成
        for (const path of paths) {
            await this.addFolderPath(path);
        }

        logger.info(`🏛️ 魏征：批量添加完成，共${paths.length}个路径`);
    }

    /**
     * 处理update_folder_tree圣旨
     * 更新整个文件夹树
     */
    private async handleUpdateFolderTree(shengzhi: Shengzhi): Promise<void> {
        const tree = shengzhi.content?.tree as FolderNode[];

        if (!tree || !Array.isArray(tree)) {
            logger.error("🏛️ 魏征：update_folder_tree圣旨参数无效，tree必须是数组");
            this.emitQizou(QizouMatters.SHENGZHI_FAILED, {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                error: "tree参数无效",
            });
            return;
        }

        logger.info(`🏛️ 魏征：准备更新文件夹树，共${tree.length}个节点`);

        // 发送奏折给房玄龄，触发天界工作流
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
            content: { tree },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        await this.fangXuanLingService.processZouzhe(zouzhe);

        // 启奏成功
        this.emitQizou(QizouMatters.UPDATE_FOLDER_TREE_HANDLED, {
            shengzhiId: shengzhi.id,
            command: shengzhi.command,
            result: { treeNodeCount: tree.length },
        });

        logger.info("🏛️ 魏征：更新文件夹树奏折已呈递，等待天界确认");
    }

    /**
     * 处理switch_folder圣旨
     * 切换当前文件夹
     */
    private async handleSwitchFolder(shengzhi: Shengzhi): Promise<void> {
        const folderPath = shengzhi.content?.folderPath as string;

        if (!folderPath || typeof folderPath !== "string") {
            logger.error("🏛️ 魏征：switch_folder圣旨参数无效，folderPath必须是字符串");
            this.emitQizou("shengzhi_failed", {
                shengzhiId: shengzhi.id,
                command: shengzhi.command,
                error: "folderPath参数无效",
            });
            return;
        }

        logger.info(`🏛️ 魏征：准备切换到文件夹：${folderPath}`);

        // 发送奏折给房玄龄，触发天界工作流
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.SWITCH_FOLDER,
            content: { folderPath },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        await this.fangXuanLingService.processZouzhe(zouzhe);

        // 启奏成功
        this.emitQizou(QizouMatters.FOLDER_DISCOVERED_HANDLED, {
            shengzhiId: shengzhi.id,
            command: shengzhi.command,
            result: { folderPath },
        });

        logger.info("🏛️ 魏征：切换文件夹奏折已呈递，等待天界确认");
    }

    /**
     * 发送启奏给李世民
     */
    private emitQizou(matter: string, content: Record<string, unknown>): void {
        if (!this._qizouBus) {
            logger.warn("🏛️ 魏征：启奏通道未建立，无法发送启奏");
            return;
        }

        const qizou: Qizou = {
            matter,
            content,
            from: this.name,
            timestamp: Date.now(),
            metadata: { type: "report" },
        };

        logger.debug("🏛️ 魏征启奏:", qizou);
        this._qizouBus.emit("qizou", qizou);
    }

    /**
     * 初始化应用状态（应用启动时调用）
     * 从天界（司命引擎）恢复持久化的appState
     */
    async initializeAppState(): Promise<void> {
        logger.info("🏛️ 魏征：开始初始化应用状态");

        try {
            // 发送奏折给房玄龄，触发restore_app_state工作流
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.WEI_ZHENG,
                matter: ZOUZHE_MATTERS.RESTORE_APP_STATE,
                content: {},
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.URGENT,
            };

            await this.fangXuanLingService.processZouzhe(zouzhe);

            logger.info("🏛️ 魏征：应用状态恢复奏折已呈递朝廷，等待天界确认");
        } catch (error) {
            logger.error("🏛️ 魏征：初始化应用状态失败", error);
            throw error;
        }
    }

    /**
     * 添加文件夹路径到树（公开方法）
     * ✅ RFC 0042 Step 2.5: 魏征负责树的构建逻辑
     *
     * @param folderPath 文件夹路径
     * @description
     * 使用buildDataNode构建树结构，然后发送奏折触发天界持久化
     */
    async addFolderPath(folderPath: string): Promise<void> {
        if (!folderPath || typeof folderPath !== "string") {
            throw new Error("folderPath must be a non-empty string");
        }

        logger.info(`🏛️ 魏征：添加文件夹路径到树：${folderPath}`);

        // 1. 获取当前文件夹树
        const currentTree = this.folderTree;

        // 2. 深拷贝避免直接修改store
        const newTree: FolderNode[] = deepClone(currentTree);

        // 3. 使用addFolderToTree构建树结构
        addFolderToTree(newTree, {
            path: folderPath,
            thumbnail: "",
            isVideo: false,
        });

        // 4. 发送奏折给房玄龄，触发天界持久化
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
            content: { tree: newTree },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        await this.fangXuanLingService.processZouzhe(zouzhe);

        logger.info("🏛️ 魏征：文件夹树已更新并持久化");
    }

    /**
     * 从树中移除文件夹路径（公开方法）
     * ✅ RFC 0042 Step 2.5: 魏征负责树的清理逻辑
     *
     * @param folderPath 文件夹路径
     * @description
     * 使用cleanDataNode清理树结构，然后发送奏折触发天界持久化
     */
    async removeFolderPath(folderPath: string): Promise<void> {
        if (!folderPath || typeof folderPath !== "string") {
            throw new Error("folderPath must be a non-empty string");
        }

        logger.info(`🏛️ 魏征：从树中移除文件夹路径：${folderPath}`);

        // 1. 获取当前文件夹树
        const currentTree = this.folderTree;

        // 2. 深拷贝避免直接修改store
        const newTree: FolderNode[] = deepClone(currentTree);

        // 3. 使用cleanDataNode清理树结构
        cleanDataNode(newTree, {
            path: folderPath,
            thumbnail: "",
            isVideo: false,
        });

        // 4. 发送奏折给房玄龄，触发天界持久化
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
            content: { tree: newTree },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        await this.fangXuanLingService.processZouzhe(zouzhe);

        logger.info("🏛️ 魏征：文件夹树已清理并持久化");
    }

    /**
     * 更新文件夹树（公开方法）
     * UI层调用此方法直接更新完整的文件夹树
     *
     * @deprecated 推荐使用 addFolderPath() 或 removeFolderPath()
     */
    async updateFolderTree(tree: FolderNode[]): Promise<void> {
        // 🔧 防御性编程：确保tree是有效数组
        if (!tree || !Array.isArray(tree)) {
            throw new Error("tree must be an array");
        }

        logger.info(`🏛️ 魏征：UI请求更新文件夹树，共${tree.length}个节点`);

        // 发送奏折给房玄龄
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
            content: { tree },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        await this.fangXuanLingService.processZouzhe(zouzhe);

        logger.info("🏛️ 魏征：文件夹树更新请求已提交");
    }

    /**
     * 切换当前文件夹（公开方法）
     * UI层调用此方法切换文件夹
     */
    async switchFolder(folderPath: string): Promise<void> {
        logger.info(`🏛️ 魏征：UI请求切换到文件夹：${folderPath}`);

        if (!folderPath || typeof folderPath !== "string") {
            throw new Error("folderPath must be a non-empty string");
        }

        // 发送奏折给房玄龄
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.WEI_ZHENG,
            matter: ZOUZHE_MATTERS.SWITCH_FOLDER,
            content: { folderPath },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        await this.fangXuanLingService.processZouzhe(zouzhe);

        logger.info("🏛️ 魏征：切换文件夹请求已提交");
    }
}
