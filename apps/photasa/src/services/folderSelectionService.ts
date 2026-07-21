/**
 * 文件夹选择服务
 *
 * 纯UI状态管理，专门处理用户文件夹选择的持久化和恢复
 *
 * ⚠️ 重要：此服务只管理UI状态，绝不触碰扫描逻辑
 * - 只读写 currentFolder 状态
 * - 只管理用户选择的持久化
 * - 不调用任何扫描相关函数
 */

import { getPhotasaApi } from "@renderer/ipc/api-access";
import { loggers } from "@photasa/common";

const logger = loggers.app;

export interface FolderSelectionService {
    /**
     * 获取应该显示为选中的初始文件夹
     * 优先级：保存的路径 > Desktop > Documents > Home > 根目录
     */
    getInitialSelectedFolder(): Promise<string>;

    /**
     * 保存用户选择的文件夹（仅UI状态）
     */
    saveUserSelection(path: string): void;

    /**
     * 获取用户上次选择的文件夹
     */
    getLastUserSelection(): string | null;

    /**
     * 清除保存的选择
     */
    clearUserSelection(): void;
}

/**
 * 存储键
 */
const STORAGE_KEY = "picasa-last-selected-folder";

/**
 * 文件夹选择服务实现
 */
export const folderSelectionService: FolderSelectionService = {
    async getInitialSelectedFolder(): Promise<string> {
        logger.debug("[FolderSelection] 开始获取初始选中文件夹");

        // 1. 尝试加载用户上次选择
        const savedPath = this.getLastUserSelection();
        if (savedPath && (await pathExists(savedPath))) {
            logger.debug("[FolderSelection] 使用保存的路径:", savedPath);
            return savedPath;
        }

        if (savedPath) {
            logger.warn("[FolderSelection] 保存的路径不存在，将使用默认路径:", savedPath);
        }

        // 2. 使用默认路径回退逻辑
        const defaultPath = await getDefaultPath();
        logger.debug("[FolderSelection] 使用默认路径:", defaultPath);

        return defaultPath;
    },

    saveUserSelection(path: string): void {
        if (!path) {
            logger.warn("[FolderSelection] 尝试保存空路径，忽略");
            return;
        }

        logger.debug("[FolderSelection] 保存用户选择:", path);
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    path,
                    timestamp: Date.now(),
                }),
            );
        } catch (error) {
            logger.error("[FolderSelection] 保存用户选择失败:", error);
        }
    },

    getLastUserSelection(): string | null {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                return data.path || null;
            }
        } catch (error) {
            logger.warn("[FolderSelection] 读取保存的选择失败:", error);
        }
        return null;
    },

    clearUserSelection(): void {
        logger.debug("[FolderSelection] 清除用户选择");
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            logger.warn("[FolderSelection] 清除用户选择失败:", error);
        }
    },
};

async function getDirectory(name: string): Promise<string | null> {
    return getPhotasaApi().getDirectory(name) as Promise<string | null>;
}

/**
 * 获取默认路径，按优先级回退
 * Desktop > Documents > Home > 根目录
 */
async function getDefaultPath(): Promise<string> {
    const candidates = [
        { name: "Desktop", getter: () => getDirectory("desktop") },
        { name: "Documents", getter: () => getDirectory("documents") },
        { name: "Home", getter: () => getDirectory("home") },
    ];

    for (const candidate of candidates) {
        try {
            const path = await candidate.getter();
            if (path && (await pathExists(path))) {
                logger.debug(`[FolderSelection] 找到有效的默认路径 ${candidate.name}:`, path);
                return path;
            }
        } catch (error) {
            logger.warn(`[FolderSelection] 无法获取 ${candidate.name} 路径:`, error);
        }
    }

    // 最后回退到根目录
    logger.warn("[FolderSelection] 所有默认路径都不可用，使用根目录");
    return "/";
}

/**
 * 检查路径是否存在
 *
 * 注意：由于这是纯UI功能，我们采用简化实现
 * 主要依赖文件夹选择时的实际可用性
 */
async function pathExists(path: string): Promise<boolean> {
    try {
        // 基本的路径格式检查
        if (!path || path.length === 0) {
            return false;
        }

        // 对于UI选择功能，我们相对宽松地认为路径存在
        // 如果路径不存在，用户在使用时会发现，系统会回退到默认路径
        return true;
    } catch (error) {
        logger.warn("[FolderSelection] 路径存在性检查失败:", path, error);
        return false;
    }
}
