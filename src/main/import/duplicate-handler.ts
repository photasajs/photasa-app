import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { getLogger } from "@common/logger";
import type {
    FileInfo,
    DuplicateFileInfo,
    FileComparison,
    DuplicateStrategy,
    DuplicateResult,
    FileGroup,
    DuplicateAction,
} from "@common/import-types";

const logger = getLogger("duplicate-handler");

/**
 * 重复文件检测器
 * 负责检测和处理导入过程中的重复文件
 */
export class DuplicateDetector {
    /**
     * 检测目标目录中的重复文件
     */
    async detectDuplicates(
        fileGroups: FileGroup[],
        targetPath: string,
    ): Promise<DuplicateFileInfo[]> {
        logger.debug(
            `[duplicate-detector] Detecting duplicates for ${fileGroups.length} file groups`,
        );
        const duplicates: DuplicateFileInfo[] = [];

        for (const group of fileGroups) {
            // 对于文件组，我们主要检查主文件是否重复
            const mainFile = group.mainFile;
            const targetFilePath = this.getTargetFilePath(mainFile, targetPath, group.targetPath);

            if (await fs.pathExists(targetFilePath)) {
                // 文件名重复，进一步检查内容
                const duplicateInfo = await this.createDuplicateInfo(mainFile, targetFilePath);
                duplicates.push(duplicateInfo);
            }
        }

        logger.debug(`[duplicate-detector] Found ${duplicates.length} duplicates`);
        return duplicates;
    }

    /**
     * 获取目标文件路径
     */
    private getTargetFilePath(file: FileInfo, basePath: string, targetSubPath?: string): string {
        if (targetSubPath) {
            return path.join(basePath, targetSubPath, file.name);
        }
        return path.join(basePath, file.name);
    }

    /**
     * 创建重复文件信息
     */
    private async createDuplicateInfo(
        sourceFile: FileInfo,
        targetPath: string,
    ): Promise<DuplicateFileInfo> {
        try {
            const stats = await fs.stat(targetPath);

            // 创建目标文件的FileInfo对象
            const targetFile: FileInfo = {
                path: targetPath,
                name: path.basename(targetPath),
                size: stats.size,
                type: sourceFile.type, // 假设类型相同
                dateSource: "file_created",
                modifiedTime: stats.mtime,
                createdTime: stats.birthtime,
                dateTime: stats.birthtime,
                // FileAction 兼容字段
                file: targetPath,
                isImage: sourceFile.isImage,
                isVideo: sourceFile.isVideo,
                target: "",
                targetDir: "",
                targetFileName: "",
                targetFullPath: "",
            };

            // 确定重复原因
            let reason = "File with same name exists";

            // 如果大小相同，可能是相同文件
            if (sourceFile.size === targetFile.size) {
                reason = "File with same name and size exists";

                // 可选：计算哈希进行进一步比较
                const isSameContent = await this.compareFileContent(sourceFile.path, targetPath);
                if (isSameContent) {
                    reason = "Identical file already exists";
                }
            }

            return {
                originalFile: targetFile,
                duplicateFile: sourceFile,
                reason,
            };
        } catch (error) {
            logger.error(`[duplicate-detector] Error creating duplicate info: ${error}`);

            // 返回基本信息
            return {
                originalFile: {
                    path: targetPath,
                    name: path.basename(targetPath),
                    size: 0,
                    type: "other",
                    dateSource: "file_created",
                    // FileAction 兼容字段
                    file: targetPath,
                    isImage: false,
                    isVideo: false,
                    target: "",
                    targetDir: "",
                    targetFileName: "",
                    targetFullPath: "",
                },
                duplicateFile: sourceFile,
                reason: "File with same name exists (error checking details)",
            };
        }
    }

    /**
     * 比较两个文件的内容是否相同
     * 使用哈希算法比较，避免读取整个文件到内存
     */
    private async compareFileContent(file1: string, file2: string): Promise<boolean> {
        try {
            const hash1 = await this.calculateFileHash(file1);
            const hash2 = await this.calculateFileHash(file2);
            return hash1 === hash2;
        } catch (error) {
            logger.error(`[duplicate-detector] Error comparing files: ${error}`);
            return false;
        }
    }

    /**
     * 计算文件的哈希值
     */
    private async calculateFileHash(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash("md5");
            const stream = fs.createReadStream(filePath);

            stream.on("error", (err) => reject(err));
            stream.on("data", (chunk) => hash.update(chunk));
            stream.on("end", () => resolve(hash.digest("hex")));
        });
    }

    /**
     * 比较两个文件的详细信息
     */
    async compareFiles(file1: FileInfo, file2: FileInfo): Promise<FileComparison> {
        try {
            // 获取文件统计信息
            const [stat1, stat2] = await Promise.all([fs.stat(file1.path), fs.stat(file2.path)]);

            // 计算差异
            const sizeDifference = stat1.size - stat2.size;
            const timeDifference = stat1.mtime.getTime() - stat2.mtime.getTime();

            // 确定推荐操作
            let recommendation: "keep_original" | "keep_duplicate" | "keep_both" = "keep_both";

            if (await this.compareFileContent(file1.path, file2.path)) {
                // 内容相同，保留较新的文件
                recommendation = timeDifference > 0 ? "keep_original" : "keep_duplicate";
            } else {
                // 内容不同，建议保留两者
                recommendation = "keep_both";
            }

            return {
                sizeDifference,
                timeDifference,
                recommendation,
            };
        } catch (error) {
            logger.error(`[duplicate-detector] Error comparing files: ${error}`);

            // 出错时默认保留两者
            return {
                sizeDifference: 0,
                timeDifference: 0,
                recommendation: "keep_both",
            };
        }
    }
}

/**
 * 重复文件处理策略接口
 */
export interface DuplicateHandler {
    handle(original: FileInfo, duplicate: FileInfo, targetPath: string): Promise<DuplicateResult>;
}

/**
 * 跳过重复文件处理器
 */
export class SkipDuplicateHandler implements DuplicateHandler {
    async handle(
        original: FileInfo,
        duplicate: FileInfo,
        _targetPath: string,
    ): Promise<DuplicateResult> {
        logger.debug(`[duplicate-handler] Skipping duplicate file: ${duplicate.name}`);

        return {
            action: "skip",
            originalPath: original.path,
            message: `Skipped duplicate file: ${duplicate.name}`,
        };
    }
}

/**
 * 重命名重复文件处理器
 */
export class RenameDuplicateHandler implements DuplicateHandler {
    async handle(
        original: FileInfo,
        duplicate: FileInfo,
        targetPath: string,
    ): Promise<DuplicateResult> {
        logger.debug(`[duplicate-handler] Renaming duplicate file: ${duplicate.name}`);

        const newName = await this.generateUniqueName(targetPath);

        return {
            action: "rename",
            originalPath: original.path,
            newPath: newName,
            message: `Renamed to: ${path.basename(newName)}`,
        };
    }

    /**
     * 生成唯一的文件名
     */
    private async generateUniqueName(filePath: string): Promise<string> {
        const parsed = path.parse(filePath);
        let counter = 1;
        let newPath: string;

        do {
            newPath = path.join(parsed.dir, `${parsed.name}_${counter}${parsed.ext}`);
            counter++;
        } while (await fs.pathExists(newPath));

        return newPath;
    }
}

/**
 * 覆盖重复文件处理器
 */
export class OverwriteDuplicateHandler implements DuplicateHandler {
    async handle(
        original: FileInfo,
        duplicate: FileInfo,
        _targetPath: string,
    ): Promise<DuplicateResult> {
        logger.debug(`[duplicate-handler] Overwriting duplicate file: ${duplicate.name}`);

        return {
            action: "overwrite",
            originalPath: original.path,
            message: `Overwritten: ${duplicate.name}`,
        };
    }
}

/**
 * 保留两者处理器
 */
export class KeepBothDuplicateHandler implements DuplicateHandler {
    private detector = new DuplicateDetector();

    async handle(
        original: FileInfo,
        duplicate: FileInfo,
        targetPath: string,
    ): Promise<DuplicateResult> {
        logger.debug(`[duplicate-handler] Keeping both files: ${duplicate.name}`);

        // 比较文件
        const comparison = await this.detector.compareFiles(original, duplicate);

        // 生成新名称
        const newName = await this.generateUniqueName(targetPath, comparison);

        return {
            action: "keep_both",
            originalPath: original.path,
            newPath: newName,
            comparison,
            message: `Kept both files, new file saved as: ${path.basename(newName)}`,
        };
    }

    /**
     * 生成唯一的文件名，考虑比较结果
     */
    private async generateUniqueName(
        filePath: string,
        comparison: FileComparison,
    ): Promise<string> {
        const parsed = path.parse(filePath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);

        // 根据比较结果添加有意义的后缀
        let suffix = "";
        if (comparison.sizeDifference !== 0) {
            suffix = comparison.sizeDifference > 0 ? "_larger" : "_smaller";
        } else if (comparison.timeDifference !== 0) {
            suffix = comparison.timeDifference > 0 ? "_newer" : "_older";
        }

        const newName = path.join(parsed.dir, `${parsed.name}${suffix}_${timestamp}${parsed.ext}`);
        return newName;
    }
}

/**
 * 重复文件处理器工厂
 */
export class DuplicateHandlerFactory {
    /**
     * 创建重复文件处理器
     */
    static createHandler(strategy: DuplicateStrategy): DuplicateHandler {
        switch (strategy) {
            case "skip":
                return new SkipDuplicateHandler();
            case "rename":
                return new RenameDuplicateHandler();
            case "overwrite":
                return new OverwriteDuplicateHandler();
            case "keep_both":
                return new KeepBothDuplicateHandler();
            default:
                logger.warn(
                    `[duplicate-handler] Unknown strategy: ${strategy}, using rename as default`,
                );
                return new RenameDuplicateHandler();
        }
    }
}

/**
 * 批量重复文件处理器
 * 用于处理多个重复文件的批量操作
 */
export class BatchDuplicateHandler {
    private detector = new DuplicateDetector();

    /**
     * 批量处理重复文件
     */
    async handleBatch(
        duplicates: DuplicateFileInfo[],
        strategy: DuplicateStrategy,
        targetBasePath: string,
    ): Promise<DuplicateResult[]> {
        logger.debug(
            `[batch-duplicate-handler] Processing ${duplicates.length} duplicates with strategy: ${strategy}`,
        );

        const results: DuplicateResult[] = [];
        const handler = DuplicateHandlerFactory.createHandler(strategy);

        for (const duplicate of duplicates) {
            try {
                const targetPath = path.join(targetBasePath, duplicate.duplicateFile.name);
                const result = await handler.handle(
                    duplicate.originalFile,
                    duplicate.duplicateFile,
                    targetPath,
                );
                results.push(result);
            } catch (error) {
                logger.error(
                    `[batch-duplicate-handler] Error handling duplicate ${duplicate.duplicateFile.name}: ${error}`,
                );

                results.push({
                    action: "skip",
                    originalPath: duplicate.originalFile.path,
                    message: `Error handling duplicate: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
        }

        logger.debug(
            `[batch-duplicate-handler] Batch processing completed: ${results.length} results`,
        );
        return results;
    }

    /**
     * 分析重复文件并提供建议
     */
    async analyzeDuplicates(
        duplicates: DuplicateFileInfo[],
    ): Promise<Map<string, DuplicateAction>> {
        logger.debug(`[batch-duplicate-handler] Analyzing ${duplicates.length} duplicates`);

        const recommendations = new Map<string, DuplicateAction>();

        for (const duplicate of duplicates) {
            try {
                const comparison = await this.detector.compareFiles(
                    duplicate.originalFile,
                    duplicate.duplicateFile,
                );

                let recommendedAction: DuplicateAction;

                if (comparison.recommendation === "keep_original") {
                    recommendedAction = "skip"; // 跳过重复文件，保留原文件
                } else if (comparison.recommendation === "keep_duplicate") {
                    recommendedAction = "overwrite"; // 覆盖原文件
                } else {
                    recommendedAction = "keep_both"; // 保留两者
                }

                recommendations.set(duplicate.duplicateFile.path, recommendedAction);
            } catch (error) {
                logger.error(
                    `[batch-duplicate-handler] Error analyzing duplicate ${duplicate.duplicateFile.name}: ${error}`,
                );
                recommendations.set(duplicate.duplicateFile.path, "skip"); // 默认跳过
            }
        }

        logger.debug(
            `[batch-duplicate-handler] Analysis completed: ${recommendations.size} recommendations`,
        );
        return recommendations;
    }

    /**
     * 批量处理重复文件 - 支持逐个选择策略（需求3.2）
     */
    async handleBatchWithIndividualStrategies(
        duplicates: DuplicateFileInfo[],
        strategies: Map<string, DuplicateStrategy>,
        targetBasePath: string,
    ): Promise<DuplicateResult[]> {
        logger.debug(
            `[batch-duplicate-handler] Processing ${duplicates.length} duplicates with individual strategies`,
        );

        const results: DuplicateResult[] = [];

        for (const duplicate of duplicates) {
            try {
                const strategy = strategies.get(duplicate.duplicateFile.path) || "skip";
                const handler = DuplicateHandlerFactory.createHandler(strategy);
                const targetPath = path.join(targetBasePath, duplicate.duplicateFile.name);

                const result = await handler.handle(
                    duplicate.originalFile,
                    duplicate.duplicateFile,
                    targetPath,
                );
                results.push(result);
            } catch (error) {
                logger.error(
                    `[batch-duplicate-handler] Error handling duplicate ${duplicate.duplicateFile.name}: ${error}`,
                );

                results.push({
                    action: "skip",
                    originalPath: duplicate.originalFile.path,
                    message: `Error handling duplicate: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
        }

        logger.debug(
            `[batch-duplicate-handler] Individual strategy processing completed: ${results.length} results`,
        );
        return results;
    }

    /**
     * 预览批量处理结果（不实际执行）- 需求3.4
     */
    async previewBatch(
        duplicates: DuplicateFileInfo[],
        strategy: DuplicateStrategy,
        targetBasePath: string,
    ): Promise<
        Array<{
            duplicate: DuplicateFileInfo;
            plannedAction: DuplicateAction;
            targetPath: string;
            newPath?: string;
            warning?: string;
            comparison?: FileComparison;
        }>
    > {
        logger.debug(
            `[batch-duplicate-handler] Previewing batch processing with strategy: ${strategy}`,
        );

        const previews = [];

        for (const duplicate of duplicates) {
            const targetPath = path.join(targetBasePath, duplicate.duplicateFile.name);
            const plannedAction: DuplicateAction = strategy;
            let newPath: string | undefined;
            let warning: string | undefined;
            let comparison: FileComparison | undefined;

            try {
                // 获取文件比较信息
                comparison = await this.detector.compareFiles(
                    duplicate.originalFile,
                    duplicate.duplicateFile,
                );

                // 根据策略预测结果
                if (strategy === "rename" || strategy === "keep_both") {
                    const handler = new RenameDuplicateHandler();
                    const result = await handler.handle(
                        duplicate.originalFile,
                        duplicate.duplicateFile,
                        targetPath,
                    );
                    newPath = result.newPath;
                } else if (strategy === "overwrite") {
                    // 检查是否有覆盖风险（需求3.3）
                    if (comparison.recommendation === "keep_original") {
                        warning = "Warning: You are about to overwrite a newer/better file";
                    }
                }

                previews.push({
                    duplicate,
                    plannedAction,
                    targetPath,
                    newPath,
                    warning,
                    comparison,
                });
            } catch (error) {
                previews.push({
                    duplicate,
                    plannedAction: "skip",
                    targetPath,
                    warning: `Error during preview: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
        }

        logger.debug(`[batch-duplicate-handler] Preview completed: ${previews.length} items`);
        return previews;
    }

    /**
     * 获取重复文件统计信息
     */
    getDuplicateStatistics(duplicates: DuplicateFileInfo[]): {
        totalDuplicates: number;
        identicalFiles: number;
        sameNameDifferentContent: number;
        totalWastedSpace: number;
    } {
        let identicalFiles = 0;
        let sameNameDifferentContent = 0;
        let totalWastedSpace = 0;

        for (const duplicate of duplicates) {
            if (duplicate.reason.includes("Identical")) {
                identicalFiles++;
                totalWastedSpace += duplicate.duplicateFile.size;
            } else {
                sameNameDifferentContent++;
            }
        }

        return {
            totalDuplicates: duplicates.length,
            identicalFiles,
            sameNameDifferentContent,
            totalWastedSpace,
        };
    }

    /**
     * 验证重复处理策略的安全性（需求3.3）
     */
    async validateDuplicateStrategy(
        duplicate: DuplicateFileInfo,
        strategy: DuplicateStrategy,
    ): Promise<{
        isValid: boolean;
        warnings: string[];
        recommendations: string[];
        requiresConfirmation: boolean;
    }> {
        const warnings: string[] = [];
        const recommendations: string[] = [];
        let requiresConfirmation = false;

        try {
            const comparison = await this.detector.compareFiles(
                duplicate.originalFile,
                duplicate.duplicateFile,
            );

            // 检查覆盖策略的风险
            if (strategy === "overwrite") {
                requiresConfirmation = true;

                if (comparison.recommendation === "keep_original") {
                    warnings.push("The original file appears to be newer or better quality");
                    recommendations.push("Consider using 'keep_both' or 'skip' instead");
                }

                if (comparison.sizeDifference > 0) {
                    warnings.push("The original file is larger than the duplicate");
                }
            }

            // 检查跳过策略的建议
            if (strategy === "skip" && comparison.recommendation === "keep_duplicate") {
                recommendations.push(
                    "The duplicate file appears to be newer or better, consider overwriting",
                );
            }

            // 检查保留两者策略的空间影响
            if (strategy === "keep_both") {
                const totalSize = duplicate.originalFile.size + duplicate.duplicateFile.size;
                if (totalSize > 100 * 1024 * 1024) {
                    // 100MB
                    warnings.push(
                        `This will use ${Math.round(totalSize / (1024 * 1024))}MB of additional space`,
                    );
                }
            }

            return {
                isValid: warnings.length === 0,
                warnings,
                recommendations,
                requiresConfirmation,
            };
        } catch (error) {
            return {
                isValid: false,
                warnings: [
                    `Error validating strategy: ${error instanceof Error ? error.message : "Unknown error"}`,
                ],
                recommendations: ["Consider using 'skip' as a safe fallback"],
                requiresConfirmation: true,
            };
        }
    }
}
