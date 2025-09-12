import type {
    ImportConfig,
    FileGroup,
    ImportFilters,
    DuplicateStrategy,
    FileType,
} from "@common/import-types";

/**
 * 导入功能的纯函数工具集
 */

/**
 * 创建默认的导入过滤器
 * @param excludePaths 可选的排除路径数组，如果不提供则使用默认值
 */
export function createDefaultFilters(excludePaths?: string[]): ImportFilters {
    return {
        fileTypes: ["image", "video"] as FileType[],
        sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
        dateRange: { start: new Date(0), end: new Date() },
        includeSubfolders: true,
        // 使用提供的排除路径或默认值
        excludePaths: excludePaths || [
            ".photasaoriginal", // Photasa原始文件跟踪文件夹
            ".photasaoriginals", // Photasa缩略图缓存文件夹
            ".photasa.json", // Photasa配置文件
            ".DS_Store", // macOS系统文件
            "Thumbs.db", // Windows缩略图文件
            ".git", // Git版本控制文件夹
            ".svn", // SVN版本控制文件夹
            "node_modules", // Node.js依赖文件夹
        ],
    };
}

/**
 * 创建导入配置
 */
export function createImportConfig(
    sourcePaths: string[],
    targetPath: string,
    filters: ImportFilters,
    duplicateStrategy: DuplicateStrategy,
    fileGroups: FileGroup[] = [],
    selectedFiles: string[] = [],
    allowDuplicateRename = true,
): ImportConfig {
    return {
        sourcePaths,
        targetPath,
        filters,
        duplicateStrategy,
        fileGroups,
        selectedFiles,
        allowDuplicateRename,
    };
}

/**
 * 检查是否可以预览导入
 */
export function canPreviewImport(sourcePaths: string[], targetPath: string): boolean {
    return sourcePaths.length > 0 && targetPath !== "";
}

/**
 * 检查是否可以执行导入
 */
export function canExecuteImport(
    sourcePaths: string[],
    targetPath: string,
    fileGroups: FileGroup[],
    showPreview: boolean,
): boolean {
    return sourcePaths.length > 0 && targetPath !== "" && (fileGroups.length > 0 || !showPreview);
}

/**
 * 添加源目录到列表，避免重复
 */
export function addSourceDirectories(currentPaths: string[], newPaths: string[]): string[] {
    const result = [...currentPaths];

    for (const path of newPaths) {
        if (!result.includes(path)) {
            result.push(path);
        }
    }

    return result;
}

/**
 * 从源目录列表中移除指定索引的目录
 */
export function removeSourceDirectory(currentPaths: string[], index: number): string[] {
    const result = [...currentPaths];
    result.splice(index, 1);
    return result;
}

/**
 * 更新文件类型过滤器
 */
export function updateFileTypeFilter(
    currentFilters: ImportFilters,
    fileType: FileType,
    enabled: boolean,
): ImportFilters {
    const newFileTypes = [...currentFilters.fileTypes];

    if (enabled && !newFileTypes.includes(fileType)) {
        newFileTypes.push(fileType);
    } else if (!enabled) {
        const index = newFileTypes.indexOf(fileType);
        if (index > -1) {
            newFileTypes.splice(index, 1);
        }
    }

    return {
        ...currentFilters,
        fileTypes: newFileTypes,
    };
}

/**
 * 检查文件是否被选中
 */
export function isFileSelected(filePath: string, selectedFiles: Set<string>): boolean {
    return selectedFiles.has(filePath);
}

/**
 * 切换文件选择状态
 */
export function toggleFileSelection(filePath: string, selectedFiles: Set<string>): Set<string> {
    const newSelection = new Set(selectedFiles);

    if (newSelection.has(filePath)) {
        newSelection.delete(filePath);
    } else {
        newSelection.add(filePath);
    }

    return newSelection;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 格式化处理速度
 * @param speed 处理速度（文件/秒）
 * @param t 翻译函数，用于获取本地化的单位标签
 * @returns 格式化后的速度字符串，包含本地化的单位
 */
export function formatProcessingSpeed(speed: number, t?: (key: string) => string): string {
    if (speed < 1) {
        const value = (speed * 60).toFixed(1);
        const unit = t ? t("import.filesPerMin") : "files/min";
        return `${value} ${unit}`;
    }
    const value = speed.toFixed(1);
    const unit = t ? t("import.filesPerSec") : "files/sec";
    return `${value} ${unit}`;
}

/**
 * 获取处理速度的数值和单位（分离版本）
 * @param speed 处理速度（文件/秒）
 * @param t 翻译函数，用于获取本地化的单位标签
 * @returns 包含数值和单位的对象
 */
export function getProcessingSpeedParts(
    speed: number,
    t?: (key: string) => string,
): {
    value: string;
    unit: string;
} {
    if (speed < 1) {
        return {
            value: (speed * 60).toFixed(1),
            unit: t ? t("import.filesPerMin") : "files/min",
        };
    }
    return {
        value: speed.toFixed(1),
        unit: t ? t("import.filesPerSec") : "files/sec",
    };
}

/**
 * 格式化剩余时间
 */
export function formatRemainingTime(seconds: number): string {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.ceil(seconds % 60);
        return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
}

/**
 * 计算导入进度百分比
 */
export function calculateProgressPercentage(processed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((processed / total) * 100);
}

/**
 * 创建文件预览状态的初始值
 */
export function createInitialFilePreviewState() {
    return {
        files: [] as FileGroup[],
        selectedFiles: new Set<string>(),
        totalCount: 0,
        totalSize: 0,
        statistics: {
            imageFiles: 0,
            videoFiles: 0,
            otherFiles: 0,
            duplicateCount: 0,
        },
    };
}

/**
 * 更新文件预览状态
 */
export function updateFilePreviewState(
    currentState: any,
    fileGroups: FileGroup[],
    statistics: any,
) {
    return {
        ...currentState,
        files: fileGroups,
        totalCount: statistics.totalFiles,
        totalSize: statistics.totalSize,
        statistics,
        selectedFiles: new Set(fileGroups.map((g) => g.mainFile.path)),
    };
}

/**
 * 验证导入配置
 */
export function validateImportConfig(config: ImportConfig): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (config.sourcePaths.length === 0) {
        errors.push("请至少选择一个源目录");
    }

    if (!config.targetPath) {
        errors.push("请选择目标目录");
    }

    if (config.filters.fileTypes.length === 0) {
        errors.push("请至少选择一种文件类型");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}
