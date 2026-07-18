/**
 * 尉迟恭服务Composable - 扫描队列业务接口
 * 为界面组件提供统一的扫描队列管理接口，实现依赖注入模式
 *
 * 神话背景：
 * 尉迟恭作为唐朝开国功臣，以勇猛善战、忠诚可靠著称
 * 在Photasa系统中，尉迟恭化身扫描队列业务协调官，通过民间Vue的Composable模式
 * 为各界面组件提供统一的扫描队列访问接口，确保任务有序执行
 *
 * 核心功能：
 * - 依赖注入：通过民间Vue的inject机制获取尉迟恭服务实例
 * - 统一接口：为组件提供标准化的扫描队列管理方法
 * - 错误处理：确保服务可用性，提供友好的错误提示
 * - 日志记录：记录服务调用过程，便于问题排查
 *
 * @since RFC 0042 - 扫描队列架构重构
 */

import { inject } from "vue";
import { loggers } from "@photasa/common";
import { IXuanzangService, XUANZANG_TOKEN } from "@renderer/interfaces/xuan-zang.interface";

const logger = loggers.xuanzang;

/**
 * 玄奘法师服务Composable
 * 为界面组件提供统一的玄奘法师管理接口
 *
 * @returns 玄奘法师服务实例
 * @throws {Error} 如果服务未提供
 */
export function useXuanzang(): IXuanzangService {
    const xuanzangService = inject<IXuanzangService>(XUANZANG_TOKEN);

    if (!xuanzangService) {
        logger.error("🏛️ 玄奘法师不在府中，请确保朝廷已委任");
        throw new Error("XuanzangService not provided. Make sure to provide it in App.vue");
    }

    logger.debug("🏛️ 玄奘法师应召到府");
    return xuanzangService;
}
