import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { PHOTASA_ORIGINALS } from "@common/utils";
import fs from "fs";

/**
 * 缩短缩略图绝对路径为相对路径
 * @param file - 缩略图绝对路径
 * @returns 相对路径
 */
export function shortenThumbnailName(file: string): string {
    return path.join(PHOTASA_ORIGINALS, path.basename(file));
}

/**
 * 将原始文件名转换为缩略图文件名（不含路径）
 * @param target - 原始文件名
 * @returns 缩略图文件名（不含路径）
 */
export function toThumbnailName(target: string): string {
    return `thumbnail-${toFileName(target)}.png`;
}

/**
 * 构建预览图路径
 * @param target - 原始文件路径
 * @returns 预览图路径
 */
export function toPreviewPath(target: string): string {
    const fileName = path.basename(target, path.extname(target));
    return path.join(path.dirname(target), PHOTASA_ORIGINALS, `${fileName}.jpeg`);
}

/**
 * 构建缩略图文件的相对路径
 * @param photoPath - 原始照片路径
 * @returns 缩略图文件的相对路径
 */
export function toRelativeThumbnailPath(photoPath: string): string {
    return path.join(PHOTASA_ORIGINALS, toThumbnailName(path.basename(photoPath)));
}

/**
 * 构建缩略图文件的绝对路径
 * @param photoPath - 原始照片路径
 * @returns 缩略图文件的绝对路径
 */
export function buildThumbnailPath(photoPath: string): string {
    const dir = path.normalize(path.join(path.dirname(photoPath), PHOTASA_ORIGINALS));
    return path.join(dir, toThumbnailName(path.basename(photoPath)));
}

/**
 * 判断文件是否在指定文件夹下（仅依赖 path 包）
 * @param file 文件路径
 * @param folder 文件夹路径
 * @returns 是否在文件夹下
 */
export function isFileUnderFolder(file: string, folder: string): boolean {
    if (!file || !folder) {
        return false;
    }
    const fileDir = path.resolve(path.dirname(file));
    const folderDir = path.resolve(folder);
    return fileDir === folderDir;
}

/**
 * 提取文件名（含扩展名），仅依赖 path 包
 * @param target 文件完整路径
 * @returns 文件名（含扩展名）
 */
export function toFileName(target: string): string {
    if (!target) {
        return "";
    }
    return path.basename(target);
}

/**
 * 提取目录名，仅依赖 Node.js path 包
 * @param target 文件或目录路径
 * @returns 目录名
 */
export function toDirName(target: string): string {
    return path.dirname(target);
}

/**
 * 提取扩展名，仅依赖 Node.js path 包
 * @param target 文件路径
 * @returns 扩展名（含点）
 */
export function toExtName(target: string): string {
    return path.extname(target);
}

/**
 * 计算相对路径，仅依赖 Node.js path 包
 * @param from 起始路径
 * @param to 目标路径
 * @returns 相对路径
 */
export function relativePath(from: string, to: string): string {
    return path.relative(from, to);
}

/**
 * 解析绝对路径，仅依赖 Node.js path 包
 * @param segments 路径片段
 * @returns 绝对路径
 */
export function resolvePath(...segments: string[]): string {
    return path.resolve(...segments);
}

/**
 * 判断是否为绝对路径，仅依赖 Node.js path 包
 * @param target 路径
 * @returns 是否为绝对路径
 */
export function isAbsolutePath(target: string): boolean {
    return path.isAbsolute(target);
}

/**
 * 路径拼接，完全依赖 Node.js path 包
 * @param left 左侧路径
 * @param right 右侧路径（可选）
 * @returns 拼接后的路径
 */
export function mergePath(left: string, right = ""): string {
    return path.join(left, right);
}

/**
 * 判断是否为隐藏文件，仅依赖 Node.js path 包
 * @param file 文件路径
 * @returns 是否为隐藏文件
 */
export function isHiddenFile(file: string): boolean {
    const basename = path.basename(file);
    return basename.startsWith(".");
}

/**
 * 判断路径是否为目录，仅依赖 Node.js fs.promises
 * @param path 路径
 * @returns 是否为目录
 */
export async function isDirectory(path: string): Promise<boolean> {
    try {
        const stat = await fs.promises.stat(path);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

/**
 * 判断路径是否为文件，仅依赖 Node.js fs.promises
 * @param path 路径
 * @returns 是否为文件
 */
export async function isFile(path: string): Promise<boolean> {
    try {
        const stat = await fs.promises.stat(path);
        return stat.isFile();
    } catch {
        return false;
    }
}

/**
 * 规范化文件路径，处理所有格式的路径输入
 * 这是项目中路径处理的统一入口点，确保所有路径都使用相同的规范化逻辑
 * 支持 file:// URL、普通文件路径、相对路径等所有格式
 * @param input 输入路径 - 可能是 file:// URL、普通文件路径或相对路径
 * @returns 规范化的文件系统绝对路径
 */
export function normalizePath(input: string | URL): string {
    if (!input) {
        return "";
    }

    let pathStr = typeof input === "string" ? input : input.toString();

    try {
        // 检测是否为 file:// URL
        if (pathStr.startsWith("file://")) {
            // 使用 Node.js 标准 API 转换 file:// URL 为文件系统路径
            // 这是最可靠的方法，自动处理所有平台差异和URL编码
            pathStr = fileURLToPath(pathStr);
        }

        // 使用 path.resolve 来解析路径，确保绝对路径被正确解析
        return path.resolve(pathStr);
    } catch (error) {
        // 如果 fileURLToPath 失败，可能是格式错误的 URL 或跨平台路径问题
        // 回退到手动处理 file:// URL
        if (pathStr.startsWith("file://")) {
            // 手动处理 file:// URL
            let urlPath = pathStr.substring(7); // 移除 "file://"

            // 处理 Windows 路径（file:///C:/path -> C:/path）
            if (urlPath.startsWith("/") && urlPath.length > 1 && urlPath[2] === ":") {
                urlPath = urlPath.substring(1); // 移除开头的 "/"
            }

            // 解码 URL 编码
            try {
                urlPath = decodeURIComponent(urlPath);
            } catch (decodeError) {
                // 如果解码失败，保持原样
                console.warn("Failed to decode URL:", decodeError);
            }

            pathStr = urlPath;
        }

        // 使用 path.resolve 来解析路径，确保绝对路径被正确解析
        return path.resolve(pathStr);
    }
}

/**
 * 将文件系统路径转换为 file:// URL
 * @param filePath 文件系统路径
 * @returns file:// URL 字符串
 */
export function pathToFileProtocol(filePath: string): string {
    const normalizedPath = normalizePath(filePath);
    return pathToFileURL(normalizedPath).toString();
}

/**
 * 安全的路径连接函数，支持 file:// URL 和普通路径
 * @param segments 路径片段
 * @returns 连接后的规范化绝对路径
 */
export function joinFileProtocolPath(...segments: string[]): string {
    // 规范化第一个片段（基础路径）
    const basePath = segments.length > 0 ? normalizePath(segments[0]) : "";

    // 连接剩余片段
    const remainingSegments = segments.slice(1);

    if (remainingSegments.length === 0) {
        return basePath;
    }

    return path.resolve(basePath, ...remainingSegments);
}

/**
 * 获取应用程序路径（兼容 worker 线程和非 Electron 环境）
 * 使用新的 Electron API 替代废弃的 app.getAppPath()
 * @param electronApp 可选的 Electron app 实例
 * @returns 应用程序路径
 */
export function getAppPath(electronApp?: { getPath: (name: "exe") => string }): string {
    // 如果传入了 Electron app 实例，使用新的 API
    if (electronApp && typeof electronApp.getPath === "function") {
        try {
            return path.dirname(electronApp.getPath("exe"));
        } catch {
            // Electron API 调用失败时继续执行下面的逻辑
        }
    }

    // 在 worker 线程中，使用环境变量或进程路径
    if (process.env.APP_PATH) {
        return process.env.APP_PATH;
    }

    // 回退到进程执行路径
    return process.cwd();
}
