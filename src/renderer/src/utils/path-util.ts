/**
 * Renderer 进程的路径处理工具
 * 专门用于处理 file:// 协议和跨平台路径规范化
 */

/**
 * 将 file:// URL 规范化为跨平台文件系统路径
 * 在 renderer 进程中处理 file:// 协议，正确处理 Windows 和 macOS 格式
 * @param input 输入路径 - 可能是 file:// URL 或普通文件路径
 * @returns 规范化的文件系统路径
 */
export function normalizeFileProtocolPath(input: string): string {
    if (!input) {
        return "";
    }

    // 检测是否为 file:// URL
    if (input.startsWith("file://")) {
        // 移除 file:// 前缀
        let pathStr = input.replace(/^file:\/\/+/, "");

        // 处理 Windows 路径格式 file:///C:/...
        // 在非 Windows 系统上运行时，需要保持 C: 格式
        if (pathStr.match(/^[A-Za-z]:/)) {
            // Windows 路径格式，直接返回
            return pathStr;
        }

        // Unix/Mac 路径格式，确保有前导斜杠
        if (pathStr && pathStr[0] !== "/") {
            pathStr = "/" + pathStr;
        }

        return pathStr;
    }

    // 不是 file:// URL，直接返回
    return input;
}
