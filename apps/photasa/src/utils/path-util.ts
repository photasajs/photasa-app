/**
 * Renderer 进程的路径处理工具（RFC 0137：同步规范化，不经 window.api）
 */
import { normalizePathSync } from "@renderer/utils/sync-path";

/**
 * 规范化文件路径，处理所有格式的路径输入
 * @param input 输入路径 - 可能是 file:// URL 或普通文件路径
 * @returns 规范化的文件系统路径
 */
export function normalizePath(input: string): string {
    return normalizePathSync(input);
}
