// 文件组检测
export {
    detectBasicFileGroups,
    detectEnhancedFileGroups,
    detectFileGroups, // 默认为增强检测
    areFilesRelated,
    getGroupMainFile,
} from "./detector";

// 文件组统计
export {
    getFileGroupStatistics,
    formatFileGroupStatistics,
    calculateTotalSize,
    getLargestFileGroup,
    groupByFileType,
    getMultiFileGroups,
    getSingleFileGroups,
    type FileGroupStatistics,
} from "./statistics";

// 文件组验证
export {
    validateFileGroup,
    validateFileGroups,
    areGroupsRelated,
    getValidationSummary,
    getInvalidGroups,
    getValidGroups,
    type FileGroupValidationResult,
} from "./validator";

// 重新导出类型
export type { FileGroup, FileInfo } from "@photasa/common";
