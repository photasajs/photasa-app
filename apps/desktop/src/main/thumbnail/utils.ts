import * as fs from "fs";
import type { PhotasaLogger } from "@photasa/common";
import { exists, remove, access } from "fs-extra";

/**
 * 确保目标文件可写：如果文件存在且不可写，先删除它
 * @param filePath - 文件路径
 * @param logger - 日志记录器
 */
export async function ensureAccess(filePath: string, logger: PhotasaLogger): Promise<string> {
    // 确保目标文件可写：如果文件存在且不可写，先删除它
    try {
        if (await exists(filePath)) {
            // 检查文件是否可写
            try {
                await access(filePath, fs.constants.W_OK);
                logger.debug(
                    `[thumbnail-handler] Target thumbnail exists and is writable: ${filePath}`,
                );
            } catch (writeError) {
                logger.warn(
                    `[thumbnail-handler] Target thumbnail exists but is not writable, removing: ${filePath}`,
                );
                await remove(filePath);
            }
        }
    } catch (cleanupError) {
        logger.warn(`[thumbnail-handler] Failed to cleanup target thumbnail: ${cleanupError}`);
        // 继续尝试写入，让后续的错误处理来处理
    }
    return filePath;
}
