// Import handler (re-exports from metadata and file-groups)
export * from "./import-handler";

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
