/**
 * 魏征服务Composable - appState监察接口
 * RFC 0042 Step 2.5: 为界面组件提供统一的应用状态管理接口，实现依赖注入模式
 *
 * 神话背景：
 * 魏征作为唐朝著名谏臣，以直言进谏、监察朝政著称
 * 在Photasa系统中，魏征化身应用状态监察官，通过民间Vue的Composable模式
 * 为各界面组件提供统一的appState访问接口，确保状态管理有序可控
 *
 * 核心功能：
 * - 依赖注入：通过民间Vue的inject机制获取魏征服务实例
 * - 统一接口：为组件提供标准化的appState管理方法
 * - 错误处理：确保服务可用性，提供友好的错误提示
 * - 日志记录：记录服务调用过程，便于问题排查
 *
 * @since RFC 0042 Step 2.5
 */

import { inject } from "vue";
import { WEI_ZHENG_TOKEN } from "../interfaces/wei-zheng.interface";
import type { IWeiZhengService } from "../interfaces/wei-zheng.interface";
import { loggers } from "@photasa/common";

const logger = loggers.weizheng;

/**
 * 魏征服务Composable
 * 为界面组件提供统一的appState管理接口
 *
 * @returns 魏征服务实例
 * @throws {Error} 如果服务未提供
 *
 * @example
 * ```typescript
 * const weiZheng = useWeiZheng();
 * const folderTree = weiZheng.folderTree;
 * const currentFolder = weiZheng.currentFolder;
 * const nodeCount = weiZheng.folderTreeNodeCount;
 * await weiZheng.updateFolderTree(newTree);
 * await weiZheng.switchFolder('/path/to/folder');
 * ```
 */
export function useWeiZheng(): IWeiZhengService {
    const weiZhengService = inject<IWeiZhengService>(WEI_ZHENG_TOKEN);

    if (!weiZhengService) {
        logger.error("🏛️ 魏征大人不在府中，请确保朝廷已委任");
        throw new Error("WeiZhengService not provided. Make sure to provide it in App.vue");
    }

    logger.debug("🏛️ 魏征大人应召到府");
    return weiZhengService;
}
