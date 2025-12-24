import fs from "fs-extra";
import path from "path";
import type { FileGroup } from "@common/import-types";

/**
 * 文件组验证结果接口
 */
export interface FileGroupValidationResult {
    isValid: boolean;
    missingFiles: string[];
    issues: string[];
    recommendations: string[];
}

/**
 * 验证单个文件组的完整性（纯函数，但包含文件系统检查）
 */
export async function validateFileGroup(group: FileGroup): Promise<FileGroupValidationResult> {
    const issues: string[] = [];
    const missingFiles: string[] = [];
    const recommendations: string[] = [];

    // 检查主文件是否存在
    if (!(await fs.pathExists(group.mainFile.path))) {
        issues.push(`Main file not found: ${group.mainFile.path}`);
        missingFiles.push(group.mainFile.path);
    }

    // 检查关联文件是否存在
    for (const file of group.files) {
        if (file !== group.mainFile && !(await fs.pathExists(file.path))) {
            issues.push(`Related file not found: ${file.path}`);
            missingFiles.push(file.path);
        }
    }

    // 检查文件大小是否合理
    if (group.mainFile.size === 0) {
        issues.push(`Main file has zero size: ${group.mainFile.path}`);
    }

    // 检查是否有常见的缺失关联文件
    const mainExt = path.extname(group.mainFile.path).toLowerCase().slice(1);

    if (["mp4", "mov"].includes(mainExt)) {
        const hasThm = group.files.some((f) => path.extname(f.path).toLowerCase() === ".thm");
        if (!hasThm) {
            recommendations.push(
                `Consider looking for .THM thumbnail file for ${group.mainFile.name}`,
            );
        }
    }

    if (["cr2", "nef", "arw"].includes(mainExt)) {
        const hasJpg = group.files.some((f) =>
            [".jpg", ".jpeg"].includes(path.extname(f.path).toLowerCase()),
        );
        if (!hasJpg) {
            recommendations.push(
                `Consider looking for JPEG preview file for ${group.mainFile.name}`,
            );
        }
    }

    return {
        isValid: issues.length === 0,
        missingFiles,
        issues,
        recommendations,
    };
}

/**
 * 验证多个文件组（纯函数）
 */
export async function validateFileGroups(
    groups: FileGroup[],
): Promise<FileGroupValidationResult[]> {
    const results: FileGroupValidationResult[] = [];

    for (const group of groups) {
        const result = await validateFileGroup(group);
        results.push(result);
    }

    return results;
}

/**
 * 检查两个文件组是否可能相关（纯函数）
 */
export function areGroupsRelated(group1: FileGroup, group2: FileGroup): boolean {
    // 检查是否在同一目录
    const dir1 = path.dirname(group1.mainFile.path);
    const dir2 = path.dirname(group2.mainFile.path);
    if (dir1 !== dir2) return false;

    // 检查文件名模式
    const name1 = path.parse(group1.mainFile.path).name;
    const name2 = path.parse(group2.mainFile.path).name;

    // 检查序列文件（如 IMG_0001, IMG_0002）
    const match1 = name1.match(/^(.+?)(\d+)$/);
    const match2 = name2.match(/^(.+?)(\d+)$/);

    if (match1 && match2) {
        const [, prefix1, num1] = match1;
        const [, prefix2, num2] = match2;

        if (prefix1 === prefix2) {
            const diff = Math.abs(parseInt(num1) - parseInt(num2));
            return diff <= 5; // 序列号相差不超过5
        }
    }

    return false;
}

/**
 * 获取验证摘要信息（纯函数）
 */
export function getValidationSummary(results: FileGroupValidationResult[]): {
    totalGroups: number;
    validGroups: number;
    invalidGroups: number;
    totalMissingFiles: number;
    totalIssues: number;
    totalRecommendations: number;
} {
    const validGroups = results.filter((r) => r.isValid).length;
    const totalMissingFiles = results.reduce((sum, r) => sum + r.missingFiles.length, 0);
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const totalRecommendations = results.reduce((sum, r) => sum + r.recommendations.length, 0);

    return {
        totalGroups: results.length,
        validGroups,
        invalidGroups: results.length - validGroups,
        totalMissingFiles,
        totalIssues,
        totalRecommendations,
    };
}

/**
 * 过滤出有问题的文件组（纯函数）
 */
export function getInvalidGroups(
    groups: FileGroup[],
    results: FileGroupValidationResult[],
): FileGroup[] {
    return groups.filter((_, index) => !results[index]?.isValid);
}

/**
 * 过滤出有效的文件组（纯函数）
 */
export function getValidGroups(
    groups: FileGroup[],
    results: FileGroupValidationResult[],
): FileGroup[] {
    return groups.filter((_, index) => results[index]?.isValid);
}
