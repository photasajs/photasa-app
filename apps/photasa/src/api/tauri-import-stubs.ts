/**
 * 导入相关前端兜底形状（RFC 0097 已收口）
 *
 * 真实管线在 Rust：`preview_import` / `execute_import` / history / undo / `extract_metadata`。
 * 本模块仅保留：空预览占位、撤销归一化失败时的兜底、以及与 legacy-api 同名的事件常量。
 * 禁止再当作「后端未接入」的实现路径。
 */

import type {
    FileMetadata,
    FileStatistics,
    ImportPreview,
    MetadataRequest,
    UndoPreview,
    UndoResult,
} from "@photasa/common";

export const EMPTY_FILE_STATISTICS: FileStatistics = {
    totalFiles: 0,
    imageFiles: 0,
    videoFiles: 0,
    otherFiles: 0,
    totalSize: 0,
    duplicateCount: 0,
    groupCount: 0,
};

/** 无扫描结果时的导入预览占位（测试 / 空态 UI） */
export const EMPTY_IMPORT_PREVIEW: ImportPreview = {
    fileGroups: [],
    statistics: EMPTY_FILE_STATISTICS,
    duplicates: [],
    estimatedDuration: 0,
    targetStructure: new Map(),
};

/** 撤销预览载荷非法或缺失时的兜底文案（Rust `preview_undo_import` 已实现） */
const TAURI_UNDO_NORMALIZE_FALLBACK = "撤销预览数据无效或不可用";

/** 不可撤销 / 归一化失败时的预览占位 */
export function emptyUndoPreview(historyId: string): UndoPreview {
    return {
        historyId,
        canUndo: false,
        reason: TAURI_UNDO_NORMALIZE_FALLBACK,
        filesToDelete: [],
        directoriesToCleanup: new Set(),
        potentialIssues: [],
        estimatedTime: 0,
    };
}

/** 无操作成功（未删除文件），与「无历史可撤」语义一致 */
export function noopUndoResult(): UndoResult {
    return {
        success: true,
        deletedFiles: [],
        errors: [],
        restoredDirectories: new Set(),
        undoId: "tauri-noop",
        timestamp: new Date(),
    };
}

/**
 * 元数据占位：仅测试/极端兜底；生产路径应 `invoke("extract_metadata")`。
 */
export function placeholderMetadataFromRequest(request: unknown): FileMetadata {
    const r = request as Partial<MetadataRequest> | null | undefined;
    const filePath = typeof r?.filePath === "string" ? r.filePath : "";
    const name = filePath.replace(/^.*[/\\]/, "") || "unknown";
    const epoch = new Date(0);
    return {
        path: filePath,
        name,
        size: 0,
        type: "other",
        modifiedTime: epoch,
        createdTime: epoch,
        dateSource: "file_modified",
    };
}

/** 与 legacy-api / Rust 事件名一致 */
export const EVENT_IMPORT_PREVIEW_PROGRESS = "import:preview-progress" as const;
export const EVENT_SCAN_QUEUE_ADD = "picasa:add-to-scan-queue" as const;
