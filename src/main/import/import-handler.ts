/**
 * 轻量级Import Handler - 纯函数重构版本
 *
 * 这个文件现在只是一个轻量级的入口，所有的复杂逻辑都已经拆分到：
 * - metadata/ - 元数据提取相关功能
 * - file-groups/ - 文件组检测相关功能
 *
 * 优点：
 * 1. 文件更小，更容易维护
 * 2. 功能模块化，职责单一
 * 3. 纯函数设计，更容易测试
 * 4. 更好的代码复用性
 */

// 重新导出所有功能模块
export {
    // 元数据提取
    extractMetadata,
    processFileGroup,

    // HEIC 处理
    extractHeicMetadata,
    isHeicFile,
    resetHeifModule,

    // 视频处理
    extractVideoMetadata,
    isVideoFile,
    isSupportedVideoFile,
    getVideoFormatName,

    // RAW 处理
    extractRawMetadata,
    isRawFile,
    getRawCameraBrand,
    RAW_EXTENSIONS,

    // 常规图片处理
    extractImageMetadata,
    isImageFile,
    isJpegFile,
    getImageFormatName,
    IMAGE_EXTENSIONS,

    // GPS 解析
    parseGPSCoordinate,
    extractGPSInfo,
    parseISO6709GPS,
    extractVideoGPS,

    // 相机信息解析
    extractCameraInfo,
    isValidCameraInfo,
    formatCameraInfo,

    // 日期解析
    isValidDate,
    isValidVideoDate,
    safeParseDate,
    selectBestDate,
    generateDatePath,
} from "./metadata";

export {
    // 文件组检测
    detectBasicFileGroups,
    detectEnhancedFileGroups,
    detectFileGroups,
    areFilesRelated,
    getGroupMainFile,

    // 文件组统计
    getFileGroupStatistics,
    formatFileGroupStatistics,
    calculateTotalSize,
    getLargestFileGroup,
    groupByFileType,
    getMultiFileGroups,
    getSingleFileGroups,

    // 文件组验证
    validateFileGroup,
    validateFileGroups,
    areGroupsRelated,
    getValidationSummary,
    getInvalidGroups,
    getValidGroups,

    // 类型
    type FileGroupStatistics,
    type FileGroupValidationResult,
} from "./file-groups";

// 保持与原有API的兼容性
export class VideoMetadataProcessor {
    static extractMetadata = extractVideoMetadata;
}

export class FileGroupDetector {
    detectFileGroups = detectFileGroups;
    detectFileGroupsEnhanced = detectEnhancedFileGroups;
    getGroupStatistics = getFileGroupStatistics;
    validateFileGroup = validateFileGroup;
    areGroupsRelated = areGroupsRelated;
}

// 为了保持向后兼容，重新导入需要的依赖
import { extractVideoMetadata } from "./metadata/extractors/video-extractor";
import { detectFileGroups, detectEnhancedFileGroups } from "./file-groups/detector";
import { getFileGroupStatistics } from "./file-groups/statistics";
import { validateFileGroup, areGroupsRelated } from "./file-groups/validator";
