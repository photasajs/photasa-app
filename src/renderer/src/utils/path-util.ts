/**
 * Renderer 进程的路径处理工具
 * 通过 preload 层调用统一的路径处理 API
 */

/**
 * 规范化文件路径，处理所有格式的路径输入
 * 通过 preload 层调用统一的路径处理 API，确保正确处理 Windows 和 macOS 格式
 * @param input 输入路径 - 可能是 file:// URL 或普通文件路径
 * @returns 规范化的文件系统路径
 */
export function normalizePath(input: string): string {
    // 通过 preload 层调用统一的路径处理 API
    // 这确保了所有路径处理都使用相同的逻辑
    return window.api.normalizePath?.(input) || input;
}
