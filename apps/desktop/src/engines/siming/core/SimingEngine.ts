/**
 * 司命引擎 - appState持久化管理引擎
 * RFC 0042 Step 2.5: 专用的appState持久化引擎
 *
 * 职责：
 * 1. 持久化appState到 ~/.photasa/appState/
 * 2. 恢复appState
 * 3. 提供appState的CRUD操作
 *
 * 历史背景：
 * 司命，道教神祇，主管生命寿算，负责记录和管理人间寿命
 * 在架构中负责管理和持久化应用运行时状态
 */

import { join } from "path";
import { homedir } from "os";
import { writeFile, readFile, mkdir } from "fs/promises";
import { loggers } from "@common/logger";
import type { FolderNode } from "@common/folder-types";

const logger = loggers.siming;

/**
 * AppState数据结构
 */
export interface AppState {
    /** 版本 */
    version: string;
    /** 时间戳 */
    timestamp: number;
    /** 文件夹树结构 */
    folderTree: FolderNode[];
    /** 当前文件夹 */
    currentFolder: string;
    /** 最后打开的文件夹 */
    lastOpenedFolder: string;
}

/**
 * 司命引擎类
 */
export class SimingEngine {
    private appDataPath: string;
    private appStatePath: string;
    private photasaPath: string;

    constructor() {
        this.appDataPath = join(homedir(), ".photasa");
        this.appStatePath = join(this.appDataPath, "appState");
        this.photasaPath = join(this.appStatePath, "photasa.json");
    }

    /**
     * 初始化引擎
     */
    async initialize(): Promise<void> {
        try {
            logger.info("🌌 司命星君开坛，准备管理应用状态");
            await mkdir(this.appStatePath, { recursive: true });
            logger.info("🌌 司命星君归位，应用状态库已就绪");
        } catch (error) {
            logger.error("🌌 天劫降临：司命星君初始化失败", error);
            throw error;
        }
    }

    /**
     * 关闭引擎
     */
    async shutdown(): Promise<void> {
        logger.info("🌌 司命星君归隐，应用状态封存");
    }

    /**
     * 🔧 内部方法：读取现有AppState
     * 如果文件不存在或损坏，返回默认空状态
     */
    private async readAppState(): Promise<AppState> {
        try {
            const data = await readFile(this.photasaPath, "utf-8");
            const parsed = JSON.parse(data) as AppState;

            if (!parsed.folderTree) {
                logger.warn("🌌 【警示】状态文件格式损坏，返回空白状态");
                return {
                    version: "1.0",
                    timestamp: Date.now(),
                    folderTree: [],
                    currentFolder: "",
                    lastOpenedFolder: "",
                };
            }

            return {
                version: parsed.version,
                timestamp: parsed.timestamp,
                folderTree: parsed.folderTree,
                currentFolder: parsed.currentFolder || "",
                lastOpenedFolder: parsed.lastOpenedFolder || "",
            };
        } catch (error) {
            return {
                version: "1.0",
                timestamp: Date.now(),
                folderTree: [],
                currentFolder: "",
                lastOpenedFolder: "",
            };
        }
    }

    /**
     * 🔧 内部方法：写入完整AppState
     * 使用原子写入保证数据一致性
     */
    private async writeAppState(appState: AppState): Promise<void> {
        try {
            // 确保appState目录存在
            await mkdir(this.appStatePath, { recursive: true });

            const data = JSON.stringify(
                {
                    version: "1.0",
                    timestamp: Date.now(),
                    folderTree: appState.folderTree,
                    currentFolder: appState.currentFolder,
                    lastOpenedFolder: appState.lastOpenedFolder,
                },
                null,
                2,
            );

            await writeFile(this.photasaPath, data, "utf-8");
        } catch (error) {
            logger.error("🌌 天劫降临：写入状态文件失败", error);
            throw error;
        }
    }

    /**
     * ✅ RFC 0042 Step 2.5: 持久化文件夹树
     *
     * 职责：更新folderTree字段到photasaState.json
     * 策略：读取现有状态 → 更新folderTree → 写回完整状态
     * 路径：~/.photasa/appState/photasaState.json
     * 日志风格：🎨 画图之术（绘制卷轴）
     */
    async persistFolderTree(tree: FolderNode[]): Promise<void> {
        try {
            // 防御性检查：确保tree是数组
            if (!Array.isArray(tree)) {
                logger.error(`🌌 天劫降临：画图之术收到非法仙令，类型=${typeof tree}`, {
                    treeValue: tree,
                });
                throw new Error(`persistFolderTree expects array, got ${typeof tree}`);
            }

            logger.debug(`🎨 画图之术：将folder tree绘制成卷轴，共${tree.length}个节点`);

            // ✅ Step 1: 读取现有状态
            const currentState = await this.readAppState();

            // ✅ Step 2: 合并更新folderTree
            const updatedState: AppState = {
                ...currentState,
                folderTree: tree,
            };

            // ✅ Step 3: 写回完整状态
            await this.writeAppState(updatedState);

            logger.info(`🎨 画图大功告成，${tree.length}个节点已绘制成卷轴`);
        } catch (error) {
            logger.error("🌌 天劫降临：画图之术功败垂成", error);
            throw error;
        }
    }

    /**
     * ✅ RFC 0042 Step 2.5: 恢复文件夹树
     *
     * 职责：从photasaState.json恢复文件夹树
     * 路径：~/.photasa/appState/photasaState.json
     * 日志风格：📖 读图之术（读取卷轴）
     */
    async restoreFolderTree(): Promise<FolderNode[]> {
        try {
            logger.debug("📖 读图之术：从卷轴读取folder tree");

            const appState = await this.readAppState();

            logger.info(`📖 读图大功告成，从卷轴读取${appState.folderTree.length}个节点`);
            return appState.folderTree;
        } catch (error) {
            logger.error("🌌 天劫降临：读图之术功败垂成", error);
            return [];
        }
    }

    /**
     * ✅ RFC 0042 Step 2.5: 清空文件夹树
     *
     * 职责：清空photasaState.json中的folderTree字段
     * 策略：读取现有状态 → 清空folderTree → 写回完整状态
     * 路径：~/.photasa/appState/photasaState.json
     * 日志风格：🧹 净化之术（清除卷轴）
     */
    async clearFolderTree(): Promise<void> {
        try {
            logger.debug("🧹 净化之术：清除folder tree卷轴");

            // ✅ Step 1: 读取现有状态
            const currentState = await this.readAppState();

            // ✅ Step 2: 清空folderTree
            const updatedState: AppState = {
                ...currentState,
                folderTree: [],
            };

            // ✅ Step 3: 写回完整状态
            await this.writeAppState(updatedState);

            logger.info("🧹 净化大功告成，空白图册已铸成");
        } catch (error) {
            logger.error("🌌 天劫降临：净化之术功败垂成", error);
            throw error;
        }
    }

    /**
     * ✅ RFC 0042 Step 2.5: 恢复完整应用状态
     *
     * 职责：恢复完整的AppState对象（包括folderTree, currentFolder等）
     * 日志风格：📚 总览之术（恢复完整状态）
     */
    async restoreAppState(): Promise<AppState> {
        try {
            logger.debug("📚 总览之术：恢复完整应用状态");

            const appState = await this.readAppState();

            logger.info("📚 总览大功告成，应用状态已全面恢复");
            return appState;
        } catch (error) {
            logger.error("🌌 天劫降临：总览之术功败垂成", error);
            return {
                version: "1.0",
                timestamp: Date.now(),
                folderTree: [],
                currentFolder: "",
                lastOpenedFolder: "",
            };
        }
    }

    /**
     * ✅ 持久化当前文件夹
     *
     * 职责：更新currentFolder字段到photasaState.json
     * 策略：读取现有状态 → 更新currentFolder → 写回完整状态
     */
    async persistCurrentFolder(folderPath: string): Promise<void> {
        try {
            logger.debug(`🎯 标记之术：标记当前文件夹=${folderPath}`);

            const currentState = await this.readAppState();

            const updatedState: AppState = {
                ...currentState,
                currentFolder: folderPath,
            };

            await this.writeAppState(updatedState);

            logger.info(`🎯 标记大功告成，当前文件夹已标记=${folderPath}`);
        } catch (error) {
            logger.error("🌌 天劫降临：标记之术功败垂成", error);
            throw error;
        }
    }

    /**
     * ✅ 持久化完整应用状态
     *
     * 职责：直接替换整个AppState
     * 策略：直接写入完整状态（无需读取）
     */
    async persistAppState(appState: AppState): Promise<void> {
        try {
            logger.debug("💾 封印之术：封印完整应用状态");

            await this.writeAppState(appState);

            logger.info("💾 封印大功告成，应用状态已全面封存");
        } catch (error) {
            logger.error("🌌 天劫降临：封印之术功败垂成", error);
            throw error;
        }
    }
}
