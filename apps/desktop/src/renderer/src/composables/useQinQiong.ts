import { inject } from "vue";
import type { IQinQiongService } from "@renderer/interfaces/qin-qiong.interface";
import { QIN_QIONG_TOKEN } from "@renderer/interfaces/qin-qiong.interface";
import { loggers } from "@photasa/common";

const logger = loggers.qinqiong;

/**
 * 秦琼服务Composable
 * 为UI组件提供秦琼服务的访问接口
 *
 * @returns 秦琼服务实例
 * @throws 如果秦琼服务未注册则抛出错误
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useQinQiong } from '@renderer/composables/useQinQiong';
 *
 * const qinQiong = useQinQiong();
 *
 * // 处理文件夹发现事件
 * async function onFolderDiscovered(path: string) {
 *   await qinQiong.handleFolderDiscovered(path);
 * }
 * </script>
 * ```
 */
export function useQinQiong(): IQinQiongService {
    const qinQiongService = inject<IQinQiongService>(QIN_QIONG_TOKEN);

    if (!qinQiongService) {
        logger.error("🛡️ 秦琼大人不在府中，请确保朝廷已委任");
        throw new Error("QinQiongService not provided. Make sure to provide it in App.vue");
    }

    logger.debug("🛡️ 秦琼大人应召到府");
    return qinQiongService;
}
