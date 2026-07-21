import { ScanActionEvent } from "@photasa/common";

/**
 * 计算扫描路径
 * @param args 扫描事件参数
 * @returns 扫描路径
 */
export function computeScannedFilePaths(args: ScanActionEvent): string[] {
    let paths: string[] = [];

    // 如果事件类型为完成，并且路径数组存在，则使用路径数组
    if (args.type === "complete" && Array.isArray(args.paths)) {
        paths = args.paths;
    } else if (args?.action?.path && args?.action?.isDirectory) {
        // 如果事件类型为完成，并且路径数组不存在，则创建路径数组
        paths = [args.action.path as string];
    }
    return paths;
}
