import type { FileOperation } from "./scan-types";
import {
    FileOperationPriorities,
    FileOperationDeduplicationWindows,
    DebounceTimeConfig,
} from "./constants";

/**
 * Pure functions for file operation processing
 * These functions are deterministic, have no side effects, and are easily testable
 */

/**
 * Get event priority based on type
 * Pure function - same input always produces same output
 */
export function getEventPriority(type: string): number {
    const priorityMap: Record<string, keyof typeof FileOperationPriorities> = {
        delete: "Delete",
        deleteDir: "DeleteDir",
        change: "Change",
        add: "Add",
        addDir: "AddDir",
    };
    const mappedType = priorityMap[type];
    return mappedType ? FileOperationPriorities[mappedType] : FileOperationPriorities.Default;
}

/**
 * Get deduplication window based on event type
 * Pure function - same input always produces same output
 */
export function getDeduplicationWindow(type: string): number {
    const windowMap: Record<string, keyof typeof FileOperationDeduplicationWindows> = {
        add: "Add",
        change: "Change",
        delete: "Delete",
        addDir: "AddDir",
        deleteDir: "DeleteDir",
    };
    const mappedType = windowMap[type];
    return mappedType
        ? FileOperationDeduplicationWindows[mappedType]
        : FileOperationDeduplicationWindows.Default;
}

/**
 * Generate unique operation ID
 * Pure function - generates unique ID based on current time and random
 */
export function generateOperationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Calculate debounce time based on pending event count
 * Pure function - same input always produces same output
 */
export function calculateDebounceTime(pendingCount: number): number {
    if (pendingCount > DebounceTimeConfig.HighLoadThreshold) return DebounceTimeConfig.HighLoad;
    if (pendingCount > DebounceTimeConfig.MediumLoadThreshold) return DebounceTimeConfig.MediumLoad;
    return DebounceTimeConfig.LowLoad;
}

/**
 * Create file operation object
 * Pure function - creates operation object from parameters
 */
export function createFileOperation(
    type: string,
    path: string,
    isFile: boolean,
    thumbnailSize: number,
): FileOperation {
    return {
        id: generateOperationId(),
        type: type as FileOperation["type"],
        path,
        timestamp: Date.now(),
        priority: getEventPriority(type),
        retryCount: 0,
        metadata: {
            thumbnailSize,
            isFile,
            lastModified: Date.now(),
        },
    };
}

/**
 * Check if event should be deduplicated
 * Pure function - same input always produces same output
 */
export function shouldDeduplicateEvent(
    existing: FileOperation | undefined,
    currentTime: number,
    deduplicationWindow: number,
): boolean {
    if (!existing) return false;
    const timeDiff = currentTime - existing.timestamp;
    return timeDiff < deduplicationWindow;
}

/**
 * Map FileOperation type to ScanAction action
 * Pure function - maps file operations to scan actions
 */
export function mapFileOperationToScanAction(
    operationType: FileOperation["type"],
): "scan" | "rescan" | "current" {
    switch (operationType) {
        case "add":
        case "addDir":
            return "scan";
        case "change":
            return "rescan";
        case "delete":
        case "deleteDir":
            return "current"; // Special handling for deletes
        default:
            return "scan";
    }
}

/**
 * Check if operation is high priority (delete operations)
 * Pure function - determines if operation needs immediate processing
 */
export function isHighPriorityOperation(operation: FileOperation): boolean {
    return operation.type === "delete" || operation.type === "deleteDir";
}

/**
 * Sort operations by priority and timestamp
 * Pure function - sorts array without mutation
 */
export function sortOperationsByPriority(operations: FileOperation[]): FileOperation[] {
    return [...operations].sort((a, b) => {
        // First sort by priority (lower number = higher priority)
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        // If same priority, sort by timestamp (older first)
        return a.timestamp - b.timestamp;
    });
}

/**
 * Filter operations by type
 * Pure function - filters operations without mutation
 */
export function filterOperationsByType(
    operations: FileOperation[],
    types: FileOperation["type"][],
): FileOperation[] {
    return operations.filter((op) => types.includes(op.type));
}

/**
 * Group operations by file path
 * Pure function - groups operations by path
 */
export function groupOperationsByPath(operations: FileOperation[]): Map<string, FileOperation[]> {
    const grouped = new Map<string, FileOperation[]>();

    for (const operation of operations) {
        const existing = grouped.get(operation.path) || [];
        existing.push(operation);
        grouped.set(operation.path, existing);
    }

    return grouped;
}
