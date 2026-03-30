/**
 * Tauri 下导入扩展 API 的空占位（RFC 0097）
 * 与 @photasa/common 类型一致，避免 UI 因 reject 崩溃；真实管线仍待 Rust/工作流接入。
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

/** 无扫描结果时的导入预览占位 */
export const EMPTY_IMPORT_PREVIEW: ImportPreview = {
    fileGroups: [],
    statistics: EMPTY_FILE_STATISTICS,
    duplicates: [],
    estimatedDuration: 0,
    targetStructure: new Map(),
};

const TAURI_UNDO_UNAVAILABLE = "Tauri：撤销预览尚未接入主进程";

/** 不可撤销时的预览占位 */
export function emptyUndoPreview(historyId: string): UndoPreview {
    return {
        historyId,
        canUndo: false,
        reason: TAURI_UNDO_UNAVAILABLE,
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
 * 元数据占位：路径取自请求；未读盘时尺寸与时间戳为占位值。
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

/** 与 Electron 扫描队列事件名一致（主进程尚未发射时监听器保持空闲） */
export const EVENT_IMPORT_PREVIEW_PROGRESS = "import:preview-progress" as const;
export const EVENT_SCAN_QUEUE_ADD = "picasa:add-to-scan-queue" as const;
