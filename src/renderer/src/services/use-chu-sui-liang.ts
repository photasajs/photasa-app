/**
 * 褚遂良中书令服务Composable - 偏好设置管理接口
 * 为界面组件提供统一的偏好设置管理接口，实现依赖注入模式
 *
 * 神话背景：
 * 褚遂良，唐朝著名书法家、政治家，以中书令身份掌管文书政务
 * 在Photasa系统中，褚遂良化身人界偏好设置管理官，通过民间Vue的Composable模式
 * 为各界面组件提供统一的偏好设置访问接口，确保用户偏好统一管理
 *
 * 核心功能：
 * - 依赖注入：通过民间Vue的inject机制获取褚遂良服务实例
 * - 偏好管理：提供主题、语言等偏好设置的统一管理方法
 * - 奏折通信：封装与房玄龄的奏折通信细节
 * - 错误处理：确保服务可用性，提供友好的错误提示
 * - 日志记录：记录偏好设置变更过程，便于问题排查
 */

import { inject } from "vue";
import { CHU_SUI_LIANG_TOKEN } from "../interfaces/chu-sui-liang.interface";
import type { IChusuiliangService } from "../interfaces/chu-sui-liang.interface";
import { loggers } from "@common/logger";

const logger = loggers.chusuiliang;

/**
 * 褚遂良中书令服务Composable
 * 为界面组件提供统一的偏好设置管理接口
 */
export function useChuSuiLiang(): IChusuiliangService {
    const chuSuiLiangService = inject<IChusuiliangService>(CHU_SUI_LIANG_TOKEN);

    if (!chuSuiLiangService) {
        logger.error("褚遂良中书令服务未找到，请确保已在App.vue中提供");
        throw new Error("ChuSuiLiangService not provided. Make sure to provide it in App.vue");
    }

    logger.debug("获取褚遂良中书令服务成功");
    return chuSuiLiangService;
}
