/**
 * 房玄龄宰相服务Composable - 宰相府政务接口
 * 为界面组件提供统一的数据管理接口，实现依赖注入模式
 *
 * 神话背景：
 * 房玄龄作为唐朝名相，以善于统筹政务、协调各部门著称
 * 在Photasa系统中，房玄龄化身人界数据管理宰相，通过民间Vue的Composable模式
 * 为各界面组件提供统一的数据访问接口，确保政务有序进行
 *
 * 核心功能：
 * - 依赖注入：通过民间Vue的inject机制获取房玄龄服务实例
 * - 统一接口：为组件提供标准化的数据管理方法
 * - 错误处理：确保服务可用性，提供友好的错误提示
 * - 日志记录：记录服务调用过程，便于问题排查
 */

import { inject } from "vue";
import { FANG_XUAN_LING_TOKEN } from "../interfaces/fang-xuan-ling.interface";
import type { IFangXuanLingService } from "../interfaces/fang-xuan-ling.interface";
import { loggers } from "@common/logger";

const logger = loggers.fangxuanling;

/**
 * 房玄龄宰相服务Composable
 * 为界面组件提供统一的数据管理接口
 */
export function useFangXuanLing(): IFangXuanLingService {
    const fangXuanLingService = inject<IFangXuanLingService>(FANG_XUAN_LING_TOKEN);

    if (!fangXuanLingService) {
        logger.error("房玄龄宰相服务未找到，请确保已在App.vue中提供");
        throw new Error("FangXuanLingService not provided. Make sure to provide it in App.vue");
    }

    logger.debug("获取房玄龄宰相服务成功");
    return fangXuanLingService;
}
