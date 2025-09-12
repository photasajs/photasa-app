import path from "path";
import type { FileInfo, FileGroup } from "@common/import-types";
import type { PhotasaLogger } from "@common/logger";

/**
 * 基础关联文件扩展名映射
 */
const BASIC_RELATED_EXTENSIONS: Record<string, string[]> = {
    mp4: [".thm", ".lrv", ".srt"],
    mov: [".thm", ".lrv"],
    avi: [".thm", ".idx"],
    mts: [".modd"],
    m2ts: [".modd"],
};

/**
 * 增强的关联文件扩展名映射
 */
const ENHANCED_RELATED_EXTENSIONS: Record<string, string[]> = {
    // 视频文件及其关联文件
    mp4: [".thm", ".lrv", ".srt", ".sub", ".ass", ".vtt"], // GoPro, DJI等
    mov: [".thm", ".lrv", ".xml", ".fcpxml"], // 苹果设备, Final Cut Pro
    avi: [".thm", ".idx", ".sub"], // 传统摄像机
    mts: [".modd", ".moff"], // Sony AVCHD
    m2ts: [".modd", ".moff", ".cpi", ".bup"], // Panasonic AVCHD
    mkv: [".srt", ".sub", ".ass", ".vtt"], // Matroska容器
    wmv: [".srt", ".sub"], // Windows Media

    // RAW文件及其关联文件
    cr2: [".xmp", ".pp3", ".jpg", ".jpeg"], // Canon RAW + JPEG
    cr3: [".xmp", ".pp3", ".jpg", ".jpeg"], // Canon RAW (新格式)
    nef: [".xmp", ".pp3", ".jpg", ".jpeg"], // Nikon RAW + JPEG
    arw: [".xmp", ".pp3", ".jpg", ".jpeg"], // Sony RAW + JPEG
    dng: [".xmp", ".pp3"], // Adobe DNG
    raf: [".xmp", ".pp3", ".jpg", ".jpeg"], // Fujifilm RAW + JPEG
    orf: [".xmp", ".pp3", ".jpg", ".jpeg"], // Olympus RAW + JPEG
    rw2: [".xmp", ".pp3", ".jpg", ".jpeg"], // Panasonic RAW + JPEG

    // JPEG文件及其关联文件
    jpg: [".xmp", ".pp3", ".aae"], // JPEG + 编辑信息
    jpeg: [".xmp", ".pp3", ".aae"], // JPEG + 编辑信息

    // HEIC文件及其关联文件
    heic: [".xmp", ".aae", ".jpg", ".jpeg"], // iOS编辑信息 + JPEG版本
    heif: [".xmp", ".aae", ".jpg", ".jpeg"], // HEIF + 编辑信息

    // 其他特殊格式
    tiff: [".xmp", ".pp3"], // TIFF + 编辑信息
    psd: [".xmp"], // Photoshop文件
};

/**
 * 文件优先级定义（数字越小优先级越高）
 */
const FILE_PRIORITY: Record<string, number> = {
    ".mp4": 1,
    ".mov": 1,
    ".avi": 1,
    ".mkv": 1,
    ".wmv": 1,
    ".mts": 1,
    ".m2ts": 1,
    ".cr2": 2,
    ".cr3": 2,
    ".nef": 2,
    ".arw": 2,
    ".dng": 2,
    ".raf": 2,
    ".orf": 2,
    ".rw2": 2,
    ".heic": 3,
    ".heif": 3,
    ".jpg": 4,
    ".jpeg": 4,
    ".png": 4,
    ".tiff": 4,
    ".xmp": 10,
    ".pp3": 10,
    ".aae": 10,
    ".thm": 11,
    ".lrv": 11,
    ".srt": 12,
    ".sub": 12,
};

/**
 * 查找文件的直接关联文件
 */
function findDirectRelatedFiles(
    mainFile: FileInfo,
    allFiles: FileInfo[],
    extensionMap: Record<string, string[]>,
): FileInfo[] {
    const baseName = path.parse(mainFile.path).name;
    const baseDir = path.dirname(mainFile.path);
    const mainExt = path.extname(mainFile.path).toLowerCase().slice(1);

    const relatedExtensions = extensionMap[mainExt] || [];
    const relatedFiles = [mainFile];

    // 查找完全匹配的关联文件
    for (const ext of relatedExtensions) {
        const candidatePath = path.join(baseDir, baseName + ext);
        const relatedFile = allFiles.find((f) => f.path === candidatePath);
        if (relatedFile) {
            relatedFiles.push(relatedFile);
        }
    }

    return relatedFiles;
}

/**
 * 查找特殊命名模式的文件
 */
function findSpecialPatternFiles(
    mainFile: FileInfo,
    allFiles: FileInfo[],
    relatedFiles: FileInfo[],
): void {
    const baseName = path.parse(mainFile.path).name;
    const mainExt = path.extname(mainFile.path).toLowerCase().slice(1);

    // GoPro命名模式: GOPR0001.MP4 -> GP010001.LRV, GP020001.MP4等
    if (baseName.startsWith("GOPR") && mainExt === "mp4") {
        const number = baseName.slice(4);
        const patterns = [
            `GP01${number}.LRV`,
            `GP02${number}.MP4`,
            `GP03${number}.MP4`,
            `GOPR${number}.THM`,
        ];

        for (const pattern of patterns) {
            const file = allFiles.find((f) => path.basename(f.path) === pattern);
            if (file && !relatedFiles.includes(file)) {
                relatedFiles.push(file);
            }
        }
    }

    // DJI命名模式: DJI_0001.MP4 -> DJI_0001.SRT
    if (baseName.startsWith("DJI_") && mainExt === "mp4") {
        const srtName = `${baseName}.SRT`;
        const file = allFiles.find((f) => path.basename(f.path) === srtName);
        if (file && !relatedFiles.includes(file)) {
            relatedFiles.push(file);
        }
    }

    // Sony相机命名模式: DSC00001.ARW -> DSC00001.JPG
    if (baseName.startsWith("DSC") && ["arw", "cr2", "nef"].includes(mainExt)) {
        const jpgName = `${baseName}.JPG`;
        const file = allFiles.find((f) => path.basename(f.path) === jpgName);
        if (file && !relatedFiles.includes(file)) {
            relatedFiles.push(file);
        }
    }

    // Canon相机命名模式: IMG_0001.CR2 -> IMG_0001.JPG
    if (baseName.startsWith("IMG_") && ["cr2", "cr3"].includes(mainExt)) {
        const jpgName = `${baseName}.JPG`;
        const file = allFiles.find((f) => path.basename(f.path) === jpgName);
        if (file && !relatedFiles.includes(file)) {
            relatedFiles.push(file);
        }
    }
}

/**
 * 查找一个主文件的所有相关文件
 */
function findAllRelatedFiles(
    mainFile: FileInfo,
    allFiles: FileInfo[],
    extensionMap: Record<string, string[]>,
): FileGroup {
    // 查找直接关联文件
    const relatedFiles = findDirectRelatedFiles(mainFile, allFiles, extensionMap);

    // 查找特殊命名模式的文件
    findSpecialPatternFiles(mainFile, allFiles, relatedFiles);

    const totalSize = relatedFiles.reduce((sum, file) => sum + file.size, 0);

    return {
        mainFile,
        files: relatedFiles,
        type: relatedFiles.length > 1 ? "group" : "single",
        totalSize,
    };
}

/**
 * 基础文件组检测（纯函数）
 */
export function detectBasicFileGroups(files: FileInfo[]): FileGroup[] {
    const groups: FileGroup[] = [];
    const processed = new Set<string>();

    for (const file of files) {
        if (processed.has(file.path)) continue;

        const group = findAllRelatedFiles(file, files, BASIC_RELATED_EXTENSIONS);

        groups.push(group);
        group.files.forEach((f) => processed.add(f.path));
    }

    return groups;
}

/**
 * 增强的文件组检测（纯函数）
 */
export function detectEnhancedFileGroups(files: FileInfo[], logger?: PhotasaLogger): FileGroup[] {
    const groups: FileGroup[] = [];
    const processed = new Set<string>();

    // 按优先级排序文件
    const sortedFiles = [...files].sort((a, b) => {
        const extA = path.extname(a.path).toLowerCase();
        const extB = path.extname(b.path).toLowerCase();
        const priorityA = FILE_PRIORITY[extA] || 99;
        const priorityB = FILE_PRIORITY[extB] || 99;
        return priorityA - priorityB;
    });

    for (const file of sortedFiles) {
        if (processed.has(file.path)) continue;

        const group = findAllRelatedFiles(file, files, ENHANCED_RELATED_EXTENSIONS);

        if (group.files.length > 1) {
            logger?.debug(
                `[FileGroup] Enhanced detection - group: ${group.mainFile.name} with ${group.files.length} files`,
            );
        }

        groups.push(group);
        group.files.forEach((f) => processed.add(f.path));
    }

    return groups;
}

/**
 * 检查两个文件是否相关
 */
export function areFilesRelated(mainFile: string, candidateFile: string): boolean {
    const mainBaseName = path.parse(mainFile).name;
    const mainExt = path.extname(mainFile).toLowerCase().slice(1);
    const candidateBaseName = path.parse(candidateFile).name;
    const candidateExt = path.extname(candidateFile).toLowerCase();

    // 检查基础文件名是否相同
    if (mainBaseName !== candidateBaseName) return false;

    // 检查扩展名是否在关联列表中
    const relatedExtensions = ENHANCED_RELATED_EXTENSIONS[mainExt] || [];
    return relatedExtensions.includes(candidateExt);
}

/**
 * 获取文件组的主文件
 */
export function getGroupMainFile(group: FileGroup): FileInfo {
    return group.mainFile;
}

/**
 * 默认导出：使用增强检测
 */
export const detectFileGroups = detectEnhancedFileGroups;
