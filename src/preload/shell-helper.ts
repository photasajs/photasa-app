import { electronAPI } from "@electron-toolkit/preload";
import { removeFileProtocol } from "@shared/path-util";

const { ipcRenderer } = electronAPI;

/**
 * 架构原则：Electron 各层职责分工
 * - Renderer 层：关心 file:// URL（浏览器环境）
 * - Main 层：关心 OS 路径（Node.js 环境）
 * - Preload 层：负责两者之间的转换
 *
 * 因此，所有从 renderer 传递到 main 的文件路径转换都应该在 preload 层处理，
 * 而不是让 renderer 层手动调用 removeFileProtocol。
 */

/**
 * 打开文件夹 - preload 层负责 file:// URL 到 OS 路径的转换
 * @param path 文件路径（可能是 file:// URL 或普通路径）
 */
export function openInFinder(path: string): void {
    // preload 层负责转换：file:// URL -> OS 路径
    const osPath = removeFileProtocol(path);
    ipcRenderer.send("picasa:open-in-finder", { path: osPath });
}
