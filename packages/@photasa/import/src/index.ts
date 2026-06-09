// Import handler (re-exports from metadata and file-groups)
export * from "./import-handler";

export {
    normalizeImportConfigDate,
    createDefaultImportFilters,
    processImportConfigForWorker,
    createSerializableWorkerError,
} from "./import-config-normalize";
export type { SerializableWorkerError } from "./import-config-normalize";

export { serializeImportConfigForWorker } from "./import-serialize";

export {
    ImportSessionManager,
    generateImportSessionId,
    createInitialImportProgress,
    IMPORT_SESSION_CLEANUP_DELAY_MS,
} from "./session-manager";

// Batch processor
export { BatchProcessor } from "./batch-processor";

// Duplicate handling
export {
    DuplicateDetector,
    DuplicateHandlerFactory,
    BatchDuplicateHandler,
    SkipDuplicateHandler,
    RenameDuplicateHandler,
    OverwriteDuplicateHandler,
    KeepBothDuplicateHandler,
} from "./duplicate-handler";
export type { DuplicateHandler } from "./duplicate-handler";

// Error handling
export {
    ImportErrorHandler,
    ErrorRecoveryManager,
    RetryRecoveryStrategy,
    SkipRecoveryStrategy,
    importErrorHandler,
} from "./error-handler";
export type { ErrorRecoveryStrategy } from "./error-handler";

// History management
export { ImportHistoryManager } from "./history-manager";

// File groups
export * from "./file-groups";

// Metadata extraction
export * from "./metadata";
