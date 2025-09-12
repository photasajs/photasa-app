import path from "path";
import type { FileGroup } from "@common/import-types";

/**
 * 文件组统计信息接口
 */
export interface FileGroupStatistics {
    totalGroups: number;
    singleFiles: number;
    multiFileGroups: number;
    totalFiles: number;
    averageGroupSize: number;
    largestGroupSize: number;
    groupsByType: Record<string, number>;
}

/**
 * 获取文件组的统计信息（纯函数）
 */
export function getFileGroupStatistics(groups: FileGroup[]): FileGroupStatistics {
    const singleFiles = groups.filter((g) => g.type === "single").length;
    const multiFileGroups = groups.filter((g) => g.type === "group").length;
    const totalFiles = groups.reduce((sum, g) => sum + g.files.length, 0);
    const largestGroupSize = groups.length > 0 ? Math.max(...groups.map((g) => g.files.length)) : 0;

    // 按主文件类型分组统计
    const groupsByType: Record<string, number> = {};
    for (const group of groups) {
        const ext = path.extname(group.mainFile.path).toLowerCase();
        groupsByType[ext] = (groupsByType[ext] || 0) + 1;
    }

    return {
        totalGroups: groups.length,
        singleFiles,
        multiFileGroups,
        totalFiles,
        averageGroupSize: groups.length > 0 ? totalFiles / groups.length : 0,
        largestGroupSize,
        groupsByType,
    };
}

/**
 * 格式化文件组统计信息为可读字符串
 */
export function formatFileGroupStatistics(stats: FileGroupStatistics): string {
    const lines = [
        `Total Groups: ${stats.totalGroups}`,
        `Single Files: ${stats.singleFiles}`,
        `Multi-file Groups: ${stats.multiFileGroups}`,
        `Total Files: ${stats.totalFiles}`,
        `Average Group Size: ${stats.averageGroupSize.toFixed(1)}`,
        `Largest Group Size: ${stats.largestGroupSize}`,
    ];

    if (Object.keys(stats.groupsByType).length > 0) {
        lines.push("Groups by Type:");
        for (const [type, count] of Object.entries(stats.groupsByType)) {
            lines.push(`  ${type}: ${count}`);
        }
    }

    return lines.join("\n");
}

/**
 * 计算文件组的总大小
 */
export function calculateTotalSize(groups: FileGroup[]): number {
    return groups.reduce((sum, group) => sum + group.totalSize, 0);
}

/**
 * 获取最大的文件组
 */
export function getLargestFileGroup(groups: FileGroup[]): FileGroup | null {
    if (groups.length === 0) return null;

    return groups.reduce((largest, current) =>
        current.files.length > largest.files.length ? current : largest,
    );
}

/**
 * 按类型分组文件组
 */
export function groupByFileType(groups: FileGroup[]): Record<string, FileGroup[]> {
    const result: Record<string, FileGroup[]> = {};

    for (const group of groups) {
        const ext = path.extname(group.mainFile.path).toLowerCase();
        if (!result[ext]) {
            result[ext] = [];
        }
        result[ext].push(group);
    }

    return result;
}

/**
 * 过滤出多文件组
 */
export function getMultiFileGroups(groups: FileGroup[]): FileGroup[] {
    return groups.filter((group) => group.type === "group" && group.files.length > 1);
}

/**
 * 过滤出单文件组
 */
export function getSingleFileGroups(groups: FileGroup[]): FileGroup[] {
    return groups.filter((group) => group.type === "single");
}
